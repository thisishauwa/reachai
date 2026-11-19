import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepDetailsConsent } from "../step-details-consent";

describe("StepDetailsConsent", () => {
  it("captures the documented Journey 1 fever complaint inside Step 4", () => {
    render(
      <StepDetailsConsent
        presence="with_me"
        ageBand="18_to_49"
        isMinor={false}
        caregiverReported={false}
        confirmedComplaint={{ label: "Fever or hot body", labelHa: "Zazzabi ko jiki mai zafi" }}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Complaint area" })).toHaveTextContent("Fever or hot body");
    expect(screen.queryByText("What is the main problem?")).not.toBeInTheDocument();
  });

  it("shows pregnancy only for Female age 18 to 49", () => {
    const props = { presence: "with_me" as const, isMinor: false, caregiverReported: false, onContinue: vi.fn() };
    const { rerender } = render(<StepDetailsConsent {...props} ageBand="18_to_49" />);
    fireEvent.click(screen.getByRole("button", { name: /Female/ }));
    expect(screen.getByText("Pregnant?")).toBeInTheDocument();

    rerender(<StepDetailsConsent {...props} ageBand="under_5" />);
    expect(screen.queryByText("Pregnant?")).not.toBeInTheDocument();

    rerender(<StepDetailsConsent {...props} ageBand="18_to_49" />);
    fireEvent.click(screen.getByRole("button", { name: /Male/ }));
    expect(screen.queryByText("Pregnant?")).not.toBeInTheDocument();
  });

  it("names the person reporting and shows the caregiver flag when absent", () => {
    render(<StepDetailsConsent presence="at_home" ageBand="under_5" isMinor caregiverReported onContinue={vi.fn()} />);
    expect(screen.getByText("Caregiver-reported")).toBeInTheDocument();
    expect(screen.getByText(/Consent given by the person reporting/i)).toBeInTheDocument();
  });

  it("names the accompanying adult when the patient is a present minor", () => {
    render(<StepDetailsConsent presence="with_me" ageBand="under_5" isMinor caregiverReported={false} onContinue={vi.fn()} />);
    expect(screen.getByText(/Consent given by the accompanying adult for the minor/i)).toBeInTheDocument();
  });

  it("flags a present minor who selects Myself as unaccompanied", () => {
    render(<StepDetailsConsent presence="with_me" ageBand="5_to_17" isMinor caregiverReported={false} onContinue={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Myself/ }));
    expect(screen.getByText(/Unaccompanied minor — record flagged/)).toBeInTheDocument();
    expect(screen.getByText(/Screening, advice and referral proceed as normal/)).toBeInTheDocument();
  });

  it("keeps Continue disabled until all visible required fields and consent are complete", () => {
    render(<StepDetailsConsent presence="with_me" ageBand="18_to_49" isMinor={false} caregiverReported={false} onContinue={vi.fn()} />);
    const continueButton = screen.getByRole("button", { name: /Continue to complaint/i });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Myself/ }));
    fireEvent.click(screen.getByRole("button", { name: /Female/ }));
    fireEvent.click(screen.getByRole("button", { name: /^NoA'a$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Consent given by the patient/i }));
    expect(continueButton).toBeEnabled();
  });
});
