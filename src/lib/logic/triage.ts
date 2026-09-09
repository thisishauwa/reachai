import { evaluateConditions, type AnswerMap, type Condition } from "./conditions";
import type { TriageSeverity } from "@/lib/supabase/database.types";

/**
 * Client-side mirror of the rule-selection logic inside the
 * `evaluate_triage` Postgres function. Used for optimistic/offline preview
 * and unit-tested directly; the database function remains the sole
 * authority for the persisted `triage_outcomes` row.
 */

export interface TriageRuleLike {
  id: string;
  severity: TriageSeverity;
  priority: number;
  condition_code: string;
  conditions: Condition[];
  referral_required: boolean;
}

const SEVERITY_RANK: Record<TriageSeverity, number> = {
  emergency: 3,
  urgent: 2,
  routine: 1,
  none: 0,
};

/**
 * Selects the highest-priority matching rule. Priority order is
 * severity (Emergency > Urgent > Routine) first, then the rule's own
 * `priority` field, matching `private.severity_rank` + `order by priority
 * desc` in the SQL function.
 */
export function selectTriageOutcome<T extends TriageRuleLike>(
  rules: T[],
  inputs: AnswerMap
): T | null {
  const sorted = [...rules].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.priority - a.priority;
  });

  for (const rule of sorted) {
    if (evaluateConditions(rule.conditions, inputs)) {
      return rule;
    }
  }
  return null;
}
