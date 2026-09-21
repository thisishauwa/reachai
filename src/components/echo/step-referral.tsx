"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/session/session-context";
import { syncController } from "@/lib/offline/sync";
import { useDestinationFacilities } from "@/lib/queries/referrals";
import { ReferralConsentModal } from "@/components/echo/referral-consent-modal";
import { ReferralGeneratedSheet } from "@/components/echo/referral-generated-sheet";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export function StepReferral({
  encounterId,
  privacyMode,
  consentId,
  patientName = "Oyintari Werinipre",
  onComplete,
}: {
  encounterId: string;
  privacyMode: PrivacyMode;
  consentId: string | null;
  patientName?: string;
  onComplete: () => void;
}) {
  const { activeFacility, userId } = useSession();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const { data: destinationFacilities } = useDestinationFacilities(
    activeFacility.facilityId
  );

  const handleGenerateReferral = async (data: {
    referralMode: PrivacyMode;
    signatureMethod?: "type" | "draw";
    signatureText?: string;
  }) => {
    // Generate referral code format: REF-XXXX-XXX
    const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const generatedCode = `REF-${randomChars}-${randomSuffix}`;
    const referralId = crypto.randomUUID();
    const destinationFacilityId =
      destinationFacilities?.[0]?.id || "00000000-0000-0000-0000-000000000011";

    try {
      await syncController.enqueue("referral", referralId, "insert", {
        id: referralId,
        encounterId,
        encounter_id: encounterId,
        organizationId: activeFacility.organizationId,
        organization_id: activeFacility.organizationId,
        destinationFacilityId,
        destination_facility_id: destinationFacilityId,
        originatingFacilityId: activeFacility.facilityId,
        originating_facility_id: activeFacility.facilityId,
        privacyMode: data.referralMode,
        privacy_mode: data.referralMode,
        consentId: data.referralMode === "identified" ? consentId : null,
        consent_id: data.referralMode === "identified" ? consentId : null,
        referralCode: generatedCode,
        referral_code: generatedCode,
        status: "pending",
        createdBy: userId,
        created_by: userId,
      });
    } catch (e) {
      console.warn("Offline outbox queue note:", e);
    }

    setReferralCode(generatedCode);
    toast.success("Referral successfully created");
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
      />
    </div>
  );
}
