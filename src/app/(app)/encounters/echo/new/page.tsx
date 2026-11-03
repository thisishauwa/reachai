"use client";

import { useState } from "react";
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
  generatePatientCode,
} from "@/lib/reference/codes";
import { useActiveConsentText } from "@/lib/queries/reference";
import { EncounterHeader } from "@/components/echo/encounter-header";
import { StepRequest, type RequestData } from "@/components/echo/step-request";
import {
  StepPresenceAge,
  type PresenceAgeData,
} from "@/components/echo/step-presence-age";
import {
  StepConsent,
  type StepConsentResult,
} from "@/components/echo/step-consent";
import {
  StepDemographics,
  type DemographicsData,
} from "@/components/echo/step-demographics";
import { StepSyndrome } from "@/components/echo/step-syndrome";
import { StepGeneralSymptoms } from "@/components/echo/step-general-symptoms";
import { StepQuestions } from "@/components/echo/step-questions";
import { StepTriage } from "@/components/echo/step-triage";
import { StepReferral } from "@/components/echo/step-referral";
import { EncounterCompletedModal } from "@/components/echo/encounter-completed-modal";
import { useZeroReport } from "@/lib/session/use-zero-report";
import type {
  PrivacyMode,
  TriageSeverity,
} from "@/lib/supabase/database.types";
import type { PatientPresence } from "@/lib/reference/request-options";

// Flow order per spec v0.3 / walkthrough v0.4 (AIR-794):
// request → presence + age → syndrome (look-check) → consent → demographics
//   ├── (if danger signs) → questions → triage → referral → complete
//   └── (if no danger signs) → general_symptoms → triage → complete
//
// Request logging and presence/age are surveillance-only and never route
// anything — the look-check decision (syndrome step) is unaffected by them.
// Consent and demographics stay AFTER the look-check: nothing is saved until
// then, matching "consent attaches to saving the record, not to looking at
// the patient" in spec v0.3.
type EchoStep =
  | "request"
  | "presence_age"
  | "syndrome"
  | "consent"
  | "demographics"
  | "general_symptoms"
  | "questions"
  | "triage"
  | "referral"
  | "complete";

interface EchoEncounterState {
  step: EchoStep;
  encounterId: string | null;
  patientId: string | null;
  patientName: string | null;
  privacyMode: PrivacyMode;
  sessionCode: string | null;
  consentId: string | null;
  locale: "en" | "ha";
  signatureMethod?: "type" | "draw";
  signatureText?: string;
  /** Step 1 — surveillance-only, never routes anything downstream */
  requestType: string | null;
  /** Step 2 — presence + age band */
  presence: PatientPresence | null;
  ageBand: string;
  sex: "female" | "male" | "other_not_stated";
  isMinor: boolean;
  /** Selected danger sign codes */
  dangerSignCodes: string[];
  /** Selected general / normal symptom codes */
  generalSymptomCodes: string[];
  /** Combined symptom codes */
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
  step: "request",
  encounterId: null,
  patientId: null,
  patientName: null,
  privacyMode: "anonymous",
  sessionCode: null,
  consentId: null,
  locale: "en",
  requestType: null,
  presence: null,
  ageBand: "",
  sex: "other_not_stated",
  isMinor: false,
  dangerSignCodes: [],
  generalSymptomCodes: [],
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
  const { data: identifiedConsentText } = useActiveConsentText(
    "identified_referral",
  );

  // ── Consent record helper ──────────────────────────────────────────────
  async function saveConsentRecord(
    encounterId: string,
    consentId: string,
    kind: "identified_referral" | "anonymous_screening",
    method: "verbal_attestation" | "drawn_signature" | "typed_signature",
    signature?: string,
    textVersionId?: string | null,
  ) {
    const supabase = createClient();
    let verId = textVersionId;
    if (!verId) {
      const { data: ver } = await supabase
        .from("consent_text_versions")
        .select("id")
        .eq("kind", kind)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      verId = ver?.id || "00000000-0000-0000-0000-000000000001";
    }

    const consentPayload: Record<string, unknown> = {
      id: consentId,
      encounter_id: encounterId,
      text_version_id: verId,
      kind,
      method,
      signature_data: signature ?? null,
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
      await syncController.enqueue(
        "consent",
        consentId,
        "insert",
        consentPayload,
      );
    } catch (e) {
      console.warn("Offline consent enqueue note:", e);
    }
  }

  // ── Step 1: Request logged ──────────────────────────────────────────────
  function handleRequestComplete(data: RequestData) {
    setState((s) => ({
      ...s,
      requestType: data.requestType,
      step: "presence_age",
    }));
  }

