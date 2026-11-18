import { describe, expect, it } from "vitest";
import {
  nextStepAfterComplaint,
  nextStepAfterDetails,
  referralStatusForOutcome,
  requestLogPayload,
  triageRulesetSnapshot,
} from "../written-journey-flow";

describe("written patient journey routing", () => {
  it("persists the Step 1 request against the encounter", () => {
    expect(requestLogPayload("encounter-1", "cough_syrup", "user-1")).toEqual({
      encounter_id: "encounter-1",
      chief_complaint: "cough_syrup",
      past_medical_history: null,
      physical_examination: null,
      updated_by: "user-1",
    });
  });

  it("matches Journey 1: jaundice captures the complaint after consent, then goes to result", () => {
    expect(nextStepAfterDetails({
      primaryDangerSignCode: "L5",
      hasDangerSign: true,
      complaintAreaCaptured: false,
    })).toBe("complaint");
    expect(nextStepAfterComplaint(true)).toBe("triage");
  });

  it("matches Journey 2: bleeding proceeds from consent to result without inventing another screen", () => {
    expect(nextStepAfterDetails({
      primaryDangerSignCode: "L3",
      hasDangerSign: true,
      complaintAreaCaptured: false,
    })).toBe("triage");
  });

  it("matches Journey 11: L8 enters its routed complaint question set", () => {
    expect(nextStepAfterDetails({
      primaryDangerSignCode: "L8",
      hasDangerSign: true,
      complaintAreaCaptured: true,
    })).toBe("complaint_questions");
  });

  it("matches Journeys 7 and 12: refusal keeps the code live while vendor decline cancels it", () => {
    expect(referralStatusForOutcome("refused")).toBe("created");
    expect(referralStatusForOutcome("not_referred")).toBe("cancelled");
  });

  it("matches Journeys 9 and 10: notification and every category survive persistence", () => {
    expect(triageRulesetSnapshot("AFP_PATTERN")).toEqual({
      matched_category_codes: ["AFP_PATTERN"],
      surveillance_notification: {
        required: true,
        urgency: "immediate",
        status: "flagged",
      },
    });
    expect(triageRulesetSnapshot("CHOLERA_PATTERN+TYPHOID_PATTERN")).toEqual({
      matched_category_codes: ["CHOLERA_PATTERN", "TYPHOID_PATTERN"],
    });
  });
});
