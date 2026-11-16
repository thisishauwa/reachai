import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepLookCheck } from "../step-look-check";

describe("StepLookCheck", () => {
  it("opens the refer-now branch immediately when a present-patient sign is selected", () => {
    const onContinue = vi.fn();
    render(
      <StepLookCheck
        presence="with_me"
        ageBand="18_to_49"
        onContinue={onContinue}
      />,
    );

    expect(screen.queryByText(/Baby under 28 days/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^None of these — continue$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /L8.*very unwell/i }));

    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ primarySignCode: "L8", syndromeId: "LOOK_CHECK_UNWELL" }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("shows the newborn sign only for under 28 days", () => {
    const { rerender } = render(
      <StepLookCheck presence="with_me" ageBand="under_28_days" onContinue={vi.fn()} />,
    );
    expect(screen.getByText(/Baby under 28 days: not feeding/)).toBeInTheDocument();

    rerender(<StepLookCheck presence="with_me" ageBand="under_1_year" onContinue={vi.fn()} />);
    expect(screen.queryByText(/Baby under 28 days: not feeding/)).not.toBeInTheDocument();
  });

  it("routes an absent patient's L4 No answer to acute", () => {
    const onContinue = vi.fn();
    render(
      <StepLookCheck presence="at_home" ageBand="18_to_49" onContinue={onContinue} />,
    );

    const abilityGroup = screen.getByRole("group", { name: /able to stand and drink/i });
    fireEvent.click(within(abilityGroup).getByRole("button", { name: /^No/ }));

    expect(onContinue).toHaveBeenCalledWith(
      expect.objectContaining({ primarySignCode: "L4", caregiverReported: true }),
    );
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("matches Journey 6: an absent patient's Don't know answer blocks Routine without inventing a danger sign", () => {
    const onContinue = vi.fn();
    render(<StepLookCheck presence="at_home" ageBand="50_plus" onContinue={onContinue} />);

    const groups = screen.getAllByRole("group");
    groups.forEach((group, index) => {
      const canStand = within(group).queryAllByText(/able to stand and drink/i).length > 0;
      fireEvent.click(within(group).getByRole("button", { name: index === 0 ? /^Don't know/ : canStand ? /^Yes/ : /^No/ }));
    });

    expect(screen.getByText("This case cannot end as routine.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ primarySignCode: null, caregiverReported: true, hasUnknown: true }));
  });
});
