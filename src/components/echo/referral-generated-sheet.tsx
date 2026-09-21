"use client";

import { useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

interface ReferralGeneratedSheetProps {
  referralCode: string;
  createdAt?: string;
  onClose?: () => void;
  onComplete: () => void;
}

export function ReferralGeneratedSheet({
  referralCode,
  createdAt,
  onClose,
  onComplete,
}: ReferralGeneratedSheetProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (referralCode) {
      QRCode.toDataURL(referralCode, {
        width: 180,
        margin: 1,
        color: {
          dark: "#121619",
          light: "#FFFFFF",
        },
      })
        .then(setQrUrl)
        .catch((err) => console.error("QR generation error:", err));
    }
  }, [referralCode]);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast.success("Referral code copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate =
    createdAt ||
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] overflow-y-auto">
      <div className="w-full max-w-[460px] bg-white dark:bg-background rounded-[24px] p-6 sm:p-8 flex flex-col gap-5 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xl sm:text-2xl font-semibold text-[#121619]">
              Referral Generated
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              An Samar da Takardar Turawa
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="size-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-[#a1aebc] hover:text-[#242b33] transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>
          )}
        </div>

        <div className="h-px bg-[#f2f3f5] w-full" />

        {/* Date Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-[#09951c]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">
              Created
            </span>
          </div>
          <span className="text-sm text-[#6e8298]">{formattedDate}</span>
        </div>

        {/* QR Code Container */}
        <div className="bg-[#fbfbfc] rounded-[16px] py-5 px-4 flex flex-col items-center justify-center gap-3">
          <div className="p-2.5 bg-white rounded-[12px] shadow-sm">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={`QR code for ${referralCode}`}
                className="size-32 object-contain"
              />
            ) : (
              <div className="size-32 bg-gray-100 animate-pulse rounded-[4px]" />
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5 text-center">
            <p className="font-semibold text-sm sm:text-base text-[#242b33]">
              Show this code at the REACH Clinic
            </p>
            <p className="text-xs sm:text-sm text-[#6e8298]">
              Nuna wannan lambar a asibitin REACH
            </p>
          </div>
        </div>

        {/* Referral Code Card */}
        <div className="bg-[#fbfbfc] rounded-[14px] p-3.5 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
              Referral code
            </span>
            <span className="text-base sm:text-lg font-bold text-[#242b33] tracking-widest font-mono">
              {referralCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy referral code"
            className="size-10 rounded-[10px] bg-transparent hover:bg-[#eef2f6] flex items-center justify-center text-[#0073f3] transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="size-5 text-[#09951c]" />
            ) : (
              <Copy className="size-5" />
            )}
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3.5 sm:py-4 rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white font-medium text-base transition-colors cursor-pointer"
        >
          Complete assessment
        </button>
      </div>
    </div>
  );
}
