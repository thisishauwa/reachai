import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TriageBottomSheet } from "../triage-bottom-sheet";

describe("TriageBottomSheet", () => {
  it("shows a referral action for a Routine TB-screening result", () => {
    const onConfirmReferral = vi.fn();
    const onCompleteRoutine = vi.fn();

    render(
      <TriageBottomSheet
        severity="routine"
        conditionLabel="Signs consistent with TB screening criteria"
        guidanceText="Refer for testing within the week."
        referralRequired
        onConfirmReferral={onConfirmReferral}
        onCompleteRoutine={onCompleteRoutine}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Continue to referral/i }));
    expect(onConfirmReferral).toHaveBeenCalledTimes(1);
    expect(onCompleteRoutine).not.toHaveBeenCalled();
  });

  it("shows completion rather than referral for a Routine no-match result", () => {
    const onConfirmReferral = vi.fn();
    const onCompleteRoutine = vi.fn();

    render(
      <TriageBottomSheet
        severity="routine"
        conditionLabel="No specific category identified"
        guidanceText="Routine advice."
        referralRequired={false}
        onConfirmReferral={onConfirmReferral}
        onCompleteRoutine={onCompleteRoutine}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save and finish/i }));
    expect(onCompleteRoutine).toHaveBeenCalledTimes(1);
    expect(onConfirmReferral).not.toHaveBeenCalled();
  });
});
