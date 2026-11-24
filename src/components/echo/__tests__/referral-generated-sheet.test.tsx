import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReferralGeneratedSheet } from "../referral-generated-sheet";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr") },
}));

describe("ReferralGeneratedSheet", () => {
  it("shows the handover details and never exposes the suspected category", async () => {
    render(
      <ReferralGeneratedSheet
        referralCode="BK-TRN"
        destinationName="REACH Clinic, Gyadi-gyadi"
        destinationAddress="Gyadi-gyadi, Kano"
        createdAt="2026-11-24T10:00:00.000Z"
        onComplete={vi.fn()}
      />,
    );

    expect(screen.getByText("BK-TRN")).toBeInTheDocument();
    expect(screen.getByText("REACH Clinic, Gyadi-gyadi")).toBeInTheDocument();
    expect(screen.getByText("Gyadi-gyadi, Kano")).toBeInTheDocument();
    expect(screen.getByText("Issue date")).toBeInTheDocument();
    expect(screen.getByText(/24 November 2026/)).toBeInTheDocument();
    expect(screen.getByText("Je asibiti yau. Nuna wannan a tebur.")).toBeInTheDocument();
    expect(screen.queryByText(/Signs consistent with/i)).not.toBeInTheDocument();
    expect(await screen.findByAltText("QR code for BK-TRN")).toBeInTheDocument();
  });
});
