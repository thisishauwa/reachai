import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepLookCheck } from "../step-look-check";

describe("StepLookCheck", () => {
  it("changes the present-patient action to acute when L8 is selected", () => {
    const onContinue = vi.fn();
    render(
      <StepLookCheck
        presence="with_me"
        ageBand="18_to_49"
        onContinue={onContinue}
      />,
    );

    expect(screen.queryByText(/Newborn looks ill/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /None of these/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /L8.*Looks very unwell/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue — acute/i }));

    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ primarySignCode: "L8", syndromeId: "LOOK_CHECK_UNWELL" }),
    );
  });

  it("shows the newborn sign only for under 28 days", () => {
    const { rerender } = render(
      <StepLookCheck presence="with_me" ageBand="under_28_days" onContinue={vi.fn()} />,
    );
    expect(screen.getByText(/Newborn looks ill/)).toBeInTheDocument();

    rerender(<StepLookCheck presence="with_me" ageBand="under_1_year" onContinue={vi.fn()} />);
    expect(screen.queryByText(/Newborn looks ill/)).not.toBeInTheDocument();
  });

  it("routes an absent patient's L4 No answer to acute", () => {
    const onContinue = vi.fn();
    render(
      <StepLookCheck presence="at_home" ageBand="18_to_49" onContinue={onContinue} />,
    );

    const groups = screen.getAllByRole("group");
    for (const group of groups) {
      fireEvent.click(within(group).getByRole("button", { name: /^No/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: /Continue — acute/i }));

    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ primarySignCode: "L4", caregiverReported: true }),
    );
  });
});
