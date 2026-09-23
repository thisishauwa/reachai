import { describe, expect, it } from "vitest";
import { selectTriageOutcome, evaluateClinicalTriage, type TriageRuleLike } from "../triage";

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
});

