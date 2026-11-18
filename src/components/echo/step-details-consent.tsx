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
  consentedBy: "adult_patient" | "accompanying_adult" | "person_reporting" | "unaccompanied_minor";
}

interface StepDetailsConsentProps {
  presence: PatientPresence;
  ageBand: string;
  isMinor: boolean;
  caregiverReported: boolean;
  continueLabel?: string;
  onContinue: (data: DetailsConsentResult) => void;
  onPrevious?: () => void;
}

const WHO_OPTIONS: { value: PatientRelationship; label: string; ha: string }[] = [
  { value: "myself", label: "Myself", ha: "Ni kaina" },
  { value: "my_child", label: "My child", ha: "Yaro na" },
  { value: "someone_else", label: "Someone else", ha: "Wani mutum" },
];

const SEX_OPTIONS: { value: DemographicsData["sex"]; label: string; ha: string }[] = [
  { value: "male", label: "Male", ha: "Namiji" },
  { value: "female", label: "Female", ha: "Mace" },
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
    <div className={cn("grid grid-cols-1 gap-2", options.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
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

export function StepDetailsConsent({ presence, ageBand, isMinor, caregiverReported, continueLabel = "Continue to complaint", onContinue, onPrevious }: StepDetailsConsentProps) {
  const [relationship, setRelationship] = useState<PatientRelationship | "">("");
  const [sex, setSex] = useState<DemographicsData["sex"] | "">("");
  const [pregnancy, setPregnancy] = useState<PregnancyChoice | "">("");
  const [verbalAttested, setVerbalAttested] = useState(false);
  const locale = "en" as const;
  const showPregnancy = sex === "female" && ageBand === "18_to_49";

  const consentedBy = useMemo<DetailsConsentResult["consentedBy"]>(() => {
    if (presence === "at_home") return "person_reporting";
    if (isMinor && relationship === "myself") return "unaccompanied_minor";
    if (isMinor || relationship === "my_child") return "accompanying_adult";
    return "adult_patient";
  }, [isMinor, presence, relationship]);

  const consentName = {
    adult_patient: "Consent given by the patient, who is an adult and present.",
    accompanying_adult: "Consent given by the accompanying adult for the minor.",
    person_reporting: "Consent given by the person reporting.",
    unaccompanied_minor: "The minor is unaccompanied. Screening and referral proceed; this record is flagged.",
  }[consentedBy];
  const consentNameHa = {
    adult_patient: "Majiyyacin da yake babba kuma yana nan ya bayar da izini.",
    accompanying_adult: "Babban da ya raka yaron ya bayar da izini.",
    person_reporting: "Mutumin da yake bayar da rahoton ya bayar da izini.",
    unaccompanied_minor: "Yaron bai zo da babba ba. Za a ci gaba da tantancewa da turawa; za a yi wa bayanan alama.",
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
      pregnancyStatus: showPregnancy ? (pregnancy as PregnancyChoice) : null,
      // These legacy persistence columns are outside the v0.3 Step 4 screen.
      insuranceStatus: "no_insurance",
      educationLevel: "none_primary",
      occupationType: "other",
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-28">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />
        <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-10 flex flex-col gap-6">
          <div>
            <p className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">Step 4 of 6 · Details + consent</p>
            <h2 className="text-xl sm:text-2xl font-semibold text-[#001f3e] mt-1">Tell us who the screening is for</h2>
            <p className="text-sm text-[#6e8298] mt-1">No name or phone number is collected</p>
            <p className="text-xs text-[#8a99a8] mt-0.5">Ba a karbar suna ko lambar waya</p>
          </div>

          {caregiverReported && (
            <div className="rounded-[16px] border border-[#cddff3] bg-[#f0f7ff] p-4 flex gap-3" role="note">
              <Flag className="size-5 text-[#0073f3] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0051a8]">Caregiver-reported</p>
                <p className="text-sm text-[#315f8b] mt-0.5">The patient is absent. This record will be flagged as reported by another person.</p>
                <p className="text-xs text-[#315f8b] mt-1">Majiyyacin ba ya nan. Za a yi wa bayanan alamar cewa wani ne ya bayar da rahoton.</p>
              </div>
            </div>
          )}

          {presence === "with_me" && isMinor && relationship === "myself" && (
            <div className="rounded-[16px] border border-[#cfd8e1] bg-[#f5f7f9] p-4 flex gap-3" role="note">
              <Flag className="size-5 text-[#596b7c] shrink-0 mt-0.5" />
              <div><p className="font-semibold text-[#354554]">Unaccompanied minor — record flagged</p><p className="text-sm text-[#596b7c] mt-0.5">Screening, advice and referral proceed as normal.</p><p className="text-xs text-[#596b7c] mt-1">Yaron bai zo da babba ba; za a ci gaba da tantancewa, shawara da turawa.</p></div>
            </div>
          )}

          <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
            <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Who is it for? <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">Na wa ne?</p></div>
            <ChoiceGrid options={WHO_OPTIONS} value={relationship} onChange={setRelationship} />
          </section>

          <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
            <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Sex <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">Jinsi</p></div>
            <ChoiceGrid options={SEX_OPTIONS} value={sex} onChange={(value) => { setSex(value); if (value !== "female") setPregnancy(""); }} />
          </section>

          {showPregnancy && (
            <section className="rounded-[16px] border border-[#e4e8ec] bg-white p-4 sm:p-6 flex flex-col gap-3">
              <div><h3 className="text-sm sm:text-base font-semibold text-[#242b33]">Pregnant? <span className="text-[#d44424]">*</span></h3><p className="text-xs text-[#6e8298]">Tana da ciki?</p></div>
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
                <p className="text-sm sm:text-base text-[#242b33] leading-relaxed mt-1">“I will ask a few quick safety questions and keep a record. Your name is not saved.”</p>
                <p className="text-xs text-[#6e8298] mt-1">“Zan yi wasu gajerun tambayoyin tsaro kuma in ajiye bayanai. Ba za a ajiye sunanka ba.”</p>
              </div>
            </div>
            <button type="button" onClick={() => setVerbalAttested((current) => !current)} className={cn("min-h-11 rounded-[14px] border p-4 text-left flex items-start gap-3", verbalAttested ? "border-[#0073f3] bg-[#f0f7ff]" : "border-[#dfe5eb] bg-white") }>
              <span className={cn("size-5 rounded-[5px] border flex items-center justify-center shrink-0 mt-0.5", verbalAttested ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]") }>{verbalAttested && <Check className="size-3 stroke-[3]" />}</span>
              <span><span className="block text-sm sm:text-base font-medium text-[#242b33]">{consentName}</span><span className="block text-xs text-[#6e8298] mt-0.5">{consentNameHa}</span></span>
            </button>
          </section>
        </div>
      </div>

      <div className="encounter-action-bar">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button type="button" onClick={handleContinue} disabled={!canContinue} className="min-h-11 rounded-[12px] bg-[#0073f3] px-6 sm:px-8 text-sm sm:text-base font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">{continueLabel}</button>
      </div>
    </div>
  );
}
