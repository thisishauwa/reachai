import { describe, expect, it } from "vitest";
import { COMPLAINT_QUESTION_SETS, visibleComplaintQuestions } from "../complaint-questions";

describe("complaint question sets", () => {
  it("contains the specified number of questions in A-F", () => {
    expect(Object.fromEntries(Object.entries(COMPLAINT_QUESTION_SETS).map(([key, value]) => [key, value.length]))).toEqual({
      A: 8,
      B: 7,
      C: 7,
      D: 6,
      E: 6,
      F: 5,
    });
  });

  it("adds B1-B4 only when A7 is Yes", () => {
    expect(visibleComplaintQuestions("A", { DIARRHOEA_OR_VOMITING: "no" })).toHaveLength(8);
    const visible = visibleComplaintQuestions("A", { DIARRHOEA_OR_VOMITING: "yes" });
    expect(visible.filter((item) => item.bridgeFrom === "A7").map((item) => item.id)).toEqual(["B1", "B2", "B3", "B4"]);
  });

  it("adds cough E1, E3 and E4 only when A8 is Yes", () => {
    const visible = visibleComplaintQuestions("A", { COUGH_PRESENT: "yes" });
    expect(visible.filter((item) => item.bridgeFrom === "A8").map((item) => item.id)).toEqual(["cough E1", "cough E3", "cough E4"]);
  });

  it("stores yes/no fever once while keeping A1 fever duration distinct", () => {
    expect(COMPLAINT_QUESTION_SETS.A[0].answerKey).toBe("FEVER_DURATION");
    const feverKeys = ["C", "D", "E", "F"].map((area) =>
      COMPLAINT_QUESTION_SETS[area as keyof typeof COMPLAINT_QUESTION_SETS].find((item) => item.prompt_en.toLowerCase().includes("fever"))?.answerKey,
    );
    expect(new Set(feverKeys)).toEqual(new Set(["FEVER_PRESENT"]));
  });

  it("applies the age gates from v0.3", () => {
    expect(visibleComplaintQuestions("F", {}, "5_to_17").map((item) => item.id)).toEqual(["F1", "F2", "F4", "F5"]);
    expect(visibleComplaintQuestions("F", {}, "18_to_49").map((item) => item.id)).toEqual(["F2", "F4", "F5"]);
    expect(visibleComplaintQuestions("F", {}, "under_28_days").map((item) => item.id)).toContain("F3");
  });
});
