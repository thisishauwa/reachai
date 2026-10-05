"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { UserCheck, UserPlus, Search, Check, ChevronDown } from "lucide-react";
import { usePatients } from "@/lib/queries/patients";
import { useSession } from "@/lib/session/session-context";
import type { PrivacyMode } from "@/lib/supabase/database.types";

/**
 * Demographics screen matching the Sentinel prototype with support for both
 * Identified Patient (linked records, care continuity) and Anonymous (study code) modes.
 */

export interface DemographicsData {
  fullName?: string;
  phone?: string;
  existingPatientId?: string;
  ageExact: number | null;
  ageBand: string;
  sex: "female" | "male" | "other_not_stated";
  pregnancyStatus: "not_pregnant" | "pregnant" | "not_sure" | null;
  insuranceStatus: "no_insurance" | "nhia_or_other";
  distanceFromOutlet: "under_2km" | "2_5km" | "over_5km";
  educationLevel: "none_primary" | "secondary" | "tertiary";
  occupationType: "trader" | "farmer" | "student" | "other";
  visitType: "first_visit" | "follow_up";
}

interface StepDemographicsProps {
  privacyMode?: PrivacyMode;
  sessionCode?: string;
  onGenerateNewCode?: () => void;
  onContinue: (data: DemographicsData) => void;
  onPrevious?: () => void;
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
  privacyMode = "identified",
  sessionCode,
  onGenerateNewCode,
  onContinue,
  onPrevious,
}: StepDemographicsProps) {
  const { activeFacility } = useSession();
  const { data: existingPatients = [] } = usePatients(activeFacility?.facilityId);

  // Identified fields
  const [patientChoice, setPatientChoice] = useState<"new" | "existing">("new");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Sentinel Shared demographic fields
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<DemographicsData["sex"] | "">("");
  const [pregnancy, setPregnancy] = useState<DemographicsData["pregnancyStatus"] | "">("");
  const [insurance, setInsurance] = useState<DemographicsData["insuranceStatus"] | "">("");
  const [distance, setDistance] = useState<DemographicsData["distanceFromOutlet"] | "">("");
  const [education, setEducation] = useState<DemographicsData["educationLevel"] | "">("");
  const [occupation, setOccupation] = useState<DemographicsData["occupationType"] | "">("");
  const [visitType, setVisitType] = useState<DemographicsData["visitType"] | "">("");

  const handleSelectExisting = (patientId: string) => {
    setSelectedPatientId(patientId);
    const p = existingPatients.find((pt) => pt.id === patientId);
    if (!p) return;
    setFullName(p.full_name);
    setPhone(p.phone_e164 ? p.phone_e164.replace(/^\+234/, "0") : "");
    if (p.sex === "female" || p.sex === "male") {
      setSex(p.sex);
    }
    if (p.pregnancy_status === "pregnant" || p.pregnancy_status === "not_pregnant") {
      setPregnancy(p.pregnancy_status);
    }
  };

  const handleContinue = () => {
    if (privacyMode === "identified") {
      if (patientChoice === "existing" && !selectedPatientId) {
        return toast.error("Please select an existing patient");
      }
      if (patientChoice === "new" && !fullName.trim()) {
        return toast.error("Please enter the patient's full name");
      }
    }

    if (!sex) return toast.error("Please select a sex");
    if (!pregnancy && sex === "female") return toast.error("Please select pregnancy status");
    if (!insurance) return toast.error("Please select health insurance status");
    if (!distance) return toast.error("Please select distance from outlet");
    if (!education) return toast.error("Please select education level");
    if (!occupation) return toast.error("Please select occupation");
    if (!visitType) return toast.error("Please select visit type");

    const parsedAge = age ? parseInt(age, 10) : null;
    const band = ageExactToBand(parsedAge);

    onContinue({
      fullName: privacyMode === "identified" ? fullName.trim() : undefined,
      phone: privacyMode === "identified" && phone.trim() ? phone.trim() : undefined,
      existingPatientId: privacyMode === "identified" && patientChoice === "existing" ? selectedPatientId : undefined,
      ageExact: parsedAge,
      ageBand: band,
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

        {/* ── Mode Banner / Code Card ──────────── */}
        {privacyMode === "anonymous" ? (
          sessionCode && (
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
                    STUDY CODE (ANONYMOUS)
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
          )
        ) : (
          /* Identified Mode: Patient selection or entry */
          <div className="bg-white rounded-[16px] p-4 sm:p-5 border border-[#e4e8ec] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#1a1a1a]">
                Patient Information
              </span>
              {existingPatients.length > 0 && (
                <div className="inline-flex bg-[#f2f3f5] p-0.5 rounded-[8px]">
                  <button
                    type="button"
                    onClick={() => setPatientChoice("new")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-[6px] transition-all cursor-pointer",
                      patientChoice === "new"
                        ? "bg-white text-[#242b33] shadow-sm"
                        : "text-[#6e8298]"
                    )}
                  >
                    New Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientChoice("existing")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-[6px] transition-all cursor-pointer",
                      patientChoice === "existing"
                        ? "bg-white text-[#242b33] shadow-sm"
                        : "text-[#6e8298]"
                    )}
                  >
                    Existing Patient
                  </button>
                </div>
              )}
            </div>

            {patientChoice === "existing" && existingPatients.length > 0 ? (
              <div className="flex flex-col gap-2">
                <FieldLabel label="Select Patient" required />
                <select
                  value={selectedPatientId}
                  onChange={(e) => handleSelectExisting(e.target.value)}
                  className="w-full bg-[#fafafa] rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-[15px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all cursor-pointer"
                >
                  <option value="">Select a registered patient...</option>
                  {existingPatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel label="Full Name" required />
                  <input
                    type="text"
                    id="patient-fullname-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Amina Ibrahim"
                    className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-[15px] text-[#1a1a1a] placeholder:text-[#c7d2de] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel label="Phone Number" sub="Optional" />
                  <input
                    type="tel"
                    id="patient-phone-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3 text-[15px] text-[#1a1a1a] placeholder:text-[#c7d2de] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all"
                  />
                </div>
              </div>
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
