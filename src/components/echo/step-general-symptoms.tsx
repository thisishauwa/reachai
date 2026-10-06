"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GENERAL_SYMPTOMS,
  type GeneralSymptom,
} from "@/lib/reference/individual-symptoms";

interface StepGeneralSymptomsProps {
  initialSelected?: string[];
  onContinue: (symptomCodes: string[], labels: string[]) => void;
  onPrevious: () => void;
}

export function StepGeneralSymptoms({
  initialSelected = [],
  onContinue,
  onPrevious,
}: StepGeneralSymptomsProps) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(initialSelected)
  );

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const handleContinue = () => {
    const codes = Array.from(checked);
    const labels = codes.map(
      (c) => GENERAL_SYMPTOMS.find((s) => s.code === c)?.label_en ?? c
    );
    onContinue(codes, labels);
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Eyebrow & Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Outpatient Triage · Binciken Alamomi
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Normal symptoms</span> · Alamomin da aka saba gani
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              No IDSR danger signs detected. Tick any symptoms reported by the patient for routine outlet care and counseling.
            </p>
          </div>

          {/* Symptom Tiles Grid */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-4 shadow-none">
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33]">
                Reported Symptoms (Select all that apply)
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">
                Alamomin rashin lafiya da aka bayyana
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GENERAL_SYMPTOMS.map((symptom: GeneralSymptom) => {
                const isChecked = checked.has(symptom.code);
                return (
                  <button
                    key={symptom.id}
                    type="button"
                    id={`general-symptom-${symptom.code.toLowerCase()}`}
                    onClick={() => toggle(symptom.code)}
                    className={cn(
                      "w-full rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                      isChecked
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span
                        className={cn(
                          "text-sm sm:text-base leading-snug truncate",
                          isChecked ? "font-semibold" : "font-medium"
                        )}
                      >
                        {symptom.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                        {symptom.label_ha}
                      </span>
                      <span className="text-[11px] text-[#8e8e8e] leading-tight mt-1 truncate">
                        {symptom.description_en}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "size-5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-[#0073f3] border-[#0073f3] text-white"
                          : "border-[#c7d2de] bg-white"
                      )}
                    >
                      {isChecked && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Actions Bar ──────────────────────────────────────── */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#eff6ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#0073f3] text-sm sm:text-base font-medium">
            Normal Symptoms
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="general-symptoms-prev-btn"
            onClick={onPrevious}
            className="rounded-[12px] border border-[#e4e8ec] bg-white hover:bg-[#fafafa] text-[#495766] px-5 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            id="general-symptoms-continue-btn"
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Complete assessment
            {checked.size > 0 && (
              <span className="ml-2 text-xs font-normal opacity-90">
                ({checked.size} selected)
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
