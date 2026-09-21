"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { generateEncounterCode } from "@/lib/reference/codes";
import { usePatient } from "@/lib/queries/patients";
import { EncounterHeader } from "@/components/echo/encounter-header";
import { StepPatient } from "@/components/reach/step-patient";
import { StepHistory } from "@/components/reach/step-history";
import { StepExamination } from "@/components/reach/step-examination";
import { StepAssessment } from "@/components/reach/step-assessment";
import { StepReview } from "@/components/reach/step-review";
import { INITIAL_REACH_STATE, type ReachEncounterState, type ReachStep } from "@/lib/reach/types";

export default function NewReachEncounterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const [state, setState] = useState<ReachEncounterState>(INITIAL_REACH_STATE);
  const [encounterCode] = useState(() => generateEncounterCode());

  const urlPatientId = searchParams.get("patientId");
  const { data: preloadedPatient } = usePatient(urlPatientId || undefined);

  async function selectPatient(patientId: string, patientName: string) {
    const encounterId = crypto.randomUUID();
    const encounterPayload = {
      id: encounterId,
      organization_id: activeFacility.organizationId,
      facility_id: activeFacility.facilityId,
      clinician_id: userId,
      patient_id: patientId,
      encounter_code: encounterCode,
      session_code: null,
      workflow_mode: "reach" as const,
      privacy_mode: "identified" as const,
      status: "in_progress" as const,
    };

    const supabase = createClient();
    await supabase.from("encounters").upsert(encounterPayload, { onConflict: "id" });
    await syncController.enqueueAndSync("encounter", encounterId, "insert", encounterPayload);

    setState((s) => ({ ...s, encounterId, patientId, patientName, step: "history" }));
  }

  useEffect(() => {
    if (preloadedPatient && !state.patientId) {
      selectPatient(preloadedPatient.id, preloadedPatient.full_name);
    }
  }, [preloadedPatient, state.patientId]);

  async function submitAll() {
    if (!state.encounterId) return;
    const encounterId = state.encounterId;

    await syncController.enqueueAndSync("clinical_notes", encounterId, "insert", {
      encounter_id: encounterId,
      chief_complaint: state.chiefComplaint,
      past_medical_history: state.pastMedicalHistory,
      physical_examination: state.physicalExamination,
      updated_by: userId,
    });

    for (const lab of state.labs) {
      await syncController.enqueueAndSync("encounter_lab_test", lab.labTestId, "insert", {
        id: lab.labTestId,
        encounter_id: encounterId,
        lab_test_definition_id: lab.labTestDefinitionId,
        ordered_by: userId,
        status: "resulted",
      });
      for (const [key, value] of Object.entries(lab.results)) {
        const resultId = crypto.randomUUID();
        await syncController.enqueueAndSync("encounter_lab_result", resultId, "insert", {
          id: resultId,
          encounter_lab_test_id: lab.labTestId,
          component_id: key === "value" ? null : key,
          value,
          resulted_by: userId,
          resulted_at: new Date().toISOString(),
        });
      }
    }

    const diagnosisId = crypto.randomUUID();
    await syncController.enqueueAndSync("encounter_diagnosis", diagnosisId, "insert", {
      id: diagnosisId,
      encounter_id: encounterId,
      diagnosis_label: state.diagnosisLabel,
      is_primary: true,
      recorded_by: userId,
    });

    await syncController.enqueueAndSync("treatment_plan", encounterId, "insert", {
      encounter_id: encounterId,
      plan_text: state.treatmentPlan || "No treatment plan recorded",
      recorded_by: userId,
    });

    if (state.requiresPrescription) {
      for (const p of state.prescriptions) {
        await syncController.enqueueAndSync("prescription", p.id, "insert", {
          id: p.id,
          encounter_id: encounterId,
          medication_name: p.medicationName,
          dose: p.dose || null,
          route: p.route || null,
          frequency: p.frequency || null,
          duration: p.duration || null,
          instructions: p.instructions || null,
          prescribed_by: userId,
        });
      }
    }

    const completedAt = new Date().toISOString();
    const supabase = createClient();

    const encounterRecord = {
      id: encounterId,
      organization_id: activeFacility.organizationId,
      facility_id: activeFacility.facilityId,
      clinician_id: userId,
      patient_id: state.patientId,
      session_code: null,
      encounter_code: encounterCode,
      workflow_mode: "reach" as const,
      privacy_mode: "identified" as const,
      status: "completed" as const,
      completed_at: completedAt,
    };

    // Save directly to Supabase encounters table
    const { error: encError } = await supabase
      .from("encounters")
      .upsert(encounterRecord, { onConflict: "id" });

    if (encError) {
      console.error("Direct encounter upsert error:", encError);
    }

    await syncController.enqueueAndSync("encounter", encounterId, "insert", encounterRecord);
    await syncController.enqueueAndSync("encounter_status", encounterId, "update", {
      id: encounterId,
      status: "completed",
      completed_at: completedAt,
    });

    await queryClient.invalidateQueries({ queryKey: ["encounters"] });
    await queryClient.invalidateQueries({ queryKey: ["referrals"] });
    toast.success("Encounter completed and saved");
    router.push("/home");
  }

  return (
    <div className="w-full flex flex-col gap-2 pb-12">
      <EncounterHeader
        onBack={() => {
          if (state.step === "history") {
            setState((s) => ({ ...s, step: "patient" }));
          } else if (state.step === "examination") {
            setState((s) => ({ ...s, step: "history" }));
          } else if (state.step === "assessment") {
            setState((s) => ({ ...s, step: "examination" }));
          } else if (state.step === "review") {
            setState((s) => ({ ...s, step: "assessment" }));
          } else {
            router.back();
          }
        }}
      />
      {state.step === "patient" && <StepPatient onSelect={selectPatient} />}

      {state.step === "history" && (
        <StepHistory
          initialValue={state.chiefComplaint}
          onContinue={(chiefComplaint) => setState((s) => ({ ...s, chiefComplaint, step: "examination" }))}
        />
      )}

      {state.step === "examination" && (
        <StepExamination
          initialHistory={state.pastMedicalHistory}
          initialExam={state.physicalExamination}
          onContinue={(pastMedicalHistory, physicalExamination) =>
            setState((s) => ({ ...s, pastMedicalHistory, physicalExamination, step: "assessment" }))
          }
        />
      )}

      {state.step === "assessment" && (
        <StepAssessment
          initial={{
            requiresPrescription: state.requiresPrescription,
            labs: state.labs,
            diagnosisLabel: state.diagnosisLabel,
            treatmentPlan: state.treatmentPlan,
            prescriptions: state.prescriptions,
          }}
          onContinue={(values) => setState((s) => ({ ...s, ...values, step: "review" }))}
        />
      )}

      {state.step === "review" && (
        <StepReview
          state={state}
          onEdit={(step: ReachStep) => setState((s) => ({ ...s, step }))}
          onSubmit={submitAll}
        />
      )}
    </div>
  );
}
