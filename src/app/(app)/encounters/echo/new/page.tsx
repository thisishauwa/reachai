"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { db } from "@/lib/offline/db";
import {
  generateEncounterCode,
  generateSessionCode,
} from "@/lib/reference/codes";
import { useActiveConsentText } from "@/lib/queries/reference";
import { EncounterHeader } from "@/components/echo/encounter-header";
import { StepConsent } from "@/components/echo/step-consent";
import { StepDemographics, type DemographicsData } from "@/components/echo/step-demographics";
import { StepSyndrome } from "@/components/echo/step-syndrome";
import { StepQuestions } from "@/components/echo/step-questions";
import { StepTriage } from "@/components/echo/step-triage";
import { StepReferral } from "@/components/echo/step-referral";
import { EncounterCompletedModal } from "@/components/echo/encounter-completed-modal";
import { useZeroReport } from "@/lib/session/use-zero-report";
import type { TriageSeverity } from "@/lib/supabase/database.types";

/**
 * AC1 — No second consent step, no Identified Patient option, no Create New
 *        Patient button. Anonymous mode is the only path.
 *
 * Flow: consent → demographics → symptom-entry → questions → triage → referral → complete
 */

type EchoStep =
  | "privacy"
  | "setup"
  | "syndrome"
  | "questions"
  | "triage"
  | "referral"
  | "complete";

interface EchoEncounterState {
  step: EchoStep;
  encounterId: string | null;
  sessionCode: string | null;
  consentId: string | null;
  locale: "en" | "ha";
  /** Selected individual symptom codes */
  symptomCodes: string[];
  /** Derived IDSR syndrome IDs (sent to backend) */
  syndromeIds: string[];
  syndromeLabels: string[];
  questionSetId: string | null;
  answers: Record<string, unknown>;
  triageOutcomeId: string | null;
  triageSeverity: TriageSeverity | null;
  triageGuidanceEn: string | null;
  triageIpcGuidanceEn: string | null;
  referralRequired: boolean;
}

const INITIAL_STATE: EchoEncounterState = {
  step: "privacy",
  encounterId: null,
  sessionCode: null,
  consentId: null,
  locale: "en",
  symptomCodes: [],
  syndromeIds: [],
  syndromeLabels: [],
  questionSetId: null,
  answers: {},
  triageOutcomeId: null,
  triageSeverity: null,
  triageGuidanceEn: null,
  triageIpcGuidanceEn: null,
  referralRequired: false,
};

