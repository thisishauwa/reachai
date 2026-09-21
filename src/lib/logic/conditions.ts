/**
 * Pure, framework-free evaluators for conditional logic used by both the
 * adaptive ECHO question form (`show_when`) and, mirrored 1:1, by the
 * `private.evaluate_conditions` Postgres function used inside
 * `evaluate_triage` (see supabase/migrations/20260101000001_functions.sql).
 *
 * Keeping this logic pure and duplicated-but-mirrored (rather than shared at
 * runtime) is intentional: the database function is the single source of
 * authority for triage, but the client needs the same semantics to decide
 * which questions are visible before the server is consulted, and so it can
 * be unit tested without a database.
 */

export type ConditionOp =
  | "eq"
  | "neq"
  | "gte"
  | "lte"
  | "gt"
  | "lt"
  | "in"
  | "is_true"
  | "is_false"
  | "answered";

export interface Condition {
  question_code: string;
  op?: ConditionOp;
  value?: unknown;
}

export type AnswerMap = Record<string, unknown>;

function toNumber(value: unknown): number {
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new Error(`Cannot compare non-numeric value: ${JSON.stringify(value)}`);
  }
  return n;
}

/** Evaluates a single condition clause against the current answer map. */
export function evaluateCondition(clause: Condition, inputs: AnswerMap): boolean {
  const op: ConditionOp = clause.op ?? "eq";
  const actual = inputs[clause.question_code];

  if (op === "answered") {
    return actual !== undefined && actual !== null;
  }
  if (actual === undefined || actual === null) {
    return false;
  }

  switch (op) {
    case "eq":
      return JSON.stringify(actual) === JSON.stringify(clause.value);
    case "neq":
      return JSON.stringify(actual) !== JSON.stringify(clause.value);
    case "gte":
      return toNumber(actual) >= toNumber(clause.value);
    case "lte":
      return toNumber(actual) <= toNumber(clause.value);
    case "gt":
      return toNumber(actual) > toNumber(clause.value);
    case "lt":
      return toNumber(actual) < toNumber(clause.value);
    case "in":
      return Array.isArray(clause.value) && clause.value.includes(actual as never);
    case "is_true":
      return actual === true;
    case "is_false":
      return actual === false;
    default:
      throw new Error(`Unsupported condition operator: ${op}`);
  }
}

/**
 * Normalizes raw condition values coming from JSONB columns (which may be
 * null, undefined, empty objects '{}', a single Condition object, or an array).
 */
export function normalizeConditions(raw: unknown): Condition[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as Condition[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeConditions(parsed);
    } catch {
      return [];
    }
  }
  if (typeof raw === "object") {
    if ("question_code" in raw && typeof (raw as Record<string, unknown>).question_code === "string") {
      return [raw as Condition];
    }
    return [];
  }
  return [];
}

/** All clauses in the array are combined with AND, matching the SQL function. */
export function evaluateConditions(
  conditions: Condition[] | unknown,
  inputs: AnswerMap
): boolean {
  const clauses = normalizeConditions(conditions);
  if (clauses.length === 0) {
    return false;
  }
  return clauses.every((clause) => evaluateCondition(clause, inputs));
}

/**
 * `show_when` on a question is empty/absent by default, meaning "always
 * shown". This differs from triage `conditions`, which must never match on
 * an empty array (a rule with no conditions should never fire).
 */
export function shouldShowQuestion(
  showWhen: Condition[] | unknown,
  inputs: AnswerMap
): boolean {
  const clauses = normalizeConditions(showWhen);
  if (clauses.length === 0) {
    return true;
  }
  return clauses.every((clause) => evaluateCondition(clause, inputs));
}

/**
 * Resolves the ordered list of currently-visible questions given all
 * questions in a set and the answers gathered so far. Mirrors the PRD
 * requirement that progress/triage must be based on the resolved visible
 * list, not every row in the database.
 */
export interface QuestionLike {
  code: string;
  display_order: number;
  show_when?: Condition[] | unknown;
}

export function resolveVisibleQuestions<T extends QuestionLike>(
  questions: T[],
  answers: AnswerMap
): T[] {
  return [...questions]
    .sort((a, b) => a.display_order - b.display_order)
    .filter((q) => shouldShowQuestion(q.show_when, answers));
}

/**
 * Given the full answer map and the resolved visible-question list, returns
 * the codes of any previously-answered questions that are no longer visible.
 * The caller should mark these superseded rather than delete them, and must
 * never pass them to triage.
 */
export function findSupersededAnswerCodes<T extends QuestionLike>(
  allQuestions: T[],
  answers: AnswerMap
): string[] {
  const visible = new Set(resolveVisibleQuestions(allQuestions, answers).map((q) => q.code));
  return Object.keys(answers).filter(
    (code) => allQuestions.some((q) => q.code === code) && !visible.has(code)
  );
}
