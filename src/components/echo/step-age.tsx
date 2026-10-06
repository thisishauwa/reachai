"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check } from "lucide-react";

export interface AgeData {
  ageExact: number | null;
  ageBand: string;
  sex: "female" | "male" | "other_not_stated";
  isMinor: boolean;
}

export function ageExactToBand(age: number | null): string {
  if (age === null || isNaN(age)) return "25_49_years";
  if (age <= 0) return "0_28_days";
  if (age < 1) return "1_11_months";
  if (age <= 4) return "1_4_years";
  if (age <= 14) return "5_14_years";
  if (age <= 24) return "15_24_years";
  if (age <= 49) return "25_49_years";
  if (age <= 64) return "50_64_years";
  return "65_plus";
}

function TileGrid<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T | "";
  onChange: (v: T) => void;
  cols?: 1 | 2 | 3;
}) {
  const gridClass = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-3" }[cols];

  return (
    <div className={cn("grid gap-2 sm:gap-2.5", gridClass)}>
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value as T)}
            className={cn(
              "w-full rounded-[14px] px-4 py-3.5 text-left text-sm sm:text-base font-medium",
              "flex items-center justify-between gap-3",
              "transition-all cursor-pointer border",
              sel
                ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
            )}
          >
            <div className="flex flex-col min-w-0">
              <span className={cn("leading-snug truncate", sel ? "font-semibold" : "font-normal")}>
                {opt.label}
              </span>
              {opt.sub && (
                <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">{opt.sub}</span>
              )}
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
  );
}

interface StepAgeProps {
  onContinue: (data: AgeData) => void;
  onPrevious?: () => void;
}

export function StepAge({ onContinue, onPrevious }: StepAgeProps) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "other_not_stated" | "">("");

  const handleContinue = () => {
    if (!sex) return toast.error("Please select a sex option");

    const parsedAge = age.trim() ? parseInt(age, 10) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120)) {
      return toast.error("Please enter a valid age between 0 and 120");
    }

    const band = ageExactToBand(parsedAge);
    const isMinor = parsedAge !== null && parsedAge < 18;

    onContinue({
      ageExact: parsedAge,
      ageBand: band,
      sex: sex as "female" | "male" | "other_not_stated",
      isMinor,
    });
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
              Step 1 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Patient Age</span> &amp; Sex
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Shekaru da jinsin mai cutar — Age determines consent type.
            </p>
          </div>

          {/* Age Input */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="age-input" className="text-sm sm:text-base font-medium text-[#242b33]">
                Age <span className="text-[#6e8298] font-normal">(years completed)</span>
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">
                Leave blank if unknown — Shekaru. Under 18 = parental consent required.
              </p>
            </div>
            <input
              id="age-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 29"
              className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all"
            />
            {age && parseInt(age, 10) < 18 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#fff8ec] border border-[#f5c842] rounded-[10px]">
                <span className="text-[#c98800] text-xs font-medium">
                  ⚠️ Minor detected — parental/guardian consent will be required on the next screen.
                </span>
              </div>
            )}
          </div>

          {/* Sex */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-3.5">
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33] flex items-center gap-1">
                Sex <span className="text-[#e05338]">*</span>
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">Jinsi</p>
            </div>
            <TileGrid
              cols={3}
              value={sex}
              onChange={(s) => setSex(s)}
              options={[
                { value: "female", label: "Female", sub: "Mace" },
                { value: "male", label: "Male", sub: "Namiji" },
                { value: "other_not_stated", label: "Other / Not stated", sub: "Sauran" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f0f7ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#0073f3] text-sm sm:text-base font-medium">Age &amp; Sex</span>
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
            id="age-continue-btn"
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Continue to consent
          </button>
        </div>
      </div>
    </div>
  );
}
