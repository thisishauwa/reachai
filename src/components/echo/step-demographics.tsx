"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * AC2 — Demographics screen matching the Sentinel prototype exactly.
 *
 * Fields (in order):
 *  1. Age            — free-text integer (years completed)
 *  2. Sex            — Female / Male / Other / not stated
 *  3. Pregnancy      — Not pregnant / not applicable | Pregnant | Not sure / prefer not to say
 *  4. Insurance      — No insurance | NHIA / other cover
 *  5. Distance       — Under 2 km | 2–5 km | Over 5 km
 *  6. Education      — None / primary | Secondary | Tertiary
 *  7. Occupation     — Trader | Farmer | Student | Other
 *  8. Visit type     — First visit | Follow-up
 *
 * Anonymous-only: no name / phone / identifiers.
 */

export interface DemographicsData {
  ageExact: number | null;
  sex: "female" | "male" | "other_not_stated";
  pregnancyStatus: "not_pregnant" | "pregnant" | "not_sure" | null;
  insuranceStatus: "no_insurance" | "nhia_or_other";
  distanceFromOutlet: "under_2km" | "2_5km" | "over_5km";
  educationLevel: "none_primary" | "secondary" | "tertiary";
  occupationType: "trader" | "farmer" | "student" | "other";
  visitType: "first_visit" | "follow_up";
}

interface StepDemographicsProps {
  sessionCode?: string;
  onGenerateNewCode?: () => void;
  onContinue: (data: DemographicsData) => void;
  onPrevious?: () => void;
}

// ── Tile grid helper ─────────────────────────────────────────────────────────
function TileGrid<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
  cols?: 1 | 2 | 3 | 4;
}) {
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2",
  }[cols];

  return (
    <div className={cn("grid gap-2", gridClass)}>
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value as T)}
            className={cn(
              "min-h-[52px] w-full rounded-[14px] px-4 py-3 text-left text-[14px] font-medium",
              "flex items-center justify-between gap-2",
              "border transition-all cursor-pointer",
              sel
                ? "border-[#1a8f76] bg-[#e8f5f2] text-[#1a8f76]"
                : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#f9f9f9]"
            )}
          >
            <span>{opt.label}</span>
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
  );
}

// ── Section label ────────────────────────────────────────────────────────────
function FieldLabel({
  label,
  sub,
  required,
}: {
  label: string;
  sub?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] font-semibold text-[#1a1a1a]">
        {label}
        {required && <span className="text-[#e05338] ml-0.5"> *</span>}
      </span>
      {sub && <span className="text-[13px] text-[#6e8298]">{sub}</span>}
    </div>
  );
}

