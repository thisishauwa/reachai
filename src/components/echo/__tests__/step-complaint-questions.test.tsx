import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepComplaintQuestions } from "../step-complaint-questions";

vi.mock("@/lib/session/session-context", () => ({ useSession: () => ({ userId: "user-1" }) }));
vi.mock("@/lib/offline/sync", () => ({ syncController: { enqueue: vi.fn().mockResolvedValue(undefined) } }));

function answer(id: string, option: RegExp) {
  const label = screen.getByText(id);
  const group = label.closest("fieldset");
  if (!group) throw new Error(`Question ${id} not found`);
  fireEvent.click(within(group).getByRole("button", { name: option }));
}

function completeSetABase(a7: "yes" | "no" = "no", a8: "yes" | "no" = "no") {
  answer("A1", /^1 to 2/);
  answer("A2", /^Yes, easily/);
  answer("A3", /^No/);
  answer("A4", /^No/);
  answer("A5", /^No/);
  answer("A6", /^No/);
  answer("A7", a7 === "yes" ? /^Yes/ : /^No/);
  answer("A8", a8 === "yes" ? /^Yes/ : /^No/);
}

describe("StepComplaintQuestions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches Journey 3: short fever, all negative, no bridge", () => {
    render(<StepComplaintQuestions area="A" ageBand="18_to_49" encounterId="encounter-1" onComplete={vi.fn()} />);
    completeSetABase();
    expect(screen.queryByText(/You mentioned diarrhoea or vomiting/)).not.toBeInTheDocument();
    expect(screen.queryByText(/You mentioned a cough/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue to result/ })).toBeEnabled();
  });

  it("matches Journey 7: A7 reveals B1-B4 in the grey bridge and keeps Continue disabled", () => {
    render(<StepComplaintQuestions area="A" ageBand="18_to_49" encounterId="encounter-1" onComplete={vi.fn()} />);
    completeSetABase("yes");
    expect(screen.getByText(/You mentioned diarrhoea or vomiting/)).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("B4")).toBeInTheDocument();
    expect(screen.getAllByText("Required — choose an answer.")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Continue to result/ })).toBeDisabled();
  });

  it("matches Journeys 8 and 12: set E uses cough duration and weight-loss questions", () => {
    render(<StepComplaintQuestions area="E" ageBand="under_5" encounterId="encounter-1" onComplete={vi.fn()} />);
    expect(screen.getByText("cough E1")).toBeInTheDocument();
    expect(screen.getAllByText(/How long has the cough lasted/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^2 weeks or more/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Weight loss or night sweats/)).toHaveLength(2);
  });

  it("matches Journey 9: an 11-year-old sees F1 weak limb but not the newborn F3", () => {
    render(<StepComplaintQuestions area="F" ageBand="5_to_17" encounterId="encounter-1" onComplete={vi.fn()} />);
    expect(screen.getAllByRole("group")).toHaveLength(4);
    expect(screen.getByText("F1")).toBeInTheDocument();
    expect(screen.getAllByText(/Sudden weakness or floppy arm or leg/)).toHaveLength(2);
    expect(screen.queryByText("F3")).not.toBeInTheDocument();
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
  });
});
