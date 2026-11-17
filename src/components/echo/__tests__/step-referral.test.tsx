import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepReferral } from "../step-referral";

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/lib/session/session-context", () => ({
  useSession: () => ({
    userId: "user-1",
    activeFacility: { facilityId: "source-1", organizationId: "org-1", facilityCode: "BK", facilityName: "Outlet BK" },
  }),
}));
vi.mock("@/lib/queries/referrals", () => ({
  useDestinationFacilities: () => ({ data: [{ id: "clinic-1", name: "EHA Clinic, Nassarawa", code: "Jaen Road" }] }),
}));
vi.mock("@/lib/offline/sync", () => ({ syncController: { enqueue: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }) }) }));

const baseProps = {
  encounterId: "encounter-1",
  referralCode: "BK-TRN",
  severity: "urgent" as const,
  conditionCode: "CHOLERA_PATTERN",
  conditionLabel: "Signs consistent with cholera",
  guidanceText: "Give ORS now and refer today.",
  onComplete: vi.fn(),
};

describe("StepReferral", () => {
  it("renders all seven ordered referral elements before outcome capture", () => {
    render(<StepReferral {...baseProps} />);
    const text = document.body.textContent || "";
    const orderedLabels = ["Urgent - refer today", "Referral code", "What this looks like", "Before transport - give", "Protect yourself and others", "Recommended clinic", "Say to the patient", "Did you refer this patient?"];
    let previous = -1;
    for (const label of orderedLabels) {
      const position = text.indexOf(label);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(screen.getByText("BK-TRN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print card/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send SMS link/i })).toBeInTheDocument();
  });

  it("shows the optional reason and retains destination for a refused referral", () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Yes, but the patient refused/i }));
    expect(screen.getByText("Referred to")).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason - optional/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save and finish/i })).toBeEnabled();
  });

  it("shows an optional reason but no destination for No", () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /^No/i }));
    expect(screen.getByLabelText(/Reason - optional/i)).toBeInTheDocument();
    expect(screen.queryByText("Referred to")).not.toBeInTheDocument();
  });
});
