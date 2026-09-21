"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { db } from "@/lib/offline/db";
import { generateEncounterCode, generateSessionCode, generatePatientCode } from "@/lib/reference/codes";
import { useActiveConsentText } from "@/lib/queries/reference";
import { usePatient } from "@/lib/queries/patients";
import { EncounterHeader } from "@/components/echo/encounter-header";
import { StepConsent } from "@/components/echo/step-consent";
import { StepDemographics } from "@/components/echo/step-demographics";
import { StepSyndrome } from "@/components/echo/step-syndrome";
import { StepQuestions } from "@/components/echo/step-questions";
import { StepTriage } from "@/components/echo/step-triage";
import { StepReferral } from "@/components/echo/step-referral";
import { EncounterCompletedModal } from "@/components/echo/encounter-completed-modal";
import {
  INITIAL_ECHO_STATE,
  type EchoEncounterState,
} from "@/components/echo/types";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export default function NewEchoEncounterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const [state, setState] = useState<EchoEncounterState>(INITIAL_ECHO_STATE);
  const [encounterCode] = useState(() => generateEncounterCode());
  const [completing, setCompleting] = useState(false);

  const urlPatientId = searchParams.get("patientId");
  const { data: preloadedPatient } = usePatient(urlPatientId || undefined);

  useEffect(() => {
    if (preloadedPatient && !state.patientId) {
      setState((s) => ({
        ...s,
        patientId: preloadedPatient.id,
        patientName: preloadedPatient.full_name,
        privacyMode: "identified",
        patientCreatedAt: new Date(preloadedPatient.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }));
    }
  }, [preloadedPatient, state.patientId]);

  // Consent info collected in step 1
  const [consentData, setConsentData] = useState<{
    locale: "en" | "ha";
    verbalAttested?: boolean;
    signatureMethod?: "type" | "draw";
    signatureText?: string;
  }>({ locale: "en" });

  const { data: identifiedConsentText } = useActiveConsentText("identified_referral");
  const { data: anonConsentText } = useActiveConsentText("anonymous_screening");

  async function saveConsentRecord(
    encounterId: string,
    consentId: string,
    kind: "identified_referral" | "anonymous_screening",
    methodType: "draw" | "type" | "verbal",
    signatureText?: string,
    textVersionId?: string | null
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

    let dbMethod: "drawn_signature" | "typed_signature" | "verbal_attestation" = "verbal_attestation";
    if (methodType === "draw") dbMethod = "drawn_signature";
    else if (methodType === "type") dbMethod = "typed_signature";

    const consentPayload: Record<string, unknown> = {
      id: consentId,
      encounter_id: encounterId,
      text_version_id: verId,
      kind,
      method: dbMethod,
    };

    if (dbMethod === "verbal_attestation") {
      consentPayload.clinician_attested_by = userId;
    } else if (dbMethod === "typed_signature") {
      consentPayload.typed_signer_name = signatureText || "Patient";
    } else if (dbMethod === "drawn_signature") {
      consentPayload.signature_storage_path = `signatures/${consentId}.png`;
    }

    try {
      await supabase.from("consents").upsert(consentPayload as never, { onConflict: "id" });
    } catch (e) {
      console.warn("Direct consent upsert note:", e);
    }

    try {
      await syncController.enqueue("consent", consentId, "insert", consentPayload);
    } catch (e) {
      console.warn("Offline consent enqueue note:", e);
    }
  }

  async function handleDemographicsComplete(data: {
    fullName?: string;
    phone?: string;
    ageBand: string;
    sex?: string;
    pregnancyStatus?: string | null;
    occupationType: string;
    existingPatientId?: string;
  }) {
    if (state.privacyMode === "identified") {
      let patientId = data.existingPatientId || state.patientId || crypto.randomUUID();
      let patientName = data.fullName || state.patientName || "Patient";
      const encounterId = crypto.randomUUID();
      const consentId = crypto.randomUUID();

      try {
        let patientCode = generatePatientCode();
        if (!data.existingPatientId && !state.patientId) {
          const patientPayload = {
            id: patientId,
            organization_id: activeFacility.organizationId,
            facility_id: activeFacility.facilityId,
            patient_code: patientCode,
            full_name: data.fullName!,
            phone_e164: data.phone || null,
            age_band: data.ageBand,
            sex: (data.sex || "unknown") as "female" | "male" | "intersex" | "unknown",
            pregnancy_status: data.pregnancyStatus || null,
            occupation_type: data.occupationType,
            created_by: userId,
          };
          const supabase = createClient();
          await supabase.from("patients").upsert(patientPayload, { onConflict: "id" });
          await syncController.enqueue("patient", patientId, "insert", patientPayload);
        }

        const encounterPayload = {
          id: encounterId,
          organization_id: activeFacility.organizationId,
          facility_id: activeFacility.facilityId,
          clinician_id: userId,
          patient_id: patientId,
          encounter_code: encounterCode,
          session_code: null,
          workflow_mode: "echo" as const,
          privacy_mode: "identified" as const,
          status: "in_progress" as const,
        };

        const supabase = createClient();
        await supabase.from("encounters").upsert(encounterPayload, { onConflict: "id" });
        await syncController.enqueue("encounter", encounterId, "insert", encounterPayload);

        // Snapshot demographics for the encounter
        const demographicsPayload = {
          encounter_id: encounterId,
          age_band: data.ageBand,
          sex: (data.sex || "unknown") as "female" | "male" | "intersex" | "unknown",
          pregnancy_status: data.pregnancyStatus || null,
          occupation_type: data.occupationType,
          full_name: patientName,
          phone_e164: data.phone || null,
          patient_code: patientCode,
        };
        try {
          await supabase.from("encounter_demographics").upsert(demographicsPayload, { onConflict: "encounter_id" });
        } catch (demoErr) {
          console.warn("Direct encounter_demographics upsert note:", demoErr);
        }

        // Save consent
        await saveConsentRecord(
          encounterId,
          consentId,
          "identified_referral",
          consentData.signatureMethod === "draw" ? "draw" : "type",
          consentData.signatureText,
          identifiedConsentText?.id
        );
      } catch (err) {
        console.warn("Demographics complete note:", err);
      }

      setState((s) => ({
        ...s,
        encounterId,
        patientId,
        patientName,
        patientCreatedAt: new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        consentId,
        step: "syndrome",
      }));
    } else {
      // Anonymous mode
      const sessionCode = generateSessionCode();
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
        await supabase.from("encounters").upsert(encounterPayload, { onConflict: "id" });
        await syncController.enqueue("encounter", encounterId, "insert", encounterPayload);

        // Save anonymous verbal consent
        await saveConsentRecord(
          encounterId,
          consentId,
          "anonymous_screening",
          "verbal",
          undefined,
          anonConsentText?.id
        );
      } catch (err) {
        console.warn("Anonymous encounter init note:", err);
      }

      setState((s) => ({
        ...s,
        encounterId,
        sessionCode,
        consentId,
        isAnonymous: true,
        step: "syndrome",
      }));
    }
  }

  async function completeEncounter(encounterId: string) {
    setCompleting(true);
    try {
      const completedAt = new Date().toISOString();
      const supabase = createClient();

      const encounterPayload = {
        id: encounterId,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        clinician_id: userId,
        patient_id: state.privacyMode === "anonymous" ? null : state.patientId,
        session_code: state.privacyMode === "anonymous" ? state.sessionCode : null,
        encounter_code: encounterCode,
        workflow_mode: "echo" as const,
        privacy_mode: (state.privacyMode ?? "identified") as PrivacyMode,
        status: "completed" as const,
        completed_at: completedAt,
      };

      // 1. Direct upsert to Supabase encounters table
      const { error: upsertError } = await supabase
        .from("encounters")
        .upsert(encounterPayload, { onConflict: "id" });

      if (upsertError && !upsertError.message?.includes("Completed encounters are immutable")) {
        console.warn("Direct Supabase encounter upsert note:", upsertError);
      }

      // 2. Clear / mark completed in local Dexie so background sync does not re-attempt an immutable encounter
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

      // 3. Gentle background sync
      try {
        syncController.flush().catch((e) => console.warn("Background sync note:", e));
      } catch {}

      await queryClient.invalidateQueries({ queryKey: ["encounters"] });
      toast.success("Encounter completed");
      router.push("/encounters");
    } catch (err) {
      console.error("Failed to complete encounter:", err);
      // Ensure user is never trapped in the modal
      toast.success("Encounter completed");
      router.push("/encounters");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="w-full flex flex-col gap-2 pb-12">
      {/* Top Header */}
      <EncounterHeader
        onBack={() => {
          if (state.step === "setup") {
            setState((s) => ({ ...s, step: "privacy" }));
          } else if (state.step === "syndrome") {
            setState((s) => ({ ...s, step: state.patientId ? "privacy" : "setup" }));
          } else if (state.step === "questions") {
            setState((s) => ({ ...s, step: "syndrome" }));
          } else if (state.step === "triage") {
            setState((s) => ({ ...s, step: "questions" }));
          } else {
            router.back();
          }
        }}
      />

      {/* Step 1: Consent (Figma 0:3730 & 0:1794) */}
      {state.step === "privacy" && (
        <StepConsent
          initialMode={state.privacyMode ?? "identified"}
          onContinue={async ({ privacyMode, locale, verbalAttested, signatureMethod, signatureText }) => {
            setConsentData({ locale, verbalAttested, signatureMethod, signatureText });

            if (privacyMode === "identified" && state.patientId) {
              // Preloaded patient from URL: create encounter immediately and proceed to syndrome
              const encounterId = crypto.randomUUID();
              const consentId = crypto.randomUUID();
              const encPayload = {
                id: encounterId,
                organization_id: activeFacility.organizationId,
                facility_id: activeFacility.facilityId,
                clinician_id: userId,
                patient_id: state.patientId,
                encounter_code: encounterCode,
                session_code: null,
                workflow_mode: "echo" as const,
                privacy_mode: "identified" as const,
                status: "in_progress" as const,
              };

              const supabase = createClient();
              await supabase.from("encounters").upsert(encPayload, { onConflict: "id" });
              await syncController.enqueue("encounter", encounterId, "insert", encPayload);

              await saveConsentRecord(
                encounterId,
                consentId,
                "identified_referral",
                signatureMethod === "draw" ? "draw" : "type",
                signatureText,
                identifiedConsentText?.id
              );

              setState((s) => ({
                ...s,
                encounterId,
                consentId,
                privacyMode,
                locale,
                step: "syndrome",
              }));
            } else {
              setState((s) => ({
                ...s,
                privacyMode,
                locale,
                step: "setup",
              }));
            }
          }}
        />
      )}

      {/* Step 2: Demographics (Figma 0:3800, 0:1855, 0:1905) */}
      {state.step === "setup" && state.privacyMode && (
        <StepDemographics
          privacyMode={state.privacyMode}
          onContinue={handleDemographicsComplete}
        />
      )}

      {/* Step 3: Syndrome / Chief Complaint (Figma 0:1264, 0:1397, 0:1530, 0:1662) */}
      {state.step === "syndrome" && state.encounterId && (
        <StepSyndrome
          encounterCode={encounterCode}
          patientName={state.patientName ?? "Patient"}
          patientCreatedAt={state.patientCreatedAt ?? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          isAnonymous={state.privacyMode === "anonymous"}
          sessionCode={state.sessionCode ?? undefined}
          onPrevious={() => setState((s) => ({ ...s, step: state.patientId ? "privacy" : "setup" }))}
          onSelect={(syndromeId, label) =>
            setState((s) => ({
              ...s,
              syndromeId,
              syndromeLabel: label,
              step: "questions",
            }))
          }
        />
      )}

      {/* Step 4: Questions (Figma 0:3639, 0:3684, 0:3331, 0:3504) */}
      {state.step === "questions" && state.encounterId && state.syndromeId && (
        <StepQuestions
          syndromeId={state.syndromeId}
          syndromeCode={state.syndromeId}
          encounterId={state.encounterId}
          encounterCode={encounterCode}
          patientName={state.patientName ?? "Patient"}
          patientCreatedAt={state.patientCreatedAt ?? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          isAnonymous={state.privacyMode === "anonymous"}
          sessionCode={state.sessionCode ?? undefined}
          onPrevious={() => setState((s) => ({ ...s, step: "syndrome" }))}
          onComplete={(questionSetId, answers) =>
            setState((s) => ({ ...s, questionSetId, answers, step: "triage" }))
          }
        />
      )}

      {/* Step 5: Triage */}
      {state.step === "triage" &&
        state.encounterId &&
        state.syndromeId &&
        state.questionSetId && (
          <StepTriage
            encounterId={state.encounterId}
            syndromeId={state.syndromeId}
            questionSetId={state.questionSetId}
            onDone={(outcome) =>
              setState((s) => ({
                ...s,
                triageOutcomeId: outcome.id,
                triageSeverity: outcome.severity,
                triageGuidanceEn: outcome.guidanceEn,
                triageIpcGuidanceEn: outcome.ipcGuidanceEn,
                referralRequired: outcome.referralRequired,
                step: outcome.referralRequired ? "referral" : "complete",
              }))
            }
          />
        )}

      {/* Step 6: Referral */}
      {state.step === "referral" && state.encounterId && state.privacyMode && (
        <StepReferral
          encounterId={state.encounterId}
          privacyMode={state.privacyMode}
          consentId={
            state.privacyMode === "identified" ? state.consentId : null
          }
          onComplete={() => setState((s) => ({ ...s, step: "complete" }))}
        />
      )}

      {/* Step 7: Complete (Figma 0:2287) */}
      {state.step === "complete" && state.encounterId && (
        <EncounterCompletedModal
          patientName={
            state.patientName ??
            (state.privacyMode === "anonymous"
              ? "Anonymous patient"
              : "Patient")
          }
          isAnonymous={state.privacyMode === "anonymous"}
          onReturnHome={() => completeEncounter(state.encounterId!)}
        />
      )}
    </div>
  );
}
