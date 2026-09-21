"use client";

import { useState } from "react";
import { X, UserCheck, UserX, Edit3, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { PrivacyMode } from "@/lib/supabase/database.types";

interface ReferralConsentModalProps {
  initialMode?: PrivacyMode;
  patientName?: string;
  onClose?: () => void;
  onSubmit: (data: {
    referralMode: PrivacyMode;
    signatureMethod?: "type" | "draw";
    signatureText?: string;
  }) => void;
}

export function ReferralConsentModal({
  initialMode = "identified",
  patientName = "Oyintari Werinipre",
  onClose,
  onSubmit,
}: ReferralConsentModalProps) {
  const [referralMode, setReferralMode] = useState<PrivacyMode>(initialMode);
  const [signatureMethod, setSignatureMethod] = useState<"type" | "draw">("draw");
  const [signatureText, setSignatureText] = useState(patientName);
  const [drawnSignature, setDrawnSignature] = useState(false);

  const handleSubmit = () => {
    if (referralMode === "identified") {
      if (signatureMethod === "type" && !signatureText.trim()) {
        toast.error("Please enter the patient full name signature");
        return;
      }
      onSubmit({
        referralMode: "identified",
        signatureMethod,
        signatureText: signatureText.trim(),
      });
    } else {
      onSubmit({
        referralMode: "anonymous",
      });
    }
  };

  return (
    <div className="w-full bg-white dark:bg-background rounded-[24px] p-6 sm:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#121619]">
            Patient Consent
          </h2>
          <p className="text-sm sm:text-base text-[#6e8298]">
            Amincewar Maralafiya
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="size-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-[#a1aebc] hover:text-[#242b33] transition-colors"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="h-px bg-[#f2f3f5] w-full" />

      {/* Select Referral Mode */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">
          Select Referral Mode
        </span>

        {/* Option 1: Identified Referral Mode */}
        <button
          type="button"
          onClick={() => setReferralMode("identified")}
          className={cn(
            "w-full p-4 sm:p-5 rounded-[16px] flex items-start gap-4 text-left transition-all cursor-pointer border",
            referralMode === "identified"
              ? "border-[#0073f3] bg-[#f0f7ff]"
              : "border-[#e4e8ec] bg-white hover:bg-gray-50/70"
          )}
        >
          <div
            className={cn(
              "size-11 rounded-[12px] flex items-center justify-center shrink-0 transition-colors",
              referralMode === "identified"
                ? "bg-[#cce3fd] text-[#0073f3]"
                : "bg-[#f2f3f5] text-[#6e8298]"
            )}
          >
            <UserCheck className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-[#242b33]">
              Identified Mode
            </span>
            <p className="text-xs sm:text-sm text-[#6e8298] leading-relaxed">
              Shares patient name and details with REACH clinic for seamless care
              continuity. Requires written consent.
            </p>
          </div>
        </button>

        {/* Option 2: Anonymous Syndromic Mode */}
        <button
          type="button"
          onClick={() => setReferralMode("anonymous")}
          className={cn(
            "w-full p-4 sm:p-5 rounded-[16px] flex items-start gap-4 text-left transition-all cursor-pointer border",
            referralMode === "anonymous"
              ? "border-[#0073f3] bg-[#f0f7ff]"
              : "border-[#e4e8ec] bg-white hover:bg-gray-50/70"
          )}
        >
          <div
            className={cn(
              "size-11 rounded-[12px] flex items-center justify-center shrink-0 transition-colors",
              referralMode === "anonymous"
                ? "bg-[#cce3fd] text-[#0073f3]"
                : "bg-[#f2f3f5] text-[#6e8298]"
            )}
          >
            <UserX className="size-5" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-base text-[#242b33]">
              Anonymous Syndromic Mode
            </span>
            <p className="text-xs sm:text-sm text-[#6e8298] leading-relaxed">
              Generates a referral ID based only on symptoms. No personal data is
              shared.
            </p>
          </div>
        </button>
      </div>

      {/* Identified Details: Agreement & Signature (Figma 0:3152 & 0:3241) */}
      {referralMode === "identified" && (
        <div className="flex flex-col gap-5 pt-1">
          {/* Data Protection Agreement */}
          <div className="bg-[#fbfbfc] rounded-[16px] p-5 flex flex-col gap-3">
            <span className="font-semibold text-base text-[#242b33]">
              Data Protection Agreement
            </span>
            <p className="text-sm text-[#6e8298] leading-relaxed">
              I consent to sharing my personal and medical information with the
              REACH clinic for the purpose of this referral. I understand that my
              data will be protected under NHREC and GDPR standards, and my
              participation is voluntary.
            </p>
            <div className="h-px bg-[#f2f3f5] w-full my-1" />
            <p className="text-sm text-[#6e8298] leading-relaxed">
              Na amince a raba bayanai na na sirri da na lafiya tare da asibitin
              REACH don wannan turawa. Na fahimci cewa za a kiyaye bayanai na,
              kuma shiga ta na da radin kaina ne.
            </p>
          </div>

          {/* Patient Signature */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                Patient signature
              </span>
              <div className="bg-[#f2f3f5] p-0.5 rounded-[8px] flex items-center">
                <button
                  type="button"
                  onClick={() => setSignatureMethod("draw")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                    signatureMethod === "draw"
                      ? "bg-white text-[#242b33] shadow-sm"
                      : "text-[#a1aebc] hover:text-[#495766]"
                  )}
                >
                  <Edit3 className="size-3.5" />
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMethod("type")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors",
                    signatureMethod === "type"
                      ? "bg-white text-[#242b33] shadow-sm"
                      : "text-[#a1aebc] hover:text-[#495766]"
                  )}
                >
                  <Keyboard className="size-3.5" />
                  Type
                </button>
              </div>
            </div>

            {signatureMethod === "type" ? (
              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Enter full name"
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3.5 text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all"
              />
            ) : (
              <div className="flex flex-col gap-2">
                <div
                  onClick={() => setDrawnSignature(true)}
                  className="w-full h-28 bg-[#fbfbfc] border border-[#e4e8ec] rounded-[12px] flex items-center justify-center text-[#a1aebc] text-sm cursor-crosshair hover:bg-white transition-colors select-none"
                >
                  {drawnSignature ? (
                    <span className="font-serif italic text-xl text-[#001f3e]">
                      {signatureText || patientName}
                    </span>
                  ) : (
                    "Sign here/Sa hannu a nan"
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDrawnSignature(false)}
                    className="text-xs text-[#d4583b] hover:underline font-medium"
                  >
                    Clear signature
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full py-4 rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white font-medium text-base transition-colors cursor-pointer"
      >
        {referralMode === "anonymous"
          ? "Generate anonymous referral"
          : "Confirm consent & generate referral"}
      </button>
    </div>
  );
}
