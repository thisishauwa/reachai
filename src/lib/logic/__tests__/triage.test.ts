import { describe, expect, it } from "vitest";
import { selectTriageOutcome, type TriageRuleLike } from "../triage";

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
