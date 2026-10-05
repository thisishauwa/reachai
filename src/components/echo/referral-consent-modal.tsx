"use client";

import { useState } from "react";
import { ShieldCheck, UserCheck } from "lucide-react";
import type { PrivacyMode } from "@/lib/supabase/database.types";

interface ReferralConsentModalProps {
  initialMode?: PrivacyMode;
  patientName?: string;
  onSubmit: (data: {
    referralMode: PrivacyMode;
    signatureMethod?: "type" | "draw";
    signatureText?: string;
  }) => void;
  isLoading?: boolean;
}

export function ReferralConsentModal({
  initialMode = "identified",
  patientName = "Patient",
  onSubmit,
  isLoading = false,
}: ReferralConsentModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [referralMode] = useState<PrivacyMode>(initialMode);

  return (
    <div className="w-full bg-white dark:bg-background rounded-[24px] p-6 sm:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl sm:text-2xl font-semibold text-[#121619]">
          Confirm Referral
        </h2>
        <p className="text-sm sm:text-base text-[#6e8298]">
          Tabbatar da Turawa
        </p>
      </div>

      <div className="h-px bg-[#f2f3f5] w-full" />

      {/* Info card */}
      {referralMode === "identified" ? (
        <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
          <div className="size-11 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
            <UserCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-[#242b33]">
              Identified Referral · {patientName}
            </span>
            <p className="text-xs sm:text-sm text-[#6e8298] leading-relaxed">
              Patient name and clinical findings will be linked with the receiving facility for treatment continuity.
            </p>
            <p className="text-xs text-[#6e8298] mt-1 italic">
              Za a haɗa sunan majiyyaci da bayanan asibiti don ci gaba da kula da lafiya.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
          <div className="size-11 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-[#242b33]">
              Anonymous Referral
            </span>
            <p className="text-xs sm:text-sm text-[#6e8298] leading-relaxed">
              A unique referral code will be generated. No personal data is
              included. The patient can use this code at the referral site.
            </p>
            <p className="text-xs text-[#6e8298] mt-1 italic">
              Za a ƙirƙiro lambar turawa ta musamman. Ba a haɗa bayanin sirri.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-[#fff8f6] border border-[#ffd5c8] rounded-[12px] px-4 py-3">
        <p className="text-sm text-[#a03823] font-medium">
          This is not a diagnosis.
        </p>
        <p className="text-xs text-[#c75b40] mt-0.5">
          Wannan ba ganewar asali ba ne.
        </p>
      </div>

      {/* Confirm checkbox */}
      <button
        type="button"
        id="referral-consent-confirm-btn"
        onClick={() => setConfirmed((v) => !v)}
        className="flex items-start gap-3 text-left cursor-pointer"
      >
        <div
          className={`size-5 rounded-[4px] mt-0.5 flex items-center justify-center transition-colors shrink-0 border ${
            confirmed
              ? "bg-[#0073f3] border-[#0073f3] text-white"
              : "border-[#c7d2de] bg-white"
          }`}
        >
          {confirmed && (
            <svg viewBox="0 0 12 9" fill="none" className="size-3">
              <path
                d="M1 4.5L4.5 8L11 1"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <span className="text-sm text-[#242b33]">
          {referralMode === "identified"
            ? `I confirm this referral should be created for ${patientName}.`
            : "I confirm this anonymous referral should be created."}
          <span className="block text-xs text-[#6e8298] mt-0.5">
            {referralMode === "identified"
              ? "Na tabbatar da cewa ya kamata a ƙirƙiro wannan turawa ga majiyyaci."
              : "Na tabbatar da cewa ya kamata a ƙirƙiro wannan turawa ba tare da suna ba."}
          </span>
        </span>
      </button>

      {/* Primary Action Button */}
      <button
        type="button"
        id="generate-referral-btn"
        disabled={!confirmed || isLoading}
        onClick={() => onSubmit({ referralMode })}
        className="w-full py-4 rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-base transition-colors cursor-pointer"
      >
        {isLoading ? "Generating..." : "Confirm Referral & Generate Code"}
      </button>
    </div>
  );
}
