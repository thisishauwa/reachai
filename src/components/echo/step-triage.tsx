"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { TriageBottomSheet } from "@/components/echo/triage-bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { evaluateMultiSyndromeTriage } from "@/lib/logic/triage";
import type {
  TriageOutcomeRow,
  TriageSeverity,
  Json,
} from "@/lib/supabase/database.types";

function isUuid(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

export function StepTriage({
  encounterId,
  syndromeIds,
  questionSetId,
  answers = {},
  onDone,
}: {
  encounterId: string;
  /** Multi-syndrome: array of syndrome codes/IDs to evaluate */
  syndromeIds: string[];
  questionSetId: string;
  answers?: Record<string, unknown>;
  onDone: (outcome: {
    id: string;
    severity: TriageSeverity;
    referralRequired: boolean;
    guidanceEn: string | null;
    ipcGuidanceEn: string | null;
  }) => void;
}) {
  // Derive primary syndromeId (first) for legacy DB lookups
  const syndromeId = syndromeIds[0] ?? "OTHER";
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

      // 5. Evaluate clinical assessment from answers across all selected syndromes
      const clinical = evaluateMultiSyndromeTriage(syndromeIds, answers || {});

      // Call Supabase RPC to record triage outcome in the database
      let rpcOutcomeId: string | null = null;
      try {
        const { data, error } = await supabase.rpc("evaluate_triage", {
          p_encounter_id: encounterId,
          p_idempotency_key: createIdempotencyKey(),
        });
        if (!error && data) {
          rpcOutcomeId = (data as { id?: string })?.id || null;
        } else if (error) {
          console.warn("evaluate_triage rpc note:", error);
        }
      } catch (rpcErr) {
        console.warn("evaluate_triage exception note:", rpcErr);
      }

      const outcomeId = rpcOutcomeId || crypto.randomUUID();
      const resolvedOutcome: TriageOutcomeRow = {
        id: outcomeId,
        encounter_id: encounterId,
        severity: clinical.severity,
        condition_code: clinical.conditionCode,
        condition_label_en: clinical.conditionLabelEn,
        condition_label_ha: clinical.conditionLabelHa,
        guidance_en: clinical.guidanceEn,
        guidance_ha: clinical.guidanceHa,
        ipc_guidance_en: clinical.ipcGuidanceEn,
        ipc_guidance_ha: clinical.ipcGuidanceHa,
        referral_required: clinical.referralRequired,
        evaluated_inputs: (answers || {}) as unknown as Json,
        ruleset_snapshot: [],
        evaluated_at: new Date().toISOString(),
        acknowledged_at: clinical.severity === "emergency" ? new Date().toISOString() : null,
        acknowledged_by: null,
        override_reason: null,
        triage_rule_id: null,
      };

      setOutcome(resolvedOutcome);
    } catch (err: unknown) {
      console.warn("Triage evaluation exception:", err);
      const clinical = evaluateMultiSyndromeTriage(syndromeIds, answers || {});
      const fallbackOutcome: TriageOutcomeRow = {
        id: crypto.randomUUID(),
        encounter_id: encounterId,
        severity: clinical.severity,
        condition_code: clinical.conditionCode,
        condition_label_en: clinical.conditionLabelEn,
        condition_label_ha: clinical.conditionLabelHa,
        guidance_en: clinical.guidanceEn,
        guidance_ha: clinical.guidanceHa,
        ipc_guidance_en: clinical.ipcGuidanceEn,
        ipc_guidance_ha: clinical.ipcGuidanceHa,
        referral_required: clinical.referralRequired,
        evaluated_inputs: (answers || {}) as unknown as Json,
        ruleset_snapshot: [],
        evaluated_at: new Date().toISOString(),
        acknowledged_at: clinical.severity === "emergency" ? new Date().toISOString() : null,
        acknowledged_by: null,
        override_reason: null,
        triage_rule_id: null,
      };

      setOutcome(fallbackOutcome);

    } finally {
      setLoading(false);
    }
  }, [encounterId, syndromeIds, syndromeId, questionSetId, answers]);


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
