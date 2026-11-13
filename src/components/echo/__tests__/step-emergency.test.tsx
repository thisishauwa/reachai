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
        onComplete={onComplete}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Refer now");
    expect(screen.getByText("BK-TRN")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call the clinic/i })).toHaveAttribute("href", "tel:+2348000000000");
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
});
