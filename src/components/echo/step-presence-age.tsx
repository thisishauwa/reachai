"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import {
  IDSR_AGE_BANDS,
  PRESENCE_OPTIONS,
  isMinorAgeBand,
  type PatientPresence,
} from "@/lib/reference/request-options";

export interface PresenceAgeData {
  presence: PatientPresence;
  ageBand: string;
  isMinor: boolean;
}

interface StepPresenceAgeProps {
  initialPresence?: PatientPresence | "";
  initialAgeBand?: string;
  onContinue: (data: PresenceAgeData) => void;
  onPrevious?: () => void;
}

/**
 * Step 2 of 6 — "Is the patient here now?" + age band (spec v0.3 Step 2 /
 * walkthrough v0.4 screen 4). Two taps, before any health question. Nothing is
 * saved yet — these answers only decide how the look-check is worded and who
 * may give consent later (AC4).
 */
export function StepPresenceAge({
  initialPresence = "",
  initialAgeBand = "",
  onContinue,
  onPrevious,
}: StepPresenceAgeProps) {
  const [presence, setPresence] = useState<PatientPresence | "">(initialPresence);
  const [ageBand, setAgeBand] = useState<string>(initialAgeBand);
  const [touched, setTouched] = useState(false);

  const presenceInvalid = touched && !presence;
  const ageBandInvalid = touched && !ageBand;
  const canContinue = Boolean(presence) && Boolean(ageBand);

  const handleContinue = () => {
    setTouched(true);
    if (!canContinue) return;
    onContinue({
      presence: presence as PatientPresence,
      ageBand,
      isMinor: isMinorAgeBand(ageBand),
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Step 2 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Who is the medicine for?</span>
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Two taps, before any health question.
            </p>
          </div>

          {/* Presence */}
          <div
            className={cn(
              "bg-white rounded-[16px] p-5 sm:p-6 border flex flex-col gap-3.5 transition-colors",
              presenceInvalid ? "border-[#e05338]" : "border-[#e4e8ec]"
            )}
          >
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33] flex items-center gap-1">
                Is the patient here now? <span className="text-[#e05338]">*</span>
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">Shin majiyyacin yana nan yanzu?</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5" role="radiogroup" aria-label="Is the patient here now?">
              {PRESENCE_OPTIONS.map((opt) => {
                const sel = presence === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    id={`presence-option-${opt.value}`}
                    onClick={() => setPresence(opt.value)}
                    className={cn(
                      "w-full min-h-11 rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
                      "flex items-center justify-between gap-3 transition-all cursor-pointer border",
                      sel
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={cn("leading-snug truncate", sel ? "font-semibold" : "font-normal")}>
                        {opt.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                        {opt.label_ha}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                        sel ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#c7d2de] bg-white"
                      )}
                    >
                      {sel && <Check className="size-3 stroke-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {presenceInvalid && (
              <p className="text-xs font-medium text-[#e05338]">
                Please select whether the patient is here now.
              </p>
            )}
          </div>

          {/* Age band */}
          <div
            className={cn(
              "bg-white rounded-[16px] p-5 sm:p-6 border flex flex-col gap-3.5 transition-colors",
              ageBandInvalid ? "border-[#e05338]" : "border-[#e4e8ec]"
            )}
          >
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33] flex items-center gap-1">
                How old is the patient? <span className="text-[#e05338]">*</span>
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">Shekarun majiyyacin</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5" role="radiogroup" aria-label="How old is the patient?">
              {IDSR_AGE_BANDS.map((band) => {
                const sel = ageBand === band.value;
                return (
                  <button
                    key={band.value}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    id={`age-band-option-${band.value}`}
                    onClick={() => setAgeBand(band.value)}
                    className={cn(
                      "w-full min-h-11 rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
                      "flex items-center justify-between gap-3 transition-all cursor-pointer border",
                      sel
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={cn("leading-snug truncate", sel ? "font-semibold" : "font-normal")}>
                        {band.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                        {band.label_ha}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                        sel ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#c7d2de] bg-white"
                      )}
                    >
                      {sel && <Check className="size-3 stroke-3" />}
                    </div>
                  </button>
                );
              })}
            </div>
            {ageBandInvalid && (
              <p className="text-xs font-medium text-[#e05338]">
                Please select an age band.
              </p>
            )}
          </div>

          <div className="bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-xs sm:text-sm text-[#6e8298]">
            Nothing is saved yet. These two answers decide how the next screen is worded and who may give consent.
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-between gap-3 pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
          {onPrevious ? (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-[12px] border border-[#e4e8ec] bg-white hover:bg-[#fafafa] text-[#495766] px-5 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
            >
              Previous
            </button>
          ) : <span />}
          <button
            type="button"
            id="presence-age-continue-btn"
            onClick={handleContinue}
            aria-disabled={!canContinue}
            className={cn(
              "rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm",
              !canContinue && "opacity-50"
            )}
          >
            Continue
          </button>
      </div>
    </div>
  );
}
