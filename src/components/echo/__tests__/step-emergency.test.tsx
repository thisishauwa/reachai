import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepEmergency } from "../step-emergency";

describe("StepEmergency", () => {
  it("renders the L8 refer-now layout and requires all three answers", () => {
    const onComplete = vi.fn();
    render(
      <StepEmergency
        primarySignCode="L8"
        caregiverReported={false}
        referralCode="BK-TRN"
        destinationName="EHA Clinic, Nassarawa"
        destinationPhone="+2348012345678"
        onComplete={onComplete}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Refer now");
    expect(screen.getByText("BK-TRN")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call the clinic/i })).toHaveAttribute("href", "tel:+2348012345678");
    const continueButton = screen.getByRole("button", { name: /Continue to details/i });
    expect(continueButton).toBeDisabled();

    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(3);
    groups.forEach((group) => fireEvent.click(within(group).getByRole("button", { name: /^No/ })));
    expect(continueButton).toBeEnabled();
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledWith(
      "look_check_unwell",
      expect.objectContaining({ LOOK_CHECK_ACUTE: "yes", LOOK_CHECK_PRIMARY_SIGN: "L8" }),
    );
  });

  it("never invents a clinic phone number when the directory has none", () => {
    render(<StepEmergency primarySignCode="L8" caregiverReported={false} referralCode="BK-TRN" destinationName="EHA Clinic, Nassarawa" onComplete={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /Call the clinic/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Clinic phone number unavailable")).toBeInTheDocument();
  });

  it.each([
    ["L5", ["E1", "E2", "E3", "E4"], /yellow eyes start after the fever/i],
    ["L3", ["E5", "E6", "E7", "E8"], /fever for 3 or more days/i],
    ["L1", ["E9", "E10", "E11", "E12"], /is there fever/i],
    ["L2", ["E9", "E10", "E11", "E12"], /is there fever/i],
    ["L4", ["E13", "E14", "E15", "E16"], /watery diarrhoea in the last 24 hours/i],
    ["L6", ["E17", "E18", "E19", "E20"], /is there fever/i],
    ["L7", ["E21", "E22", "E23", "E24"], /cord cut with a clean blade/i],
    ["L8", ["E25", "E26", "E27"], /is there fever/i],
  ])("renders the exact in-scope question set for %s", (sign, ids, firstPrompt) => {
    render(<StepEmergency primarySignCode={sign} caregiverReported={false} referralCode="BK-TRN" destinationName="EHA Clinic, Nassarawa" onComplete={vi.fn()} />);
    ids.forEach((id) => expect(screen.getByText(id)).toBeInTheDocument());
    expect(screen.getAllByText(firstPrompt)).toHaveLength(2);
  });

  it("allows Don't know throughout the absent Journey 2 bleeding set", () => {
    render(<StepEmergency primarySignCode="L3" caregiverReported referralCode="BK-TRN" destinationName="EHA Clinic, Nassarawa" onComplete={vi.fn()} />);
    screen.getAllByRole("group").forEach((group) => {
      expect(within(group).getByRole("button", { name: /^Don't know/ })).toBeInTheDocument();
    });
  });
});
