import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EncounterCompletedModal } from "../encounter-completed-modal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("EncounterCompletedModal", () => {
  it("shows the Journey 12 record, decline reason and surveillance count", () => {
    render(
      <EncounterCompletedModal
        isAnonymous
        category="Signs consistent with TB screening criteria"
        severity="routine"
        recommendation="Refer for testing within the week."
        referralOutcome="not_referred"
        referralReason="Vendor disagreed with the recommendation"
      />,
    );

    expect(screen.getByRole("heading", { name: "Record saved" })).toBeInTheDocument();
    expect(screen.getByText("TB screening criteria")).toBeInTheDocument();
    expect(screen.getByText("Routine")).toBeInTheDocument();
    expect(screen.getByText("Refer for testing within the week.")).toBeInTheDocument();
    expect(screen.getByText("No — recommendation declined")).toBeInTheDocument();
    expect(screen.getByText("Vendor disagreed with the recommendation")).toBeInTheDocument();
    expect(screen.getByText(/Counted for surveillance/)).toBeInTheDocument();
  });
});