export function StepDemographics({
  sessionCode,
  onGenerateNewCode,
  onContinue,
  onPrevious,
}: StepDemographicsProps) {
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<DemographicsData["sex"] | "">("");
  const [pregnancy, setPregnancy] = useState<DemographicsData["pregnancyStatus"] | "">("");
  const [insurance, setInsurance] = useState<DemographicsData["insuranceStatus"] | "">("");
  const [distance, setDistance] = useState<DemographicsData["distanceFromOutlet"] | "">("");
  const [education, setEducation] = useState<DemographicsData["educationLevel"] | "">("");
  const [occupation, setOccupation] = useState<DemographicsData["occupationType"] | "">("");
  const [visitType, setVisitType] = useState<DemographicsData["visitType"] | "">("");

  const handleContinue = () => {
    if (!sex) return toast.error("Please select a sex");
    if (!pregnancy && sex === "female") return toast.error("Please select pregnancy status");
    if (!insurance) return toast.error("Please select health insurance status");
    if (!distance) return toast.error("Please select distance from outlet");
    if (!education) return toast.error("Please select education level");
    if (!occupation) return toast.error("Please select occupation");
    if (!visitType) return toast.error("Please select visit type");

    onContinue({
      ageExact: age ? parseInt(age, 10) : null,
      sex: sex as DemographicsData["sex"],
      pregnancyStatus: pregnancy || (sex === "female" ? null : "not_pregnant"),
      insuranceStatus: insurance as DemographicsData["insuranceStatus"],
      distanceFromOutlet: distance as DemographicsData["distanceFromOutlet"],
      educationLevel: education as DemographicsData["educationLevel"],
      occupationType: occupation as DemographicsData["occupationType"],
      visitType: visitType as DemographicsData["visitType"],
    });
  };

  return (
    <div className="w-full flex flex-col gap-0 bg-[#f2f3f0] min-h-screen">
      {/* Card */}
      <div className="flex flex-col gap-6 p-5 sm:p-8 pb-32">
        {/* Heading */}
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6e8298]">
            MODULE A · About patient
          </p>
          <h2 className="text-[26px] sm:text-[30px] font-bold text-[#1a1a1a] leading-tight">
            Who is visiting today?
          </h2>
          <p className="text-[14px] text-[#6e8298]">
            Bayanan mara lafiya · patient details
          </p>
        </div>

        {/* ── Study Code Card (matching Sentinel image) ──────────── */}
        {sessionCode && (
          <div className="bg-[#eef6f3] border border-[#c4e4dc] rounded-[16px] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-[12px] bg-[#d9eee7] flex items-center justify-center text-[#1a8f76] shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="size-5 stroke-[#1a8f76]" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[#6e8298] uppercase">
                  STUDY CODE
                </p>
                <p className="text-[17px] font-bold text-[#1a3a34] tracking-tight">
                  {sessionCode}
                </p>
              </div>
            </div>
            {onGenerateNewCode && (
              <button
                type="button"
                onClick={onGenerateNewCode}
                className="px-3 py-1.5 rounded-[10px] bg-white border border-[#c4e4dc] text-[#1a3a34] text-[13px] font-semibold hover:bg-[#f6faf8] transition-colors cursor-pointer shadow-sm"
              >
                Generate new
              </button>
            )}
          </div>
        )}

        {/* ── Age ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Age" sub="Years completed" />
          <input
            id="age-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 29"
            className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-[15px] text-[#1a1a1a] placeholder:text-[#c7d2de] outline-none focus:ring-2 focus:ring-[#1a8f76] transition-all"
          />
        </div>

        {/* ── Sex ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Sex" required />
          <TileGrid
            cols={2}
            value={sex}
            onChange={(s) => {
              setSex(s);
              if (s === "male" && !pregnancy) {
                setPregnancy("not_pregnant");
              }
            }}
            options={[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
              { value: "other_not_stated", label: "Other / not stated" },
            ]}
          />
        </div>

        {/* ── Pregnancy status (matches Sentinel image) ──────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Pregnancy status" sub="For care planning only" />
          <TileGrid
            cols={1}
            value={(pregnancy ?? "") as string}
            onChange={(v) => setPregnancy(v as DemographicsData["pregnancyStatus"])}
            options={[
              { value: "not_pregnant", label: "Not pregnant / not applicable" },
              { value: "pregnant", label: "Pregnant" },
              { value: "not_sure", label: "Not sure / prefer not to say" },
            ]}
          />
        </div>

        {/* ── Health Insurance ─────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Health insurance" required />
          <TileGrid
            cols={2}
            value={insurance}
            onChange={setInsurance}
            options={[
              { value: "no_insurance", label: "No insurance" },
              { value: "nhia_or_other", label: "NHIA / other cover" },
            ]}
          />
        </div>

        {/* ── Distance ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Distance" sub="Approximate travel from this outlet" required />
          <TileGrid
            cols={2}
            value={distance}
            onChange={setDistance}
            options={[
              { value: "under_2km", label: "Under 2 km" },
              { value: "2_5km", label: "2–5 km" },
              { value: "over_5km", label: "Over 5 km" },
            ]}
          />
        </div>

        {/* ── Education ────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Education" required />
          <TileGrid
            cols={2}
            value={education}
            onChange={setEducation}
            options={[
              { value: "none_primary", label: "None / primary" },
              { value: "secondary", label: "Secondary" },
              { value: "tertiary", label: "Tertiary" },
            ]}
          />
        </div>

        {/* ── Occupation ───────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Occupation" required />
          <TileGrid
            cols={2}
            value={occupation}
            onChange={setOccupation}
            options={[
              { value: "trader", label: "Trader" },
              { value: "farmer", label: "Farmer" },
              { value: "student", label: "Student" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>

        {/* ── Visit type ───────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <FieldLabel label="Visit type" required />
          <TileGrid
            cols={2}
            value={visitType}
            onChange={setVisitType}
            options={[
              { value: "first_visit", label: "First visit" },
              { value: "follow_up", label: "Follow-up" },
            ]}
          />
        </div>
      </div>

      {/* ── Bottom bar — fixed ───────────────────────────────────── */}
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
          id="demographics-continue-btn"
          onClick={handleContinue}
          className="flex-1 max-w-xs h-12 rounded-[14px] bg-[#1a3a34] hover:bg-[#142e28] text-white font-semibold text-[15px] transition-colors cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
