export type ReachStep = "patient" | "history" | "examination" | "assessment" | "review";

export interface ReachLabResultDraft {
  labTestDefinitionId: string;
  labTestId: string;
  code: string;
  nameEn: string;
  resultType: string;
  results: Record<string, unknown>; // component code -> value, or {"value": x} for simple types
}

export interface ReachPrescriptionDraft {
  id: string;
  medicationName: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface ReachEncounterState {
  step: ReachStep;
  encounterId: string | null;
  patientId: string | null;
  patientName: string | null;
  chiefComplaint: string;
  pastMedicalHistory: string;
  physicalExamination: string;
  requiresPrescription: boolean;
  labs: ReachLabResultDraft[];
  diagnosisLabel: string;
  treatmentPlan: string;
  prescriptions: ReachPrescriptionDraft[];
}

export const INITIAL_REACH_STATE: ReachEncounterState = {
  step: "patient",
  encounterId: null,
  patientId: null,
  patientName: null,
  chiefComplaint: "",
  pastMedicalHistory: "",
  physicalExamination: "",
  requiresPrescription: false,
  labs: [],
  diagnosisLabel: "",
  treatmentPlan: "",
  prescriptions: [],
};
