"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { REQUEST_OPTIONS } from "@/lib/reference/request-options";

export interface RequestData {
  requestType: string;
}

interface StepRequestProps {
  initialValue?: string;
  onContinue: (data: RequestData) => void;
  onPrevious?: () => void;
}

/**
 * Step 1 of 6 — "What is the customer asking for?" (spec v0.3 Step 1 / walkthrough
 * v0.4 screen 3). One tap, no health questions. Logged for surveillance only — it
 * never routes or changes any later question (AC3).
 */
export function StepRequest({
  initialValue,
  onContinue,
  onPrevious,
}: StepRequestProps) {
  const [selected, setSelected] = useState<string>(initialValue ?? "");

  const handleContinue = () => {
    if (!selected) return;
    onContinue({ requestType: selected });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Step 1 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">What is the customer</span> asking
              for?
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Tap one. No health questions yet.
            </p>
            <p className="text-xs sm:text-sm text-[#a1aebc] italic">
              Me kuke bukata? Danna daya. Babu tambayoyin lafiya tukuna.
            </p>
          </div>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5"
            role="radiogroup"
            aria-label="What is the customer asking for?"
          >
            {REQUEST_OPTIONS.map((opt) => {
              const sel = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  id={`request-option-${opt.value}`}
                  onClick={() => setSelected(opt.value)}
                  className={cn(
                    "w-full min-h-11 rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
                    "flex items-center justify-between gap-3",
                    "transition-all cursor-pointer border",
                    sel
                      ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                      : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]",
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span
                      className={cn(
                        "leading-snug truncate",
                        sel ? "font-semibold" : "font-normal",
                      )}
                    >
                      {opt.label_en}
                    </span>
                    <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                      {opt.label_ha}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                      sel
                        ? "bg-[#0073f3] border-[#0073f3] text-white"
                        : "border-[#c7d2de] bg-white",
                    )}
                  >
                    {sel && <Check className="size-3 stroke-3" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-xs sm:text-sm text-[#6e8298]">
            Logged for surveillance. This does not decide which questions come
            next.
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f0f7ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#0073f3] text-sm sm:text-base font-medium">
            Request
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-[12px] border border-[#e4e8ec] bg-white hover:bg-[#fafafa] text-[#495766] px-5 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
            >
              Previous
            </button>
          )}
          <button
            type="button"
            id="request-continue-btn"
            disabled={!selected}
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
