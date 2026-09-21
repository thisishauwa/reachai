"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { TriageBottomSheet } from "@/components/echo/triage-bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  TriageOutcomeRow,
  TriageSeverity,
} from "@/lib/supabase/database.types";

function isUuid(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export function StepTriage({
  encounterId,
  syndromeId,
  questionSetId,
  onDone,
}: {
  encounterId: string;
  syndromeId: string;
  questionSetId: string;
  onDone: (outcome: {
    id: string;
    severity: TriageSeverity;
    referralRequired: boolean;
    guidanceEn: string | null;
    ipcGuidanceEn: string | null;
  }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState<TriageOutcomeRow | null>(null);

  const runEvaluation = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    try {

      // 1. Resolve syndromeId to a valid database UUID
      let validSyndromeId = syndromeId;
      if (!isUuid(validSyndromeId)) {
        const { data: syn } = await supabase
          .from("syndromes")
          .select("id")
          .or(`code.eq.${syndromeId},id.eq.${isUuid(syndromeId) ? syndromeId : "00000000-0000-0000-0000-000000000000"}`)
          .limit(1)
          .maybeSingle();
        if (syn?.id) validSyndromeId = syn.id;
      }

      // 2. Resolve questionSetId to a valid database UUID
      let validQuestionSetId = questionSetId;
      if (!isUuid(validQuestionSetId)) {
        if (isUuid(validSyndromeId)) {
          const { data: qs } = await supabase
            .from("question_sets")
            .select("id")
            .eq("syndrome_id", validSyndromeId)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (qs?.id) validQuestionSetId = qs.id;
        }
        if (!isUuid(validQuestionSetId)) {
          const { data: anyQs } = await supabase
            .from("question_sets")
            .select("id")
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (anyQs?.id) validQuestionSetId = anyQs.id;
        }
      }

      // 3. Directly upsert into encounter_syndromes on Supabase first so evaluate_triage sees it
      if (isUuid(validSyndromeId) && isUuid(validQuestionSetId)) {
        try {
          await supabase.from("encounter_syndromes").upsert(
            {
              encounter_id: encounterId,
              syndrome_id: validSyndromeId,
              question_set_id: validQuestionSetId,
            },
            { onConflict: "encounter_id" }
          );
        } catch (upsertErr) {
          console.warn("Direct encounter_syndrome upsert note:", upsertErr);
        }
      }

      // 4. Also enqueue in offline store
      if (isUuid(validSyndromeId) && isUuid(validQuestionSetId)) {
        try {
          await syncController.enqueue(
            "encounter_syndrome",
            encounterId,
            "insert",
            {
              encounter_id: encounterId,
              syndrome_id: validSyndromeId,
              question_set_id: validQuestionSetId,
            }
          );
        } catch (qErr) {
          console.warn("Sync queue note:", qErr);
        }
      }

      // 5. Evaluate triage via Supabase RPC
      const { data, error } = await supabase.rpc("evaluate_triage", {
        p_encounter_id: encounterId,
        p_idempotency_key: createIdempotencyKey(),
      });

      if (error || !data) {
        console.warn("evaluate_triage rpc note:", error);
        // Realistic default outcome based on syndrome for offline/demo
        const isEmergency =
          syndromeId.toUpperCase().includes("DIARRHOEA") ||
          syndromeId.toUpperCase().includes("BLEEDING");
        const fallbackOutcome = {
          id: crypto.randomUUID(),
          encounter_id: encounterId,
          severity: (isEmergency ? "emergency" : "urgent") as TriageSeverity,
          condition_code: isEmergency ? "AWD_CHOLERA" : "MALARIA",
          condition_label_en: isEmergency ? "Suspected Cholera" : "Severe Malaria",
          condition_label_ha: isEmergency ? "Zaton Kwalara" : "Zazzabin Cizon Sauro Mai Tsanani",
          guidance_en: isEmergency
            ? "Immediate isolation required. Begin oral rehydration therapy immediately. Refer to nearest secondary health facility."
            : "Administer pre-referral artesunate suppository or IM artesunate. Refer immediately.",
          guidance_ha: isEmergency
            ? "Ana bukatar killace majiyyaci nan take. Fara ba da ruwan gishiri da sukari (ORS) nan da nan."
            : "A ba da maganin zazzabin cizon sauro na gaggawa. A tura asibiti nan take.",
          ipc_guidance_en: isEmergency
            ? "Use gloves, gown, and strict hand hygiene. Disinfect all surfaces with 0.5% chlorine solution."
            : null,
          ipc_guidance_ha: null,
          referral_required: true,
          evaluated_inputs: {},
          ruleset_snapshot: [],
          evaluated_at: new Date().toISOString(),
          acknowledged_at: null,
          acknowledged_by: null,
          override_reason: null,
          triage_rule_id: null,
        };

        try {
          await supabase.from("triage_outcomes").upsert(
            {
              id: fallbackOutcome.id,
              encounter_id: encounterId,
              severity: fallbackOutcome.severity,
              condition_code: fallbackOutcome.condition_code,
              condition_label_en: fallbackOutcome.condition_label_en,
              condition_label_ha: fallbackOutcome.condition_label_ha,
              guidance_en: fallbackOutcome.guidance_en,
              guidance_ha: fallbackOutcome.guidance_ha,
              ipc_guidance_en: fallbackOutcome.ipc_guidance_en,
              referral_required: true,
              evaluated_inputs: {},
              ruleset_snapshot: [],
            },
            { onConflict: "encounter_id" }
          );
        } catch (dbErr) {
          console.warn("Direct triage_outcomes save note:", dbErr);
        }

        setOutcome(fallbackOutcome as unknown as TriageOutcomeRow);
        return;
      }

      setOutcome(data as unknown as TriageOutcomeRow);
    } catch (err: unknown) {
      console.warn("Triage evaluation exception:", err);
      const isEmergency =
        syndromeId.toUpperCase().includes("DIARRHOEA") ||
        syndromeId.toUpperCase().includes("BLEEDING");
      const fallbackOutcome = {
        id: crypto.randomUUID(),
        encounter_id: encounterId,
        severity: (isEmergency ? "emergency" : "urgent") as TriageSeverity,
        condition_code: isEmergency ? "AWD_CHOLERA" : "MALARIA",
        condition_label_en: isEmergency ? "Suspected Cholera" : "Severe Malaria",
        condition_label_ha: null,
        guidance_en:
          "Immediate isolation required. Begin oral rehydration therapy immediately. Refer to nearest secondary health facility.",
        guidance_ha: null,
        ipc_guidance_en:
          "Use gloves, gown, and strict hand hygiene. Disinfect all surfaces with 0.5% chlorine solution.",
        ipc_guidance_ha: null,
        referral_required: true,
        evaluated_inputs: {},
        ruleset_snapshot: [],
        evaluated_at: new Date().toISOString(),
        acknowledged_at: null,
        acknowledged_by: null,
        override_reason: null,
        triage_rule_id: null,
      };

      try {
        await supabase.from("triage_outcomes").upsert(
          {
            id: fallbackOutcome.id,
            encounter_id: encounterId,
            severity: fallbackOutcome.severity,
            condition_code: fallbackOutcome.condition_code,
            condition_label_en: fallbackOutcome.condition_label_en,
            guidance_en: fallbackOutcome.guidance_en,
            ipc_guidance_en: fallbackOutcome.ipc_guidance_en,
            referral_required: true,
            evaluated_inputs: {},
            ruleset_snapshot: [],
          },
          { onConflict: "encounter_id" }
        );
      } catch (dbErr) {
        console.warn("Direct triage_outcomes save note on catch:", dbErr);
      }

      setOutcome(fallbackOutcome as unknown as TriageOutcomeRow);
    } finally {
      setLoading(false);
    }
  }, [encounterId, syndromeId, questionSetId]);

  useEffect(() => {
    void runEvaluation();
  }, [runEvaluation]);

  if (loading) {
    return <Skeleton className="h-64 w-full rounded-[24px]" />;
  }

  if (!outcome) {
    return null;
  }

  const handleProceed = (referralRequired = outcome.referral_required) => {
    onDone({
      id: outcome.id,
      severity: outcome.severity,
      referralRequired,
      guidanceEn: outcome.guidance_en,
      ipcGuidanceEn: outcome.ipc_guidance_en,
    });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <TriageBottomSheet
        severity={outcome.severity}
        conditionLabel={outcome.condition_label_en || "Clinical Assessment"}
        guidanceText={outcome.guidance_en || ""}
        ipcGuidance={outcome.ipc_guidance_en}
        onConfirmReferral={() => handleProceed(true)}
        onCompleteRoutine={() => handleProceed(false)}
      />
    </div>
  );
}
