import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReferralDetailPage from "@/app/(app)/referrals/[id]/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "referral-1" }),
  usePathname: () => "/referrals/referral-1",
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock("@/lib/session/session-context", () => ({
  useSession: () => ({ activeFacility: { facilityId: "clinic-1", facilityName: "REACH Clinic" } }),
}));

vi.mock("@/lib/queries/referrals", () => ({
  useReferral: () => ({
    isLoading: false,
    data: {
      id: "referral-1",
      referral_code: "BK-TRN",
      status: "created",
      created_at: "2026-11-24T10:00:00.000Z",
      source_facility_id: "outlet-1",
      destination_facility_id: "clinic-1",
      encounters: {
        encounter_demographics: [{ sex: "female", age_band: "18_to_49", pregnancy_status: null }],
        triage_outcomes: [{ severity: "urgent", condition_code: "CHOLERA_PATTERN", condition_label_en: "Signs consistent with cholera" }],
        encounter_answers: [],
      },
    },
  }),
  useTransitionReferral: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("clinic scan view", () => {
  it("offers four confirmation choices and both documented handover actions", () => {
    render(<ReferralDetailPage />);

    expect(screen.getByRole("button", { name: "Confirmed IDSR priority disease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmed other IDSR disease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Non-IDSR condition" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indeterminate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save and send to backend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send result back to outlet/i })).toBeInTheDocument();
  });
});
