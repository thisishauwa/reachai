"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-context";
import { syncController } from "@/lib/offline/sync";
import { generateEncounterCode } from "@/lib/reference/codes";
import { StepPrivacyMode } from "@/components/echo/step-privacy-mode";
import { StepIdentifiedSetup } from "@/components/echo/step-identified-setup";
import { StepAnonymousSetup } from "@/components/echo/step-anonymous-setup";
import { StepSyndrome } from "@/components/echo/step-syndrome";
import { StepQuestions } from "@/components/echo/step-questions";
import { StepTriage } from "@/components/echo/step-triage";
import { StepReferral } from "@/components/echo/step-referral";
import {
  INITIAL_ECHO_STATE,
  type EchoEncounterState,
} from "@/components/echo/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export default function NewEchoEncounterPage() {
  const router = useRouter();
  const { activeFacility, userId } = useSession();
  const [state, setState] = useState<EchoEncounterState>(INITIAL_ECHO_STATE);
  const [encounterCode] = useState(() => generateEncounterCode());

  const createEncounter = useCallback(
    async (opts: {
      privacyMode: PrivacyMode;
      patientId?: string;
      sessionCode?: string;
    }) => {
      const encounterId = crypto.randomUUID();
      await syncController.enqueueAndSync("encounter", encounterId, "insert", {
        id: encounterId,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        clinician_id: userId,
        patient_id: opts.privacyMode === "identified" ? opts.patientId : null,
        encounter_code: encounterCode,
        session_code:
          opts.privacyMode === "anonymous" ? opts.sessionCode : null,
        workflow_mode: "echo",
        privacy_mode: opts.privacyMode,
        status: "in_progress",
      });
      return encounterId;
    },
    [activeFacility, userId, encounterCode],
  );

  async function completeEncounter(encounterId: string) {
    await syncController.enqueueAndSync(
      "encounter_status",
      encounterId,
      "update",
      {
        id: encounterId,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    );
    toast.success("Encounter completed");
    router.push("/encounters");
  }

  return (
    <div className="flex flex-col gap-4">
      {state.step === "privacy" && (
        <StepPrivacyMode
          onSelect={(mode) =>
            setState((s) => ({ ...s, privacyMode: mode, step: "setup" }))
          }
        />
      )}

      {state.step === "setup" && state.privacyMode === "identified" && (
        <StepIdentifiedSetup
          onCreateEncounter={(patientId) =>
            createEncounter({ privacyMode: "identified", patientId })
          }
          onComplete={(result) =>
            setState((s) => ({
              ...s,
              encounterId: result.encounterId,
              patientId: result.patientId,
              consentId: result.consentId,
              step: "syndrome",
            }))
          }
        />
      )}

      {state.step === "setup" && state.privacyMode === "anonymous" && (
        <StepAnonymousSetup
          onCreateEncounter={(sessionCode) =>
            createEncounter({ privacyMode: "anonymous", sessionCode })
          }
          onComplete={(result) =>
            setState((s) => ({
              ...s,
              encounterId: result.encounterId,
              sessionCode: result.sessionCode,
              consentId: result.consentId,
              step: "syndrome",
            }))
          }
        />
      )}

      {state.step === "syndrome" && state.encounterId && (
        <StepSyndrome
          encounterCode={encounterCode}
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

      {state.step === "questions" && state.encounterId && state.syndromeId && (
        <StepQuestions
          encounterId={state.encounterId}
          syndromeId={state.syndromeId}
          onComplete={(questionSetId, answers) =>
            setState((s) => ({ ...s, questionSetId, answers, step: "triage" }))
          }
        />
      )}

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

      {state.step === "complete" && state.encounterId && (
        <CompleteStep
          onComplete={() => completeEncounter(state.encounterId!)}
        />
      )}
    </div>
  );
}

function CompleteStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-base font-medium">
          Ready to complete this encounter
        </p>
        <p className="text-sm text-muted-foreground">
          Once completed, this encounter becomes read-only.
        </p>
        <Button className="w-full" onClick={onComplete}>
          Complete assessment
        </Button>
      </CardContent>
    </Card>
  );
}
