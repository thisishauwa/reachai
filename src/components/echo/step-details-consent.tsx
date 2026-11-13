"use client";

import { useMemo, useState } from "react";
import { Check, Flag, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatientPresence } from "@/lib/reference/request-options";
import type { DemographicsData } from "@/components/echo/step-demographics";

export type PatientRelationship = "myself" | "my_child" | "someone_else";
type PregnancyChoice = Exclude<DemographicsData["pregnancyStatus"], null>;

export interface DetailsConsentResult extends DemographicsData {
  relationship: PatientRelationship;
  locale: "en" | "ha";
  verbalAttested: true;
  consentedBy: "adult_patient" | "accompanying_adult" | "person_reporting";
}

interface StepDetailsConsentProps {
  presence: PatientPresence;
  ageBand: string;
  isMinor: boolean;
  caregiverReported: boolean;
  onContinue: (data: DetailsConsentResult) => void;
  onPrevious?: () => void;
}

const WHO_OPTIONS: { value: PatientRelationship; label: string }[] = [
  { value: "myself", label: "Myself" },
  { value: "my_child", label: "My child" },
  { value: "someone_else", label: "Someone else" },
];

const SEX_OPTIONS: { value: DemographicsData["sex"]; label: string; ha: string }[] = [
  { value: "female", label: "Female", ha: "Mace" },
  { value: "male", label: "Male", ha: "Namiji" },
  { value: "other_not_stated", label: "Other / not stated", ha: "[Hausa pending]" },
];

function ChoiceGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; ha?: string }[];
  value: T | "";
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-11 rounded-[14px] border px-4 py-3 text-left flex items-center justify-between gap-2",
              selected ? "border-[#0073f3] bg-[#f0f7ff] text-[#005bbf] ring-1 ring-[#0073f3]" : "border-[#dfe5eb] bg-white text-[#242b33]",
            )}
          >
            <span className="flex flex-col text-sm font-medium">
              {option.label}
              {option.ha && <span className="text-[11px] font-normal text-[#6e8298]">{option.ha}</span>}
            </span>
            <span className={cn("size-5 rounded-full border flex items-center justify-center shrink-0", selected ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]") }>
              {selected && <Check className="size-3 stroke-[3]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function StepDetailsConsent({ presence, ageBand, isMinor, caregiverReported, onContinue, onPrevious }: StepDetailsConsentProps) {
  const [relationship, setRelationship] = useState<PatientRelationship | "">("");
  const [sex, setSex] = useState<DemographicsData["sex"] | "">("");
  const [pregnancy, setPregnancy] = useState<PregnancyChoice | "">("");
  const [verbalAttested, setVerbalAttested] = useState(false);
  const locale = "en" as const;
  const showPregnancy = sex === "female" && ageBand === "18_to_49";

  const consentedBy = useMemo<DetailsConsentResult["consentedBy"]>(() => {
    if (presence === "at_home") return "person_reporting";
    if (isMinor || relationship === "my_child") return "accompanying_adult";
    return "adult_patient";
  }, [isMinor, presence, relationship]);

  const consentName = {
    adult_patient: "the adult patient",
    accompanying_adult: "the accompanying adult",
    person_reporting: "the person reporting",
  }[consentedBy];

  const canContinue = Boolean(relationship && sex && verbalAttested && (!showPregnancy || pregnancy));

  const handleContinue = () => {
    if (!canContinue || !relationship || !sex) return;
    onContinue({
      relationship,
      locale,
      verbalAttested: true,
      consentedBy,
      ageBand,
      sex,
      pregnancyStatus: showPregnancy ? (pregnancy as PregnancyChoice) : "not_pregnant",
      // These legacy persistence columns are outside the v0.3 Step 4 screen.
      insuranceStatus: "no_insurance",
      educationLevel: "none_primary",
      occupationType: "other",
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-28 sm:pb-0">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />
        <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-10 flex flex-col gap-6">
          <div>
            <p className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">Step 4 of 6 · Details + consent</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#001f3e] mt-1">Tell us who the screening is for</h2>
            <p className="text-sm text-[#6e8298] mt-1">No name or phone number is collected · [Hausa pending]</p>
          </div>

          {caregiverReported && (
            <div className="rounded-[16px] border border-[#cddff3] bg-[#f0f7ff] p-4 flex gap-3" role="note">
              <Flag className="size-5 text-[#0073f3] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0051a8]">Caregiver-reported</p>
                <p className="text-sm text-[#315f8b] mt-0.5">The patient is absent. This record will be flagged as reported by another person.</p>
                {isMinor && <p className="text-sm font-medium text-[#315f8b] mt-1">The minor is unaccompanied; screening and referral can still proceed.</p>}
                <p className="text-xs text-[#315f8b] mt-1">[Hausa pending]</p>
              </div>
            </div>
          )}

          <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
            <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Who is it for? <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">[Hausa pending]</p></div>
            <ChoiceGrid options={WHO_OPTIONS} value={relationship} onChange={setRelationship} />
          </section>

          <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
            <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Sex <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">Jinsi</p></div>
            <ChoiceGrid options={SEX_OPTIONS} value={sex} onChange={(value) => { setSex(value); if (value !== "female") setPregnancy(""); }} />
          </section>

          {showPregnancy && (
            <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
              <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Pregnant? <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">[Hausa pending]</p></div>
              <ChoiceGrid
                options={[
                  { value: "pregnant", label: "Yes", ha: "I" },
                  { value: "not_pregnant", label: "No", ha: "A'a" },
                  { value: "not_sure", label: "Don't know", ha: "Ban sani ba" },
                ] satisfies { value: PregnancyChoice; label: string; ha: string }[]}
                value={pregnancy}
                onChange={setPregnancy}
              />
            </section>
          )}

          <section className="rounded-[18px] border border-[#cddff3] bg-white p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex gap-3">
              <ShieldCheck className="size-6 text-[#0073f3] shrink-0" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#0073f3]">Read this aloud</p>
                <p className="text-sm sm:text-base text-[#242b33] leading-relaxed mt-1">“I will ask a few questions about the patient’s health. The answers are anonymous and help guide what to do next. This screening does not diagnose an illness. Do you agree to continue?”</p>
                <p className="text-xs text-[#6e8298] mt-1">[Hausa pending]</p>
              </div>
            </div>
            <button type="button" onClick={() => setVerbalAttested((current) => !current)} className={cn("min-h-11 rounded-[14px] border p-4 text-left flex items-start gap-3", verbalAttested ? "border-[#0073f3] bg-[#f0f7ff]" : "border-[#dfe5eb] bg-white") }>
              <span className={cn("size-5 rounded-[5px] border flex items-center justify-center shrink-0 mt-0.5", verbalAttested ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]") }>{verbalAttested && <Check className="size-3 stroke-[3]" />}</span>
              <span><span className="block text-sm sm:text-base font-medium text-[#242b33]">I confirm {consentName} gave verbal consent.</span><span className="block text-xs text-[#6e8298] mt-0.5">[Hausa pending]</span></span>
            </button>
          </section>
        </div>
      </div>

      <div className="w-full flex items-center justify-between gap-3 pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button type="button" onClick={handleContinue} disabled={!canContinue} className="min-h-11 rounded-[12px] bg-[#0073f3] px-6 sm:px-8 text-sm sm:text-base font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">Continue to complaint</button>
      </div>
    </div>
  );
}
