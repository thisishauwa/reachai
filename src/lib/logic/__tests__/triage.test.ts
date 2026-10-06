import { describe, expect, it } from "vitest";
import {
  selectTriageOutcome,
  evaluateClinicalTriage,
  evaluateMultiSyndromeTriage,
  type TriageRuleLike,
} from "../triage";
import { getFollowUpQuestions } from "../../reference/syndrome-questions";

const emergencyCholera: TriageRuleLike = {
  id: "rule-emergency",
  severity: "emergency",
  priority: 10,
  condition_code: "SUSPECTED_CHOLERA_DEMO",
  referral_required: true,
  conditions: [
    { question_code: "IS_DEHYDRATED", op: "is_true" },
    { question_code: "MANY_EPISODES", op: "is_true" },
  ],
};

const routineDiarrhoea: TriageRuleLike = {
  id: "rule-routine",
  severity: "routine",
  priority: 0,
  condition_code: "MILD_DIARRHOEA_DEMO",
  referral_required: false,
  conditions: [{ question_code: "MANY_EPISODES", op: "answered" }],
};

describe("selectTriageOutcome", () => {
  it("returns null when no rule matches", () => {
    expect(selectTriageOutcome([emergencyCholera, routineDiarrhoea], {})).toBeNull();
  });

  it("prefers a higher-severity match even if a lower-priority rule also matches", () => {
    const inputs = { IS_DEHYDRATED: true, MANY_EPISODES: true };
    const outcome = selectTriageOutcome([routineDiarrhoea, emergencyCholera], inputs);
    expect(outcome?.id).toBe("rule-emergency");
  });

  it("falls back to a routine match when the emergency condition is not met", () => {
    const inputs = { MANY_EPISODES: true };
    const outcome = selectTriageOutcome([emergencyCholera, routineDiarrhoea], inputs);
    expect(outcome?.id).toBe("rule-routine");
  });

  it("orders same-severity rules by priority descending", () => {
    const low: TriageRuleLike = { ...routineDiarrhoea, id: "low", priority: 0 };
    const high: TriageRuleLike = { ...routineDiarrhoea, id: "high", priority: 5 };
    const outcome = selectTriageOutcome([low, high], { MANY_EPISODES: true });
    expect(outcome?.id).toBe("high");
  });
});

describe("evaluateClinicalTriage", () => {
  it("triggers emergency referral when AWD symptoms are yes and yes (dire dehydration)", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_EPISODES: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionCode).toBe("AWD_CHOLERA_SEVERE");
    expect(outcome.ipcGuidanceEn).not.toBeNull();
  });

  it("triggers urgent referral when at least one AWD symptom is yes", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("does NOT trigger referral when all symptoms are no (routine)", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "no",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.severity).toBe("routine");
  });

  it("triggers emergency referral for fever with spontaneous bleeding", () => {
    const outcome = evaluateClinicalTriage("FEVER_BLEEDING", {
      FB_SPONTANEOUS_BLEEDING: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.ipcGuidanceEn).toContain("FULL PPE REQUIRED");
  });

  it("triggers urgent referral when two generic affirmative answers are present", () => {
    const outcome = evaluateClinicalTriage("OTHER_PRIORITY", {
      OP_DURATION: "yes",
      OP_SEVERE_PAIN: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("escalates to emergency when symptom severity is rated severe", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_DEHYDRATION_severity: "severe",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
  });

  it("escalates to urgent referral when symptom severity is rated moderate", () => {
    const outcome = evaluateClinicalTriage("ACUTE_RESPIRATORY", {
      ARI_FAST_BREATHING: "yes",
      ARI_FAST_BREATHING_severity: "moderate",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("diagnoses Suspected Acute Bacterial Meningitis when neck stiffness syndrome is selected even with no extra sub-symptoms", () => {
    const outcome = evaluateClinicalTriage("FEVER_NECK_STIFFNESS", {
      FNS_NECK_RIGIDITY: "no",
      FNS_ALTERED_CONSCIOUSNESS: "no",
      FNS_PHOTOPHOBIA: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
    expect(outcome.conditionCode).toBe("SUSPECTED_MENINGITIS");
    expect(outcome.conditionLabelEn).toBe("Suspected Acute Bacterial Meningitis");
  });

  it("escalates to emergency meningitis when altered consciousness or severe rating is present", () => {
    const outcome = evaluateClinicalTriage("FEVER_NECK_STIFFNESS", {
      FNS_NECK_RIGIDITY: "yes",
      FNS_ALTERED_CONSCIOUSNESS: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionCode).toBe("SUSPECTED_MENINGITIS");
  });
});

describe("evaluateMultiSyndromeTriage", () => {
  it("selects the most severe outcome when multiple syndromes are selected", () => {
    // Syndrome 1: Routine AWD
    // Syndrome 2: Emergency Fever with bleeding
    const outcome = evaluateMultiSyndromeTriage(
      ["ACUTE_WATERY_DIARRHOEA", "FEVER_BLEEDING"],
      {
        AWD_DEHYDRATION: "no",
        AWD_EPISODES: "no",
        FB_SPONTANEOUS_BLEEDING: "yes",
      }
    );
    expect(outcome.severity).toBe("emergency");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toBe("SUSPECTED_VHF");
  });

  it("returns routine care with no referral when only normal symptoms (fever) are present", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, ["FEVER"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("UNCOMPLICATED_FEVER");
    expect(outcome.conditionLabelEn).toContain("Uncomplicated Febrile Illness");
  });

  it("returns routine care with no referral when normal cough is present", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, ["COUGH"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("MILD_COUGH_URI");
  });

  it("returns routine care when no danger signs and empty general symptoms are submitted", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, []);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("ROUTINE_CARE");
  });
});

describe("getFollowUpQuestions (Hardcoded Symptom Questions)", () => {
  it("returns exact VHF questions for BLEEDING", () => {
    const questions = getFollowUpQuestions("BLEEDING");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "FB_SPONTANEOUS_BLEEDING")).toBe(true);
  });

  it("returns exact Meningitis questions for NECK_STIFFNESS", () => {
    const questions = getFollowUpQuestions("NECK_STIFFNESS");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "FNS_NECK_RIGIDITY")).toBe(true);
  });

  it("returns exact AWD questions for DIARRHEA", () => {
    const questions = getFollowUpQuestions("DIARRHEA");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "AWD_DEHYDRATION")).toBe(true);
  });

  it("returns EMPTY array for normal symptoms like FEVER (never defaults to AWD or bleeding)", () => {
    const questions = getFollowUpQuestions("FEVER");
    expect(questions).toEqual([]);
  });

  it("returns EMPTY array for empty string", () => {
    const questions = getFollowUpQuestions("");
    expect(questions).toEqual([]);
  });
});



