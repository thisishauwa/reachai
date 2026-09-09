import { describe, expect, it } from "vitest";
import { canTransitionReferral } from "../referral-state-machine";

describe("canTransitionReferral", () => {
  const destination = { isSourceMember: false, isDestinationMember: true };
  const source = { isSourceMember: true, isDestinationMember: false };

  it("allows Created -> Arrived only for destination staff", () => {
    expect(canTransitionReferral("created", "arrived", destination).allowed).toBe(true);
    expect(canTransitionReferral("created", "arrived", source).allowed).toBe(false);
  });

  it("disallows Closed before Arrived", () => {
    expect(canTransitionReferral("created", "closed", destination).allowed).toBe(false);
  });

  it("allows Arrived -> Closed only for destination staff", () => {
    expect(canTransitionReferral("arrived", "closed", destination).allowed).toBe(true);
    expect(canTransitionReferral("arrived", "closed", source).allowed).toBe(false);
  });

  it("requires a reason to cancel", () => {
    expect(canTransitionReferral("created", "cancelled", source, "").allowed).toBe(false);
    expect(canTransitionReferral("created", "cancelled", source, "Duplicate entry").allowed).toBe(
      true
    );
  });

  it("disallows any transition out of a terminal state", () => {
    expect(canTransitionReferral("closed", "cancelled", destination, "reason").allowed).toBe(
      false
    );
    expect(canTransitionReferral("cancelled", "arrived", destination).allowed).toBe(false);
  });
});