  // ── Step 2: Presence + age complete ─────────────────────────────────────
  function handlePresenceAgeComplete(data: PresenceAgeData) {
    setState((s) => ({
      ...s,
      presence: data.presence,
      ageBand: data.ageBand,
      isMinor: data.isMinor,
      step: "syndrome",
    }));
  }

  // ── Step 3 (look-check stand-in): danger signs complete ────────────────
  function handleSyndromeSelect(
    symptomCodes: string[],
    syndromeIds: string[],
    labels: string[],
    hasDangerSigns?: boolean,
  ) {
    if (!hasDangerSigns || syndromeIds.length === 0) {
      setState((s) => ({
        ...s,
        dangerSignCodes: [],
        syndromeIds: [],
        syndromeLabels: [],
        step: "consent",
      }));
    } else {
      setState((s) => ({
        ...s,
        dangerSignCodes: symptomCodes,
        symptomCodes,
        syndromeIds,
        syndromeLabels: labels,
        step: "consent",
      }));
    }
  }

  // ── Step 4a: Consent accepted ───────────────────────────────────────────
  function handleConsentComplete(data: StepConsentResult) {
    setState((s) => ({
      ...s,
      privacyMode: data.privacyMode,
      locale: data.locale,
      step: "demographics",
    }));
  }

  // ── Step 4b: Demographics complete ──────────────────────────────────────
  async function handleDemographicsComplete(data: DemographicsData) {
    const encounterId = crypto.randomUUID();
    const consentId = crypto.randomUUID();
    let patientId: string | null = null;
    let patientName: string | null = null;
    let patientCode: string | null = null;

    const supabase = createClient();

    try {
      if (state.privacyMode === "identified") {
        if (data.existingPatientId) {
          patientId = data.existingPatientId;
          patientName = data.fullName || "Patient";
        } else {
          // Create new patient
          patientId = crypto.randomUUID();
          patientCode = generatePatientCode();
          patientName = data.fullName || "Patient";

          const formattedPhone = data.phone
            ? data.phone.startsWith("+")
              ? data.phone
              : `+234${data.phone.replace(/^0/, "")}`
            : null;

          const patientPayload = {
            id: patientId,
            organization_id: activeFacility.organizationId,
            facility_id: activeFacility.facilityId,
            patient_code: patientCode,
            full_name: patientName,
            phone_e164: formattedPhone,
            age_band: data.ageBand,
            sex:
              data.sex === "other_not_stated" ? ("unknown" as const) : data.sex,
            pregnancy_status: data.pregnancyStatus ?? null,
            occupation_type: data.occupationType,
            created_by: userId,
          };

          try {
            await supabase
              .from("patients")
              .upsert(patientPayload, { onConflict: "id" });
          } catch (pErr) {
            console.warn("Direct patient upsert note:", pErr);
          }
          await syncController.enqueue(
            "patient",
            patientId,
            "insert",
            patientPayload,
          );
        }
      }

      const encounterPayload = {
        id: encounterId,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        clinician_id: userId,
        patient_id: patientId,
        encounter_code: encounterCode,
        session_code: state.privacyMode === "anonymous" ? sessionCode : null,
        workflow_mode: "echo" as const,
        privacy_mode: state.privacyMode,
        status: "in_progress" as const,
      };

      await supabase
        .from("encounters")
        .upsert(encounterPayload, { onConflict: "id" });
      await syncController.enqueue(
        "encounter",
        encounterId,
        "insert",
        encounterPayload,
      );

      // Snapshot demographics for the encounter
      const demoPayload = {
        encounter_id: encounterId,
        full_name:
          state.privacyMode === "identified"
            ? (data.fullName ?? patientName)
            : null,
        phone_e164:
          state.privacyMode === "identified" && data.phone
            ? data.phone.startsWith("+")
              ? data.phone
              : `+234${data.phone.replace(/^0/, "")}`
            : null,
        patient_code: patientCode,
        age_band: data.ageBand,
        sex:
          data.sex === "other_not_stated"
            ? ("unknown" as const)
            : (data.sex as "female" | "male" | "intersex" | "unknown"),
        sex_other: data.sex === "other_not_stated",
        pregnancy_status: data.pregnancyStatus ?? null,
        occupation_type: data.occupationType,
        insurance_status: data.insuranceStatus,
        education_level: data.educationLevel,
        // Fields removed per AIR-826:
        // distance_from_outlet: removed
        // visit_type: removed
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
        demoPayload,
      );

      // Save consent record according to mode
      if (state.privacyMode === "identified") {
        const method =
          state.signatureMethod === "draw"
            ? "drawn_signature"
            : "typed_signature";
        await saveConsentRecord(
          encounterId,
          consentId,
          "identified_referral",
          method,
          state.signatureText,
          identifiedConsentText?.id,
        );
      } else {
        await saveConsentRecord(
          encounterId,
          consentId,
          "anonymous_screening",
          "verbal_attestation",
          undefined,
          anonConsentText?.id,
        );
      }

      // Logging an encounter updates daily zero report
      setHasEncounterToday();
    } catch (err) {
      console.warn("Demographics complete note:", err);
    }

    // Danger signs were already collected at the look-check step (before
    // consent). Route straight into the matching follow-up step rather than
    // back through the look-check.
    const nextStep: EchoStep =
      state.syndromeIds.length > 0 ? "questions" : "general_symptoms";

    setState((s) => ({
      ...s,
      encounterId,
      patientId,
      patientName,
      sessionCode: state.privacyMode === "anonymous" ? sessionCode : null,
      consentId,
      step: nextStep,
    }));
  }

