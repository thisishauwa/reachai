import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StepReferral } from "../step-referral";

const { enqueueMock, rpcMock, updateMock, eqMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined),
  rpcMock: vi.fn().mockResolvedValue({ data: { id: "referral-1" }, error: null }),
  updateMock: vi.fn(),
  eqMock: vi.fn().mockResolvedValue({ error: null }),
}));

updateMock.mockReturnValue({ eq: eqMock });

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/lib/session/session-context", () => ({
  useSession: () => ({
    userId: "user-1",
    activeFacility: { facilityId: "source-1", organizationId: "org-1", facilityCode: "BK", facilityName: "Outlet BK" },
  }),
}));
vi.mock("@/lib/queries/referrals", () => ({
  useDestinationFacilities: () => ({ data: [{ id: "clinic-1", name: "REACH Clinic, Gyadi-gyadi", code: "REACH-GYADI", address_text: "Gyadi-gyadi, Kano" }] }),
}));
vi.mock("@/lib/offline/sync", () => ({ syncController: { enqueue: enqueueMock } }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: rpcMock, from: () => ({ update: updateMock }) }) }));

const baseProps = {
  encounterId: "encounter-1",
  referralCode: "BK-TRN",
  severity: "urgent" as const,
  conditionCode: "CHOLERA_PATTERN",
  onComplete: vi.fn(),
};

describe("StepReferral", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Step 6a in order without repeating the Step 6 result blocks", () => {
    render(<StepReferral {...baseProps} />);
    const text = document.body.textContent || "";
    const orderedLabels = ["Step 6a · Referral", "Referral code", "Recommended clinic", "Say to the patient", "Did you refer this patient?"];
    let previous = -1;
    for (const label of orderedLabels) {
      const position = text.indexOf(label);
      expect(position).toBeGreaterThan(previous);
      previous = position;
    }
    expect(screen.getByText("BK-TRN")).toBeInTheDocument();
    expect(screen.getByText("REACH Clinic, Gyadi-gyadi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Print card/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send SMS link/i })).toBeInTheDocument();
    expect(screen.queryByText("What this looks like")).not.toBeInTheDocument();
    expect(screen.queryByText("Before transport - give")).not.toBeInTheDocument();
  });

  it("limits referral destinations to the four approved facilities", () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Yes, referred/i }));

    expect(screen.getByRole("button", { name: /REACH Clinic, Gyadi-gyadi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /REACH Clinic, Kuje/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /REACH eDokta Clinic, Tofa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sen\. Oluremi Tinubu Clinic/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Other facility/i })).not.toBeInTheDocument();
  });

  it("shows the optional reason and retains destination for a refused referral", () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Yes, but the patient refused/i }));
    expect(screen.getByText("Referred to")).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason — optional/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save and finish/i })).toBeEnabled();
  });

  it("shows an optional reason and no destination for No", () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /^No/i }));
    expect(screen.getByLabelText(/Reason — optional/i)).toBeInTheDocument();
    expect(screen.queryByText("Referred to")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save and finish/i })).toBeEnabled();
  });

  it("keeps a refused Journey 7 referral active so its code can still be used", async () => {
    render(<StepReferral {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Yes, but the patient refused/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save and finish/i }));

    await waitFor(() => {
      const referralQueueCall = enqueueMock.mock.calls.find((call) => call[0] === "referral");
      expect(referralQueueCall?.[3]).toEqual(expect.objectContaining({ status: "created", referral_outcome: "refused" }));
    });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "created", referral_outcome: "refused" }));
  });

  it("matches Journey 12 by storing the required override without notifying a destination", async () => {
    render(<StepReferral {...baseProps} conditionCode="TB_SCREENING_PATTERN" severity="routine" />);
    fireEvent.click(screen.getByRole("button", { name: /^No/i }));
    fireEvent.change(screen.getByLabelText(/Reason — optional/i), {
      target: { value: "Vendor disagreed with the recommendation" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save and finish/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith(
        "save_referral_outcome_v03",
        expect.objectContaining({
          p_referral_outcome: "not_referred",
          p_referral_outcome_reason: "Vendor disagreed with the recommendation",
        }),
      );
      const referralQueueCall = enqueueMock.mock.calls.find((call) => call[0] === "referral");
      expect(referralQueueCall?.[3]).toEqual(expect.objectContaining({
        status: "cancelled",
        referral_outcome: "not_referred",
        referral_outcome_reason: "Vendor disagreed with the recommendation",
      }));
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("uses caregiver wording when the patient is absent", () => {
    render(<StepReferral {...baseProps} caregiverReported />);
    expect(screen.getByText("Say to the person reporting")).toBeInTheDocument();
    expect(screen.getByText(/The patient is not here\. Bring them/)).toBeInTheDocument();
  });

  it("marks the Journey 5 recommendation as maternity capable", () => {
    render(<StepReferral {...baseProps} conditionCode="MEASLES_PATTERN" severity="emergency" requiresMaternityCapability />);
    expect(screen.getByText("Maternity-capable facility")).toBeInTheDocument();
  });
});
