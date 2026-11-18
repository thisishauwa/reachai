import type { ReferralStatus } from "@/lib/supabase/database.types";

export type WrittenJourneyStep =
  | "complaint"
  | "complaint_questions"
  | "triage";

export type ReferralOutcomeChoice = "referred" | "refused" | "not_referred";

export function nextStepAfterDetails(input: {
  primaryDangerSignCode: string | null;
  hasDangerSign: boolean;
  complaintAreaCaptured: boolean;
}): WrittenJourneyStep {
  if (input.primaryDangerSignCode === "L8" && input.complaintAreaCaptured) {
    return "complaint_questions";
  }
  if (input.hasDangerSign) return "triage";
  return "complaint";
}

export function nextStepAfterComplaint(hasDangerSign: boolean): WrittenJourneyStep {
  return hasDangerSign ? "triage" : "complaint_questions";
}

/**
 * A refused referral keeps its issued code live, as Journey 7 says the patient
 * can still use it later. A vendor decision not to refer (Journey 12) remains a
 * cancelled recommendation with the override recorded separately.
 */
export function referralStatusForOutcome(outcome: ReferralOutcomeChoice): ReferralStatus {
  return outcome === "not_referred" ? "cancelled" : "created";
}

export function triageRulesetSnapshot(conditionCode: string): Record<string, unknown> {
  const categoryCodes = conditionCode.split("+").filter(Boolean);
  const needsImmediateNotification = categoryCodes.some((code) => code.includes("AFP"));

  return {
    matched_category_codes: categoryCodes,
    ...(needsImmediateNotification
      ? {
          surveillance_notification: {
            required: true,
            urgency: "immediate",
            status: "flagged",
          },
        }
      : {}),
  };
}

export function requestLogPayload(encounterId: string, requestType: string, userId: string) {
  return {
    encounter_id: encounterId,
    chief_complaint: requestType,
    past_medical_history: null,
    physical_examination: null,
    updated_by: userId,
  };
}
