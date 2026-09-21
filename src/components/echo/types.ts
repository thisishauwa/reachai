import type { PrivacyMode, TriageSeverity } from "@/lib/supabase/database.types";

export type EchoStep =
  | "privacy"
  | "setup"
  | "syndrome"
  | "questions"
  | "triage"
  | "referral"
  | "complete";

export interface EchoEncounterState {
  step: EchoStep;
  encounterId: string | null;
  encounterDependsOn: string[];
  privacyMode: PrivacyMode | null;
  patientId: string | null;
  patientName?: string | null;
  patientCreatedAt?: string | null;
  locale?: "en" | "ha";
  sessionCode: string | null;
  consentId: string | null;
  syndromeId: string | null;
  syndromeLabel: string | null;
  questionSetId: string | null;
  answers: Record<string, unknown>;
  triageOutcomeId: string | null;
  triageSeverity: TriageSeverity | null;
  triageGuidanceEn: string | null;
  triageIpcGuidanceEn: string | null;
  referralRequired: boolean;
  referralId: string | null;
  referralCode: string | null;
}

export const INITIAL_ECHO_STATE: EchoEncounterState = {
  step: "privacy",
  encounterId: null,
  encounterDependsOn: [],
  privacyMode: null,
  patientId: null,
  sessionCode: null,
  consentId: null,
  syndromeId: null,
  syndromeLabel: null,
  questionSetId: null,
  answers: {},
  triageOutcomeId: null,
  triageSeverity: null,
  triageGuidanceEn: null,
  triageIpcGuidanceEn: null,
  referralRequired: false,
  referralId: null,
  referralCode: null,
};