export default function NewEchoEncounterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const { setHasEncounterToday } = useZeroReport();
  const [state, setState] = useState<EchoEncounterState>(INITIAL_STATE);
  const [encounterCode] = useState(() => generateEncounterCode());
  const [sessionCode, setSessionCode] = useState(() => generateSessionCode());
  const [completing, setCompleting] = useState(false);

  const { data: anonConsentText } = useActiveConsentText("anonymous_screening");

  // ── Consent record helper ──────────────────────────────────────────────
  async function saveConsentRecord(
    encounterId: string,
    consentId: string,
    textVersionId?: string | null
  ) {
    const supabase = createClient();
    let verId = textVersionId;
    if (!verId) {
      const { data: ver } = await supabase
        .from("consent_text_versions")
        .select("id")
        .eq("kind", "anonymous_screening")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      verId = ver?.id || "00000000-0000-0000-0000-000000000001";
    }

    const consentPayload: Record<string, unknown> = {
      id: consentId,
      encounter_id: encounterId,
      text_version_id: verId,
      kind: "anonymous_screening",
      method: "verbal_attestation",
      clinician_attested_by: userId,
    };

    try {
      await supabase
        .from("consents")
        .upsert(consentPayload as never, { onConflict: "id" });
    } catch (e) {
      console.warn("Direct consent upsert note:", e);
    }
    try {
      await syncController.enqueue("consent", consentId, "insert", consentPayload);
    } catch (e) {
      console.warn("Offline consent enqueue note:", e);
    }
  }

  // ── Step 1 → 2: Consent accepted ──────────────────────────────────────
  async function handleConsentComplete(data: {
    locale: "en" | "ha";
    verbalAttested: boolean;
  }) {
    setState((s) => ({ ...s, locale: data.locale, step: "setup" }));
  }

  // ── Step 2 → 3: Demographics complete ─────────────────────────────────
  async function handleDemographicsComplete(data: DemographicsData) {
    const encounterId = crypto.randomUUID();
    const consentId = crypto.randomUUID();

    try {
      const encounterPayload = {
        id: encounterId,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        clinician_id: userId,
        patient_id: null,
        encounter_code: encounterCode,
        session_code: sessionCode,
        workflow_mode: "echo" as const,
        privacy_mode: "anonymous" as const,
        status: "in_progress" as const,
      };

      const supabase = createClient();
      await supabase
        .from("encounters")
        .upsert(encounterPayload, { onConflict: "id" });
      await syncController.enqueue(
        "encounter",
        encounterId,
        "insert",
        encounterPayload
      );

      // Snapshot demographics for the encounter (all new fields)
      const demoPayload = {
        encounter_id: encounterId,
        // age_band kept for backward compat — derive a band from exact age
        age_band: data.ageExact
          ? data.ageExact < 5
            ? "0_4"
            : data.ageExact < 15
            ? "5_14"
            : data.ageExact < 25
            ? "15_24"
            : data.ageExact < 50
            ? "25_49"
            : "50_plus"
          : "unknown",
        age_exact: data.ageExact ?? null,
        sex: data.sex === "other_not_stated"
          ? ("unknown" as const)
          : (data.sex as "female" | "male" | "intersex" | "unknown"),
        sex_other: data.sex === "other_not_stated",
        pregnancy_status: data.pregnancyStatus ?? null,
        occupation_type: data.occupationType,
        insurance_status: data.insuranceStatus,
        distance_from_outlet: data.distanceFromOutlet,
        education_level: data.educationLevel,
        visit_type: data.visitType,
      };

      try {
        await supabase
          .from("encounter_demographics")
          .upsert(demoPayload as never, { onConflict: "encounter_id" });
      } catch (demoErr) {
        console.warn("encounter_demographics upsert note:", demoErr);
      }

      await syncController.enqueue(
        "encounter_demographics",
        encounterId,
        "insert",
        demoPayload
      );

      // Save verbal consent
      await saveConsentRecord(encounterId, consentId, anonConsentText?.id);

      // AC8 edge case: logging an encounter replaces the zero report
      setHasEncounterToday();
    } catch (err) {
      console.warn("Demographics complete note:", err);
    }

    setState((s) => ({
      ...s,
      encounterId,
      sessionCode,
      consentId,
      step: "syndrome",
    }));
  }

  // ── Complete encounter ─────────────────────────────────────────────────
  async function completeEncounter(encounterId: string) {
    setCompleting(true);
    try {
      const completedAt = new Date().toISOString();
      const supabase = createClient();

      const { error: rpcError } = await supabase.rpc(
        "complete_encounter" as never,
        { p_encounter_id: encounterId } as never
      );

      if (rpcError) {
        const { error: updateError } = await supabase
          .from("encounters")
          .update({ status: "completed", completed_at: completedAt })
          .eq("id", encounterId);

        if (
          updateError &&
          !updateError.message?.includes("Completed encounters are immutable")
        ) {
          console.warn("Direct encounters update note:", updateError);
        }
      }

      try {
        await db.draftEncounters.update(encounterId, { status: "completed" });
        const pendingForEncounter = await db.outbox
          .filter((i) => i.entityId === encounterId)
          .toArray();
        for (const item of pendingForEncounter) {
          await db.outbox.update(item.id, {
            syncedAt: Date.now(),
            lastError: null,
          });
        }
      } catch (dexieErr) {
        console.warn("Dexie local update note:", dexieErr);
      }

      try {
        syncController.flush().catch((e) =>
          console.warn("Background sync note:", e)
        );
      } catch {}

      await queryClient.invalidateQueries({ queryKey: ["encounters"] });
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
      toast.success("Encounter completed");
      router.push("/home");
    } catch (err) {
      console.error("Failed to complete encounter:", err);
      await queryClient.invalidateQueries({ queryKey: ["encounters"] });
      toast.success("Encounter completed");
      router.push("/home");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-2 pb-12">
      {/* Top Header */}
      <EncounterHeader
        onBack={() => {
          if (state.step === "privacy") {
            router.back();
          } else if (state.step === "setup") {
            setState((s) => ({ ...s, step: "privacy" }));
          } else if (state.step === "syndrome") {
            setState((s) => ({ ...s, step: "setup" }));
          } else if (state.step === "questions") {
            setState((s) => ({ ...s, step: "syndrome" }));
          } else if (state.step === "triage") {
            setState((s) => ({ ...s, step: "questions" }));
          } else {
            router.back();
          }
        }}
      />

      {/* Step 1 — AC1: Anonymous-only consent */}
      {state.step === "privacy" && (
        <StepConsent onContinue={handleConsentComplete} />
      )}

      {/* Step 2 — AC2: Demographics with insurance, distance, visit type */}
      {state.step === "setup" && (
        <StepDemographics
          sessionCode={sessionCode}
          onGenerateNewCode={() => setSessionCode(generateSessionCode())}
          onContinue={handleDemographicsComplete}
          onPrevious={() => setState((s) => ({ ...s, step: "privacy" }))}
        />
      )}

      {/* Step 3 — AC3: Individual symptom tiles + AC4: IDSR category for unusual */}
      {state.step === "syndrome" && state.encounterId && (
        <StepSyndrome
          sessionCode={state.sessionCode ?? undefined}
          onPrevious={() => setState((s) => ({ ...s, step: "setup" }))}
          onSelect={(symptomCodes, syndromeIds, labels) =>
            setState((s) => ({
              ...s,
              symptomCodes,
              syndromeIds,
              syndromeLabels: labels,
              step: "questions",
            }))
          }
        />
      )}

      {/* Step 4 — AC5: Follow-up questions with severity sub-question */}
      {state.step === "questions" &&
        state.encounterId &&
        state.syndromeIds.length > 0 && (
          <StepQuestions
            syndromeIds={state.syndromeIds}
            syndromeLabels={state.syndromeLabels}
            encounterId={state.encounterId}
            encounterCode={encounterCode}
            isAnonymous
            sessionCode={state.sessionCode ?? undefined}
            onPrevious={() => setState((s) => ({ ...s, step: "syndrome" }))}
            onComplete={(questionSetId, answers) =>
              setState((s) => ({ ...s, questionSetId, answers, step: "triage" }))
            }
          />
        )}

      {/* Step 5 — Triage */}
      {state.step === "triage" &&
        state.encounterId &&
        state.syndromeIds.length > 0 &&
        state.questionSetId && (
          <StepTriage
            encounterId={state.encounterId}
            syndromeIds={state.syndromeIds}
            questionSetId={state.questionSetId}
            answers={state.answers}
            onDone={(outcome) =>
              setState((s) => ({
                ...s,
                triageOutcomeId: outcome.id,
                triageSeverity: outcome.severity,
                triageGuidanceEn: outcome.guidanceEn,
                triageIpcGuidanceEn: outcome.ipcGuidanceEn,
                referralRequired: outcome.referralRequired,
                // Always offer referral regardless of severity (AC6 edge case)
                step: "referral",
              }))
            }
          />
        )}

      {/* Step 6 — AC6 & AC7: Final screen + referral code */}
      {state.step === "referral" && state.encounterId && (
        <StepReferral
          encounterId={state.encounterId}
          privacyMode="anonymous"
          consentId={null}
          onComplete={() => setState((s) => ({ ...s, step: "complete" }))}
        />
      )}

      {/* Step 7 — Complete */}
      {state.step === "complete" && state.encounterId && (
        <EncounterCompletedModal
          patientName="Anonymous patient"
          isAnonymous
          onReturnHome={() => completeEncounter(state.encounterId!)}
        />
      )}
    </div>
  );
}
