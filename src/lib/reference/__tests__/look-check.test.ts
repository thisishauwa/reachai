import { describe, expect, it } from "vitest";
import {
  dangerSignsFromCaregiverAnswers,
  complaintAreaForL8Answers,
  emergencyVariantForSign,
  highestPrioritySign,
  visibleCaregiverQuestions,
  visibleLookCheckSigns,
} from "../look-check";

describe("look-check routing", () => {
  it("shows L7 only for newborns", () => {
    expect(visibleLookCheckSigns("under_28_days").map((sign) => sign.code)).toContain("L7");
    expect(visibleLookCheckSigns("under_1_year").map((sign) => sign.code)).not.toContain("L7");
    expect(visibleCaregiverQuestions("under_28_days").map((question) => question.code)).toContain("L7");
  });

  it("uses the specified priority when several signs are present", () => {
    expect(highestPrioritySign(["L5", "L3"])).toBe("L3");
    expect(highestPrioritySign(["L8", "L7", "L1"])).toBe("L7");
  });

  it("treats No as the danger answer for ability to stand or drink", () => {
    expect(dangerSignsFromCaregiverAnswers({ L4: "no" })).toContain("L4");
    expect(dangerSignsFromCaregiverAnswers({ L4: "yes" })).not.toContain("L4");
  });

  it("provides every L1-L8 emergency variant and three L8 questions", () => {
    expect(emergencyVariantForSign("L1").id).toBe("neurologic");
    expect(emergencyVariantForSign("L2").id).toBe("neurologic");
    expect(emergencyVariantForSign("L4").id).toBe("collapse");
    expect(emergencyVariantForSign("L3").id).toBe("bleeding");
    expect(emergencyVariantForSign("L5").id).toBe("jaundice");
    expect(emergencyVariantForSign("L6").id).toBe("breathing");
    expect(emergencyVariantForSign("L7").id).toBe("newborn");
    expect(emergencyVariantForSign("L8").questions).toHaveLength(3);
  });

  it("uses the exact v0.3 emergency question IDs", () => {
    expect(emergencyVariantForSign("L5").questions.map((question) => question.code)).toEqual(["E1", "E2", "E3", "E4"]);
    expect(emergencyVariantForSign("L3").questions.map((question) => question.code)).toEqual(["E5", "E6", "E7", "E8"]);
    expect(emergencyVariantForSign("L1").questions.map((question) => question.code)).toEqual(["E9", "E10", "E11", "E12"]);
    expect(emergencyVariantForSign("L2").questions.map((question) => question.code)).toEqual(["E9", "E10", "E11", "E12"]);
    expect(emergencyVariantForSign("L4").questions.map((question) => question.code)).toEqual(["E13", "E14", "E15", "E16"]);
    expect(emergencyVariantForSign("L6").questions.map((question) => question.code)).toEqual(["E17", "E18", "E19", "E20"]);
    expect(emergencyVariantForSign("L7").questions.map((question) => question.code)).toEqual(["E21", "E22", "E23", "E24"]);
    expect(emergencyVariantForSign("L8").questions.map((question) => question.code)).toEqual(["E25", "E26", "E27"]);
  });

  it("matches Journey 11 by routing L8 fever into set A while leaving all-negative L8 unclassified", () => {
    expect(complaintAreaForL8Answers({ E25: "yes", E26: "no", E27: "no" })).toBe("A");
    expect(complaintAreaForL8Answers({ E25: "no", E26: "yes", E27: "no" })).toBe("B");
    expect(complaintAreaForL8Answers({ E25: "no", E26: "no", E27: "yes" })).toBe("C");
    expect(complaintAreaForL8Answers({ E25: "no", E26: "no", E27: "no" })).toBeNull();
  });
});
