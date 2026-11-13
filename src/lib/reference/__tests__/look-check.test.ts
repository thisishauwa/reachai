import { describe, expect, it } from "vitest";
import {
  dangerSignsFromCaregiverAnswers,
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

  it("provides the four in-scope variants and three L8 questions", () => {
    expect(emergencyVariantForSign("L1").id).toBe("collapse");
    expect(emergencyVariantForSign("L3").id).toBe("bleeding");
    expect(emergencyVariantForSign("L5").id).toBe("jaundice");
    expect(emergencyVariantForSign("L8").questions).toHaveLength(3);
  });
});
