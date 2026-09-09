import type { ReferralStatus } from "@/lib/supabase/database.types";

/**
 * Client-side mirror of the transition rules enforced by the
 * `transition_referral` Postgres function. Used to disable/enable UI
 * actions and to unit test the state machine without a database.
 */

export interface ReferralActor {
  isSourceMember: boolean;
  isDestinationMember: boolean;
}

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

const VALID_FROM: Record<ReferralStatus, ReferralStatus[]> = {
  created: ["arrived", "cancelled"],
  arrived: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransitionReferral(
  from: ReferralStatus,
  to: ReferralStatus,
  actor: ReferralActor,
  reason?: string | null
): TransitionCheck {
  if (!VALID_FROM[from]?.includes(to)) {
    return { allowed: false, reason: `Cannot move a ${from} referral to ${to}` };
  }

  if (to === "arrived" || to === "closed") {
    if (!actor.isDestinationMember) {
      return {
        allowed: false,
        reason: "Only destination facility staff may perform this action",
      };
    }
  }

  if (to === "cancelled") {
    if (!actor.isSourceMember && !actor.isDestinationMember) {
      return { allowed: false, reason: "Not authorized for this referral" };
    }
    if (!reason || reason.trim().length === 0) {
      return { allowed: false, reason: "Cancellation requires a reason" };
    }
  }

  return { allowed: true };
}
