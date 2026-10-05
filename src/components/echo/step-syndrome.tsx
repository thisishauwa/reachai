"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DANGER_SIGNS,
  DEHYDRATION_OPTIONS,
  dangerSignsToSyndromes,
  type DehydrationLevel,
} from "@/lib/reference/individual-symptoms";

/**
 * AC3 — "Check danger signs" screen matching the Sentinel stakeholder prototype.
 *
 * Section 1 — Danger signs · alamun hatsari
 *   6 checkboxes, select all that apply.
 *
 * Section 2 — Dehydration · rashin ruwa
 *   Separate sub-section: No / Mild / moderate / Severe
 *   (always shown, separate from the checkbox list)
 *
 * Continue is always enabled so a PPMV with zero signs can still submit.
 * The selected codes + dehydration level are converted to IDSR syndrome IDs
 * for the backend.
 */

interface StepSyndromeProps {
  sessionCode?: string;
  onSelect: (
    symptomCodes: string[],
    syndromeIds: string[],
    labels: string[]
  ) => void;
  onPrevious?: () => void;
}

export function StepSyndrome({
  sessionCode,
  onSelect,
  onPrevious,
}: StepSyndromeProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dehydration, setDehydration] = useState<DehydrationLevel>("no");

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const handleContinue = () => {
    const codes = Array.from(checked);
    const syndromeIds = dangerSignsToSyndromes(codes, dehydration);

    // Include dehydration in codes so backend / questions step knows
    const allCodes = dehydration !== "no" ? [...codes, `DEHYDRATION_${dehydration.toUpperCase()}`] : codes;

    const labels = [
      ...codes.map(
        (c) => DANGER_SIGNS.find((s) => s.code === c)?.label_en ?? c
      ),
      ...(dehydration !== "no"
        ? [DEHYDRATION_OPTIONS.find((o) => o.value === dehydration)?.label_en ?? "Dehydration"]
        : []),
    ];

    onSelect(allCodes, syndromeIds, labels);
  };

  return (
    <div className="w-full flex flex-col gap-0 bg-[#f2f3f0] min-h-screen">
      <div className="flex flex-col gap-6 p-5 sm:p-8 pb-32">
        {/* Heading */}
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6e8298]">
            MODULE B+ · Danger signs
          </p>
          <h2 className="text-[26px] sm:text-[30px] font-bold text-[#1a1a1a] leading-tight">
            Check danger signs
          </h2>
          <p className="text-[14px] text-[#6e8298]">
            Alamun hatsari · danger signs. Tick what you notice, even if you are unsure.
          </p>
        </div>

        {/* ── Section 1: Danger signs checkboxes ──────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#1a1a1a]">
              Danger signs · alamun hatsari
            </span>
            <span className="text-[13px] text-[#6e8298]">Select all that apply</span>
          </div>

          <div className="flex flex-col gap-2">
            {DANGER_SIGNS.map((sign) => {
              const isChecked = checked.has(sign.code);
              return (
                <button
                  key={sign.id}
                  type="button"
                  id={`danger-sign-${sign.code.toLowerCase()}`}
                  onClick={() => toggle(sign.code)}
                  className={cn(
                    "w-full bg-white rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                    isChecked
                      ? "border-[#1a8f76] ring-1 ring-[#1a8f76]"
                      : "border-[#e4e8ec] hover:bg-[#f9f9f9]"
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] font-semibold text-[#1a1a1a] leading-snug">
                      {sign.label_en}
                    </span>
                    <span className="text-[13px] text-[#6e8298]">
                      {sign.label_ha}
                    </span>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={cn(
                      "size-6 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all",
                      isChecked
                        ? "border-[#1a8f76] bg-[#1a8f76]"
                        : "border-[#c7d2de] bg-white"
                    )}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 12 9" fill="none" className="size-3">
                        <path
                          d="M1 4.5L4.5 8L11 1"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Dehydration sub-section ──────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#1a1a1a]">
              Dehydration · rashin ruwa
            </span>
            <span className="text-[13px] text-[#6e8298]">Mild, moderate, or severe</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEHYDRATION_OPTIONS.map((opt) => {
              const sel = dehydration === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  id={`dehydration-${opt.value}`}
                  onClick={() => setDehydration(opt.value)}
                  className={cn(
                    "min-h-[52px] w-full rounded-[14px] px-4 py-3 text-left text-[14px] font-medium",
                    "flex items-center justify-between gap-2",
                    "border transition-all cursor-pointer",
                    sel
                      ? "border-[#1a8f76] bg-[#e8f5f2] text-[#1a8f76]"
                      : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#f9f9f9]"
                  )}
                >
                  <span>{opt.label_en}</span>
                  {sel && (
                    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                      <path
                        d="M3 8.5L6.5 12L13 5"
                        stroke="#1a8f76"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom bar — fixed ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-5 py-4 bg-[#f2f3f0] border-t border-[#e4e8ec]">
        {onPrevious ? (
          <button
            type="button"
            onClick={onPrevious}
            className="size-11 rounded-full bg-white border border-[#e4e8ec] text-[#6e8298] flex items-center justify-center hover:bg-[#f9f9f9] transition-colors cursor-pointer"
            aria-label="Go back"
          >
            ←
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          id="symptom-continue-btn"
          onClick={handleContinue}
          className="flex-1 max-w-xs h-12 rounded-[14px] bg-[#1a3a34] hover:bg-[#142e28] text-white font-semibold text-[15px] transition-colors cursor-pointer"
        >
          Continue
          {checked.size > 0 && (
            <span className="ml-2 text-[13px] opacity-70">
              ({checked.size} selected)
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
