"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { useDestinationFacilities } from "@/lib/queries/referrals";
import { ReferralConsentModal } from "@/components/echo/referral-consent-modal";
import { ReferralGeneratedSheet } from "@/components/echo/referral-generated-sheet";

/**
 * AC7 — Confirm Referral generates a unique referral code (ECH-XXXXX format)
 *        and displays it on screen.
 *
 * Anonymous-only: no identified mode, no consent signature required here.
 * The offline / RPC fallback always generates a code so the UI is never
 * left in a confirmed-but-codeless state.
 */
export function StepReferral({
  encounterId,
  onComplete,
}: {
  encounterId: string;
  /** Legacy props accepted but ignored — always anonymous */
  privacyMode?: string;
  consentId?: string | null;
  patientName?: string;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: destinationFacilities } = useDestinationFacilities(
    activeFacility.facilityId
  );

  const handleGenerateReferral = async (_data: { referralMode: "anonymous" }) => {
    setIsGenerating(true);

    // AC7 — code format: ECH-XXXXX (alphanumeric, short)
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const fallbackCode = `ECH-${randomPart}`;
    const referralId = crypto.randomUUID();
    const destinationFacilityId =
      destinationFacilities?.[0]?.id || "00000000-0000-0000-0000-000000000011";

    const supabase = createClient();
    let finalCode = fallbackCode;

    try {
      const { data: refResult, error: refError } = await supabase.rpc(
        "create_referral",
        {
          p_encounter_id: encounterId,
          p_destination_facility_id: destinationFacilityId,
          p_privacy_mode: "anonymous",
          p_consent_id: null,
          p_idempotency_key: createIdempotencyKey(),
        }
      );

      if (!refError && refResult) {
        finalCode = (refResult as { referral_code: string }).referral_code;
        await queryClient.invalidateQueries({ queryKey: ["referrals"] });
      } else {
        console.warn("create_referral RPC note:", refError);
        // Offline fallback — enqueue and use the local code
        await syncController.enqueue("referral", referralId, "insert", {
          id: referralId,
          encounter_id: encounterId,
          organization_id: activeFacility.organizationId,
          destination_facility_id: destinationFacilityId,
          originating_facility_id: activeFacility.facilityId,
          privacy_mode: "anonymous",
          consent_id: null,
          referral_code: fallbackCode,
          status: "created",
          created_by: userId,
        });
      }
    } catch (e) {
      console.warn("create_referral exception:", e);
      // AC edge case — code generation fails (offline): show error with retry
      toast.error("Could not generate referral code. Please retry.", {
        action: {
          label: "Retry",
          onClick: () => handleGenerateReferral({ referralMode: "anonymous" }),
        },
      });
      setIsGenerating(false);
      return;
    }

    setReferralCode(finalCode);
    toast.success("Referral code generated");
    setIsGenerating(false);
  };

  if (referralCode) {
    return (
      <div className="w-full">
        <ReferralGeneratedSheet
          referralCode={referralCode}
          onComplete={onComplete}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReferralConsentModal
        onSubmit={handleGenerateReferral}
        isLoading={isGenerating}
      />
    </div>
  );
}
