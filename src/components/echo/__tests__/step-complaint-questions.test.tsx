import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepComplaintQuestions } from "../step-complaint-questions";

vi.mock("@/lib/session/session-context", () => ({ useSession: () => ({ userId: "user-1" }) }));
vi.mock("@/lib/offline/sync", () => ({ syncController: { enqueue: vi.fn().mockResolvedValue(undefined) } }));

describe("StepComplaintQuestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("completes all-negative set A without showing a bridge", () => {
    render(<StepComplaintQuestions area="A" encounterId="encounter-1" onComplete={vi.fn()} />);
    screen.getAllByRole("group").forEach((group) =>
      fireEvent.click(within(group).getByRole("button", { name: /^No/ })),
    );
    expect(screen.queryByText(/Because A7 was Yes/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Because A8 was Yes/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to result/ })).toBeEnabled();
  });

  it("shows the grey B1-B4 bridge when A7 is Yes and disables Continue while bridge answers are missing", () => {
    render(<StepComplaintQuestions area="A" encounterId="encounter-1" onComplete={vi.fn()} />);
    const baseGroups = screen.getAllByRole("group");
    baseGroups.forEach((group) => {
      const isA7 = within(group).queryByText("A7");
      fireEvent.click(within(group).getByRole("button", { name: isA7 ? /^Yes/ : /^No/ }));
    });

    expect(screen.getByText("Because A7 was Yes")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("B4")).toBeInTheDocument();
    expect(screen.getAllByText(/Required — choose Yes/)).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Continue to result/ })).toBeDisabled();
  });

  it("renders only set F and starts with the weak-limb question", () => {
    render(<StepComplaintQuestions area="F" encounterId="encounter-1" onComplete={vi.fn()} />);
    expect(screen.getAllByRole("group")).toHaveLength(5);
    expect(screen.getByText("F1")).toBeInTheDocument();
    expect(screen.getAllByText(/arm or leg suddenly become weak or floppy/i)).toHaveLength(2);
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });
});
