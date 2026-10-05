"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Hash, RefreshCw, UserCheck } from "lucide-react";
import { usePatients } from "@/lib/queries/patients";
import { useSession } from "@/lib/session/session-context";
import type { PrivacyMode } from "@/lib/supabase/database.types";

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

// ── Tile Grid Option Selector ────────────────────────────────────────────────
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
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
  }[cols];

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
                <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                  {opt.sub}
                </span>
              )}
            </div>
            <div
              className={cn(
                "size-5 rounded-full flex items-center justify-center shrink-0 transition-colors border",
                sel
                  ? "bg-[#0073f3] border-[#0073f3] text-white"
                  : "border-[#c7d2de] bg-white"
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

function SectionCard({
  title,
  subtitle,
  required,
  children,
}: {
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-3.5 shadow-none">
      <div className="flex flex-col gap-0.5">
        <label className="text-sm sm:text-base font-medium text-[#242b33] flex items-center gap-1">
          {title}
          {required && <span className="text-[#e05338]">*</span>}
        </label>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#6e8298]">{subtitle}</p>
        )}
      </div>
      {children}
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

  // Sentinel Demographic fields
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

    if (!sex) return toast.error("Please select a sex option");
    if (!pregnancy && sex === "female") return toast.error("Please select pregnancy status");
    if (!insurance) return toast.error("Please select health insurance status");
    if (!distance) return toast.error("Please select approximate travel distance");
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
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Eyebrow & Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Patient Details
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Demographics</span> & baseline information
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Bayanan maralafiya da aka tattara don bin diddigin kula da lafiya.
            </p>
          </div>

          {/* Mode Card */}
          {privacyMode === "anonymous" ? (
            sessionCode && (
              <div className="bg-[#f0f7ff] border border-[#cce3fd] rounded-[16px] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
                    <Hash className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold tracking-wider text-[#6e8298] uppercase">
                      STUDY CODE (ANONYMOUS)
                    </p>
                    <p className="text-base sm:text-lg font-bold text-[#001f3e] tracking-tight">
                      {sessionCode}
                    </p>
                  </div>
                </div>
                {onGenerateNewCode && (
                  <button
                    type="button"
                    onClick={onGenerateNewCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-white border border-[#cce3fd] text-[#0073f3] text-xs sm:text-sm font-medium hover:bg-[#f3f9ff] transition-colors cursor-pointer shadow-sm"
                  >
                    <RefreshCw className="size-3.5" />
                    Generate new
                  </button>
                )}
              </div>
            )
          ) : (
            /* Identified Patient Selection/Entry */
            <SectionCard
              title="Patient Information"
              subtitle="Link an existing registered patient or enter new details"
              required
            >
              {existingPatients.length > 0 && (
                <div className="inline-flex bg-[#f2f3f5] p-1 rounded-[10px] self-start mb-1">
                  <button
                    type="button"
                    onClick={() => setPatientChoice("new")}
                    className={cn(
                      "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-[8px] transition-all cursor-pointer",
                      patientChoice === "new"
                        ? "bg-white text-[#242b33] shadow-sm"
                        : "text-[#6e8298] hover:text-[#242b33]"
                    )}
                  >
                    New Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setPatientChoice("existing")}
                    className={cn(
                      "px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-[8px] transition-all cursor-pointer",
                      patientChoice === "existing"
                        ? "bg-white text-[#242b33] shadow-sm"
                        : "text-[#6e8298] hover:text-[#242b33]"
                    )}
                  >
                    Existing Patient
                  </button>
                </div>
              )}

              {patientChoice === "existing" && existingPatients.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                    Select Patient
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => handleSelectExisting(e.target.value)}
                    className="w-full bg-[#fafafa] rounded-[12px] border border-[#e4e8ec] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all cursor-pointer"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="patient-fullname-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Amina Ibrahim"
                      className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      id="patient-phone-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full bg-white rounded-[12px] border border-[#e4e8ec] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all"
                    />
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* Age */}
          <SectionCard
            title="Age"
            subtitle="Years completed (Shekaru)"
          >
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
          </SectionCard>

          {/* Sex */}
          <SectionCard title="Sex" subtitle="Jinsi" required>
            <TileGrid
              cols={3}
              value={sex}
              onChange={(s) => {
                setSex(s);
                if (s === "male" && !pregnancy) {
                  setPregnancy("not_pregnant");
                }
              }}
              options={[
                { value: "female", label: "Female", sub: "Mace" },
                { value: "male", label: "Male", sub: "Namiji" },
                { value: "other_not_stated", label: "Other / Not stated", sub: "Sauran" },
              ]}
            />
          </SectionCard>

          {/* Pregnancy Status (if applicable) */}
          <SectionCard
            title="Pregnancy status"
            subtitle="Ciki / care planning only"
          >
            <TileGrid
              cols={1}
              value={(pregnancy ?? "") as string}
              onChange={(v) => setPregnancy(v as DemographicsData["pregnancyStatus"])}
              options={[
                { value: "not_pregnant", label: "Not pregnant / not applicable", sub: "Ba ciki / ba ya shafi wannan ba" },
                { value: "pregnant", label: "Pregnant", sub: "Tana da ciki" },
                { value: "not_sure", label: "Not sure / prefer not to say", sub: "Ba a sani ba / ba a bayyana ba" },
              ]}
            />
          </SectionCard>

          {/* Health Insurance */}
          <SectionCard
            title="Health insurance"
            subtitle="Inshorar lafiya"
            required
          >
            <TileGrid
              cols={2}
              value={insurance}
              onChange={setInsurance}
              options={[
                { value: "no_insurance", label: "No insurance", sub: "Babu inshora" },
                { value: "nhia_or_other", label: "NHIA / Other cover", sub: "Yana da inshora" },
              ]}
            />
          </SectionCard>

          {/* Distance */}
          <SectionCard
            title="Distance from outlet"
            subtitle="Nisan tafiya daga wannan kanti / wurin"
            required
          >
            <TileGrid
              cols={3}
              value={distance}
              onChange={setDistance}
              options={[
                { value: "under_2km", label: "Under 2 km", sub: "Kasa da 2km" },
                { value: "2_5km", label: "2–5 km", sub: "Tsakanin 2–5km" },
                { value: "over_5km", label: "Over 5 km", sub: "Sama da 5km" },
              ]}
            />
          </SectionCard>

          {/* Education */}
          <SectionCard
            title="Education level"
            subtitle="Matakin karatu"
            required
          >
            <TileGrid
              cols={3}
              value={education}
              onChange={setEducation}
              options={[
                { value: "none_primary", label: "None / Primary", sub: "Babu / Firamare" },
                { value: "secondary", label: "Secondary", sub: "Sakandare" },
                { value: "tertiary", label: "Tertiary", sub: "Gaba da sakandare" },
              ]}
            />
          </SectionCard>

          {/* Occupation */}
          <SectionCard
            title="Occupation"
            subtitle="Sana'a"
            required
          >
            <TileGrid
              cols={2}
              value={occupation}
              onChange={setOccupation}
              options={[
                { value: "trader", label: "Trader", sub: "Dan kasuwa / Mai sayarwa" },
                { value: "farmer", label: "Farmer", sub: "Manomi" },
                { value: "student", label: "Student", sub: "Dalibi" },
                { value: "other", label: "Other", sub: "Sauran sana'o'i" },
              ]}
            />
          </SectionCard>

          {/* Visit Type */}
          <SectionCard
            title="Visit type"
            subtitle="Nau'in ziyara"
            required
          >
            <TileGrid
              cols={2}
              value={visitType}
              onChange={setVisitType}
              options={[
                { value: "first_visit", label: "First visit", sub: "Ziyara ta farko" },
                { value: "follow_up", label: "Follow-up", sub: "Ziyarar bin diddigi" },
              ]}
            />
          </SectionCard>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Demographics
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
            id="demographics-continue-btn"
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Continue to symptoms
          </button>
        </div>
      </div>
    </div>
  );
}
