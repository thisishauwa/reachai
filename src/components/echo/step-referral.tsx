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
import { cn } from "@/lib/utils";
import { Check, Building2, ChevronDown } from "lucide-react";
import type { PrivacyMode } from "@/lib/supabase/database.types";

interface StepReferralProps {
  encounterId: string;
  privacyMode?: PrivacyMode;
  consentId?: string | null;
  patientName?: string;
  onComplete: () => void;
}

interface FacilityOption {
  id: string;
  name: string;
  type?: string;
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
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("");
  const [isOther, setIsOther] = useState(false);
  const [otherFacilityName, setOtherFacilityName] = useState("");
  const [showFacilityPicker, setShowFacilityPicker] = useState(true);

  const { data: destinationFacilities = [] } = useDestinationFacilities(
    activeFacility.facilityId
  );

  const resolvedFacilityId =
    selectedFacilityId ||
    destinationFacilities[0]?.id ||
    "00000000-0000-0000-0000-000000000011";

  const handleGenerateReferral = async (data: { referralMode: PrivacyMode }) => {
    if (!selectedFacilityId && !isOther) {
      toast.error("Please select a referral destination facility");
      return;
    }
    if (isOther && !otherFacilityName.trim()) {
      toast.error("Please enter the name of the referral facility");
      return;
    }

    setIsGenerating(true);

    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const fallbackCode = `ECH-${randomPart}`;
    const referralId = crypto.randomUUID();

    const supabase = createClient();
    let finalCode = fallbackCode;

    try {
      const { data: refResult, error: refError } = await supabase.rpc(
        "create_referral",
        {
          p_encounter_id: encounterId,
          p_destination_facility_id: resolvedFacilityId,
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
          destination_facility_id: resolvedFacilityId,
          originating_facility_id: activeFacility.facilityId,
          privacy_mode: data.referralMode,
          consent_id: data.referralMode === "identified" ? consentId : null,
          referral_code: fallbackCode,
          status: "created",
          created_by: userId,
          // Store free-text "other" name in metadata if applicable
          ...(isOther ? { destination_facility_name_free_text: otherFacilityName.trim() } : {}),
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
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      {/* Facility Selection Card */}
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />
        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Step 7 of 7
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Select referral</span> destination
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Choose an EHA clinic or enter another facility name. — Zaɓi wurin tura mara lafiya.
            </p>
          </div>

          {/* EHA Clinic tiles */}
          {destinationFacilities.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                EHA Clinics
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {destinationFacilities.map((fac) => {
                  const sel = selectedFacilityId === fac.id && !isOther;
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => {
                        setSelectedFacilityId(fac.id);
                        setIsOther(false);
                      }}
                      className={cn(
                        "w-full rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
                        "flex items-center justify-between gap-3",
                        "transition-all cursor-pointer border",
                        sel
                          ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                          : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 className={cn("size-4 shrink-0", sel ? "text-[#0073f3]" : "text-[#6e8298]")} />
                        <span className={cn("leading-snug truncate", sel ? "font-semibold" : "font-normal")}>
                          {fac.name || (fac as { facility_name?: string }).facility_name || "EHA Clinic"}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                          sel ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#c7d2de] bg-white"
                        )}
                      >
                        {sel && <Check className="size-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* "Other" option */}
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
              Other Facility
            </label>
            <button
              type="button"
              onClick={() => {
                setIsOther(true);
                setSelectedFacilityId("");
              }}
              className={cn(
                "w-full rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
                "flex items-center justify-between gap-3",
                "transition-all cursor-pointer border",
                isOther
                  ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                  : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
              )}
            >
              <span className={cn("leading-snug", isOther ? "font-semibold" : "font-normal")}>
                Other facility (not listed)
              </span>
              <div
                className={cn(
                  "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                  isOther ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#c7d2de] bg-white"
                )}
              >
                {isOther && <Check className="size-3 stroke-[3]" />}
              </div>
            </button>

            {/* Free-text input for "Other" */}
            {isOther && (
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                  Facility name *
                </label>
                <input
                  type="text"
                  id="other-facility-input"
                  value={otherFacilityName}
                  onChange={(e) => setOtherFacilityName(e.target.value)}
                  placeholder="e.g. General Hospital Kano"
                  autoFocus
                  className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Consent & Generate */}
      <ReferralConsentModal
        initialMode={privacyMode}
        patientName={patientName}
        onSubmit={handleGenerateReferral}
        isLoading={isGenerating}
      />
    </div>
  );
}
