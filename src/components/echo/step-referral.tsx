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
import type { PrivacyMode } from "@/lib/supabase/database.types";

interface StepReferralProps {
  encounterId: string;
  privacyMode?: PrivacyMode;
  consentId?: string | null;
  patientName?: string;
  onComplete: () => void;
}

export function StepReferral({
  encounterId,
  privacyMode = "identified",
  consentId = null,
  patientName = "Patient",
  onComplete,
}: StepReferralProps) {
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: destinationFacilities } = useDestinationFacilities(
    activeFacility.facilityId
  );

  const handleGenerateReferral = async (data: { referralMode: PrivacyMode }) => {
    setIsGenerating(true);

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
          p_privacy_mode: data.referralMode,
          p_consent_id: data.referralMode === "identified" ? consentId : null,
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
          privacy_mode: data.referralMode,
          consent_id: data.referralMode === "identified" ? consentId : null,
          referral_code: fallbackCode,
          status: "created",
          created_by: userId,
        });
      }
    } catch (e) {
      console.warn("create_referral exception:", e);
      toast.error("Could not generate referral code. Please retry.", {
        action: {
          label: "Retry",
          onClick: () => handleGenerateReferral(data),
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
        initialMode={privacyMode}
        patientName={patientName}
        onSubmit={handleGenerateReferral}
        isLoading={isGenerating}
      />
    </div>
  );
}