  // ── Complete encounter ─────────────────────────────────────────────────
  async function completeEncounter(encounterId: string) {
    setCompleting(true);
    try {
      const completedAt = new Date().toISOString();
      const supabase = createClient();

      // 1. Direct encounters update in Supabase (confirmed working)
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

      // 2. Try RPC if present
      try {
        await supabase.rpc(
          "complete_encounter" as never,
          { p_encounter_id: encounterId } as never,
        );
      } catch {}

      // 3. Mark completed in Dexie local drafts
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

      // 4. Enqueue status update in sync queue
      try {
        await syncController.enqueueAndSync(
          "encounter_status",
          encounterId,
          "update",
          {
            id: encounterId,
            status: "completed",
            completed_at: completedAt,
          },
        );
      } catch (syncErr) {
        console.warn("Sync queue note:", syncErr);
      }

      await queryClient.invalidateQueries({ queryKey: ["encounters"] });
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
    } catch (err) {
      console.error("Failed to complete encounter:", err);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-2 pb-12">
      {/* Top Header */}
      <EncounterHeader
        title={
          state.privacyMode === "identified" && state.patientName
            ? state.patientName
            : "Create new encounter"
        }
        onBack={() => {
          if (state.step === "request") {
            router.back();
          } else if (state.step === "presence_age") {
            setState((s) => ({ ...s, step: "request" }));
          } else if (state.step === "syndrome") {
            setState((s) => ({ ...s, step: "presence_age" }));
          } else if (state.step === "consent") {
            setState((s) => ({ ...s, step: "syndrome" }));
          } else if (state.step === "demographics") {
            setState((s) => ({ ...s, step: "consent" }));
          } else if (state.step === "general_symptoms") {
            setState((s) => ({ ...s, step: "demographics" }));
          } else if (state.step === "questions") {
            setState((s) => ({ ...s, step: "demographics" }));
          } else if (state.step === "triage") {
            if (state.dangerSignCodes.length > 0) {
              setState((s) => ({ ...s, step: "questions" }));
            } else {
              setState((s) => ({ ...s, step: "general_symptoms" }));
            }
          } else if (state.step === "referral") {
            setState((s) => ({ ...s, step: "triage" }));
          } else {
            router.back();
          }
        }}
      />

      {/* Step 1: Request logged */}
      {state.step === "request" && (
        <StepRequest
          initialValue={state.requestType ?? undefined}
          onContinue={handleRequestComplete}
          onPrevious={() => router.back()}
        />
      )}

      {/* Step 2: Presence + Age */}
      {state.step === "presence_age" && (
        <StepPresenceAge
          initialPresence={state.presence ?? ""}
          initialAgeBand={state.ageBand}
          onContinue={handlePresenceAgeComplete}
          onPrevious={() => setState((s) => ({ ...s, step: "request" }))}
        />
      )}

      {/* Step 3: Look-check (IDSR danger signs) */}
      {state.step === "syndrome" && (
        <StepSyndrome
          sessionCode={state.sessionCode ?? undefined}
          onPrevious={() => setState((s) => ({ ...s, step: "presence_age" }))}
          onSelect={handleSyndromeSelect}
        />
      )}

      {/* Step 4a: Consent */}
      {state.step === "consent" && (
        <StepConsent
          initialMode={state.privacyMode}
          isMinor={state.isMinor}
          onContinue={handleConsentComplete}
          onPrevious={() => setState((s) => ({ ...s, step: "syndrome" }))}
        />
      )}

      {/* Step 4b: Patient Details / Demographics */}
      {state.step === "demographics" && (
        <StepDemographics
          privacyMode={state.privacyMode}
          sessionCode={sessionCode}
          onGenerateNewCode={() => setSessionCode(generateSessionCode())}
          initialAgeBand={state.ageBand}
          onContinue={handleDemographicsComplete}
          onPrevious={() => setState((s) => ({ ...s, step: "consent" }))}
        />
      )}

      {/* Step 4c: Normal Symptoms Screen (when no danger signs) */}
      {state.step === "general_symptoms" && state.encounterId && (
        <StepGeneralSymptoms
          initialSelected={state.generalSymptomCodes}
          onPrevious={() => setState((s) => ({ ...s, step: "demographics" }))}
          onContinue={(codes, labels) => {
            setState((s) => ({
              ...s,
              generalSymptomCodes: codes,
              symptomCodes: codes,
              syndromeIds: [],
              syndromeLabels: labels,
              step: "triage",
            }));
          }}
        />
      )}

      {/* Step 5: Disease-Specific Questions (only for selected danger signs) */}
      {state.step === "questions" &&
        state.encounterId &&
        (state.syndromeIds.length > 0 ? (
          <StepQuestions
            syndromeIds={state.syndromeIds}
            syndromeLabels={state.syndromeLabels}
            encounterId={state.encounterId}
            encounterCode={encounterCode}
            patientName={state.patientName ?? undefined}
            isAnonymous={state.privacyMode === "anonymous"}
            sessionCode={state.sessionCode ?? undefined}
            onPrevious={() => setState((s) => ({ ...s, step: "demographics" }))}
            onComplete={(questionSetId, answers) =>
              setState((s) => ({
                ...s,
                questionSetId,
                answers,
                step: "triage",
              }))
            }
          />
        ) : (
          <div className="bg-[#f9f9f9] rounded-[20px] p-8 flex flex-col items-center text-center gap-4">
            <p className="text-base font-medium text-[#242b33]">
              No disease-specific follow-up questions required.
            </p>
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, step: "triage" }))}
              className="px-6 py-3 rounded-[12px] bg-[#0073f3] text-white font-medium text-sm hover:bg-[#0060cb] transition-colors"
            >
              Continue to assessment
            </button>
          </div>
        ))}

      {/* Step 6: Severity / Triage Assessment */}
      {state.step === "triage" && state.encounterId && (
        <StepTriage
          encounterId={state.encounterId}
          syndromeIds={state.syndromeIds}
          generalSymptomCodes={state.generalSymptomCodes}
          questionSetId={
            state.questionSetId || "00000000-0000-0000-0000-000000000000"
          }
          answers={state.answers}
          onDone={(outcome) => {
            if (outcome.referralRequired) {
              // Only show referral when clinically indicated (AIR-826)
              setState((s) => ({
                ...s,
                triageOutcomeId: outcome.id,
                triageSeverity: outcome.severity,
                triageGuidanceEn: outcome.guidanceEn,
                triageIpcGuidanceEn: outcome.ipcGuidanceEn,
                referralRequired: true,
                step: "referral",
              }));
            } else {
              // Routine cases: skip referral, mark completed immediately
              void completeEncounter(state.encounterId!);
              setState((s) => ({
                ...s,
                triageOutcomeId: outcome.id,
                triageSeverity: outcome.severity,
                triageGuidanceEn: outcome.guidanceEn,
                triageIpcGuidanceEn: outcome.ipcGuidanceEn,
                referralRequired: false,
                step: "complete",
              }));
            }
          }}
        />
      )}

      {/* Step 7: Referral (only when referralRequired) */}
      {state.step === "referral" && state.encounterId && (
        <StepReferral
          encounterId={state.encounterId}
          privacyMode={state.privacyMode}
          consentId={state.consentId}
          patientName={state.patientName ?? undefined}
          onComplete={() => {
            void completeEncounter(state.encounterId!);
            setState((s) => ({ ...s, step: "complete" }));
          }}
        />
      )}

      {/* Step 8: Complete */}
      {state.step === "complete" && state.encounterId && (
        <EncounterCompletedModal
          patientName={
            state.privacyMode === "identified"
              ? (state.patientName ?? "Patient")
              : "Anonymous patient"
          }
          isAnonymous={state.privacyMode === "anonymous"}
          onReturnHome={() => {
            toast.success("Encounter completed");
            router.push("/home");
          }}
        />
      )}
    </div>
  );
}
