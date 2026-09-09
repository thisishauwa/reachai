import { describe, expect, it } from "vitest";
import {
  evaluateConditions,
  findSupersededAnswerCodes,
  resolveVisibleQuestions,
  shouldShowQuestion,
} from "../conditions";

describe("shouldShowQuestion", () => {
  it("shows a question with no show_when by default", () => {
    expect(shouldShowQuestion(null, {})).toBe(true);
    expect(shouldShowQuestion([], {})).toBe(true);
  });

  it("hides a question until its dependency answer matches", () => {
    const showWhen = [{ question_code: "HAS_COUGH", op: "is_true" as const }];
    expect(shouldShowQuestion(showWhen, {})).toBe(false);
    expect(shouldShowQuestion(showWhen, { HAS_COUGH: false })).toBe(false);
    expect(shouldShowQuestion(showWhen, { HAS_COUGH: true })).toBe(true);
  });

  it("combines multiple clauses with AND", () => {
    const showWhen = [
      { question_code: "IS_DEHYDRATED", op: "is_true" as const },
      { question_code: "DEHYDRATION_SEVERITY", op: "gte" as const, value: 5 },
    ];
    expect(shouldShowQuestion(showWhen, { IS_DEHYDRATED: true, DEHYDRATION_SEVERITY: 3 })).toBe(
      false
    );
    expect(shouldShowQuestion(showWhen, { IS_DEHYDRATED: true, DEHYDRATION_SEVERITY: 7 })).toBe(
      true
    );
  });
});

describe("evaluateConditions (triage rule clauses)", () => {
  it("never matches an empty condition list", () => {
    expect(evaluateConditions([], { anything: true })).toBe(false);
    expect(evaluateConditions(null, {})).toBe(false);
  });

  it("requires every clause to pass", () => {
    const conditions = [
      { question_code: "HAS_RASH", op: "is_true" as const },
      { question_code: "FEVER_DAYS", op: "gte" as const, value: 3 },
    ];
    expect(evaluateConditions(conditions, { HAS_RASH: true, FEVER_DAYS: 2 })).toBe(false);
    expect(evaluateConditions(conditions, { HAS_RASH: true, FEVER_DAYS: 3 })).toBe(true);
  });

  it("supports the 'in' operator against select answers", () => {
    const conditions = [{ question_code: "COLOUR", op: "in" as const, value: ["amber", "other"] }];
    expect(evaluateConditions(conditions, { COLOUR: "pale_yellow" })).toBe(false);
    expect(evaluateConditions(conditions, { COLOUR: "amber" })).toBe(true);
  });
});

describe("resolveVisibleQuestions / findSupersededAnswerCodes", () => {
  const questions = [
    { code: "HAS_COUGH", display_order: 10, show_when: null },
    {
      code: "COUGH_DURATION_DAYS",
      display_order: 20,
      show_when: [{ question_code: "HAS_COUGH", op: "is_true" as const }],
    },
  ];

  it("hides downstream questions when the upstream answer changes", () => {
    let answers = { HAS_COUGH: true, COUGH_DURATION_DAYS: 5 };
    expect(resolveVisibleQuestions(questions, answers).map((q) => q.code)).toEqual([
      "HAS_COUGH",
      "COUGH_DURATION_DAYS",
    ]);

    answers = { HAS_COUGH: false, COUGH_DURATION_DAYS: 5 };
    expect(resolveVisibleQuestions(questions, answers).map((q) => q.code)).toEqual(["HAS_COUGH"]);
    expect(findSupersededAnswerCodes(questions, answers)).toEqual(["COUGH_DURATION_DAYS"]);
  });
});
