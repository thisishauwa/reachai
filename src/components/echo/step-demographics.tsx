"use client";

import { useState } from "react";
import { Smile, Check, ChevronDown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AGE_BANDS, OCCUPATION_TYPES } from "@/lib/reference/demographics";
import { usePatients } from "@/lib/queries/patients";
import { useSession } from "@/lib/session/session-context";
import type { PrivacyMode } from "@/lib/supabase/database.types";

interface StepDemographicsProps {
  privacyMode: PrivacyMode;
  onContinue: (data: {
    fullName?: string;
    phone?: string;
    ageBand: string;
    sex?: string;
    pregnancyStatus?: string | null;
    occupationType: string;
    existingPatientId?: string;
  }) => void;
}

export function StepDemographics({
  privacyMode,
  onContinue,
}: StepDemographicsProps) {
  const { activeFacility } = useSession();
  const { data: existingPatients = [] } = usePatients(activeFacility?.facilityId);

  const [locale, setLocale] = useState<"en" | "ha">("en");
  const [isSelectingExisting, setIsSelectingExisting] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");

  // Identified fields
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  // Shared fields
  const [ageBand, setAgeBand] = useState("");
  const [occupationType, setOccupationType] = useState("");

  // Anonymous fields
  const [sex, setSex] = useState<string>("");
  const [pregnancyStatus, setPregnancyStatus] = useState<string>("");
  const [policyConsent, setPolicyConsent] = useState(false);

  const handleSelectExisting = (patientId: string) => {
    const p = existingPatients.find((pt) => pt.id === patientId);
    if (!p) return;
    setSelectedExistingId(p.id);
    setFullName(p.full_name);
    setPhone(p.phone_e164 ? p.phone_e164.replace("+234", "") : "");
    setAgeBand(p.age_band);
    setOccupationType(p.occupation_type);
    setSex(p.sex);
    setPregnancyStatus(p.pregnancy_status ?? "");
  };

  const handleContinue = () => {
    if (privacyMode === "identified") {
      if (!fullName.trim()) {
        toast.error("Please enter the patient's full name");
        return;
      }
      if (!ageBand) {
        toast.error("Please select an age band");
        return;
      }
      if (!occupationType) {
        toast.error("Please select an occupation type");
        return;
      }
      onContinue({
        fullName: fullName.trim(),
        phone: phone.trim() ? `+234${phone.trim()}` : undefined,
        ageBand,
        occupationType,
        existingPatientId: selectedExistingId || undefined,
      });
    } else {
      // Anonymous
      if (!ageBand) {
        toast.error("Please select an age band");
        return;
      }
      if (!sex) {
        toast.error("Please select a sex option");
        return;
      }
      if (!occupationType) {
        toast.error("Please select an occupation type");
        return;
      }
      if (!policyConsent) {
        toast.error("Please consent to the privacy policy before continuing");
        return;
      }
      onContinue({
        ageBand,
        sex,
        pregnancyStatus: sex === "female" ? pregnancyStatus || null : null,
        occupationType,
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Section Eyebrow and Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Patient demographics
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Collect essential</span> demographic
              information for this encounter.
            </h2>
          </div>

          {/* Mode Banner */}
          {privacyMode === "identified" ? (
            <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
              <div className="size-12 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
                <Smile className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-[#242b33] text-base sm:text-lg">
                  Identified referral data
                </h3>
                <p className="text-sm sm:text-base text-[#6e8298]">
                  Personal identifiers will be collected to coordinate care with the
                  referral clinic.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#f2f3f5] rounded-[20px] p-5 flex items-start gap-4">
              <div className="size-12 rounded-[12px] bg-[#e4e8ec] text-[#6e8298] flex items-center justify-center shrink-0">
                <Smile className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-[#242b33] text-base sm:text-lg">
                  Anonymous syndromic data only
                </h3>
                <p className="text-sm sm:text-base text-[#6e8298]">
                  No personal data or identifiers will be collected in this screening
                </p>
              </div>
            </div>
          )}

          {/* Language Toggle */}
          <div className="inline-flex bg-[#f2f3f5] p-1 rounded-[8px] self-start">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium",
                locale === "en"
                  ? "bg-white text-[#242b33]"
                  : "text-[#a1aebc] hover:text-[#495766]"
              )}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale("ha")}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium",
                locale === "ha"
                  ? "bg-white text-[#242b33]"
                  : "text-[#a1aebc] hover:text-[#495766]"
              )}
            >
              Hausa
            </button>
          </div>

          {/* Form Fields */}
          {privacyMode === "identified" ? (
            <div className="flex flex-col gap-5">
              {/* Existing Patient Quick Pick Toggle (if patients exist) */}
              {existingPatients.length > 0 && (
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setIsSelectingExisting(!isSelectingExisting)}
                    className="text-xs text-[#0073f3] hover:underline flex items-center gap-1 font-medium"
                  >
                    <UserCheck className="size-3.5" />
                    {isSelectingExisting
                      ? "Or enter new patient manually"
                      : "Choose from existing facility patients"}
                  </button>
                </div>
              )}

              {isSelectingExisting && existingPatients.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#242b33]">
                    Select existing patient
                  </label>
                  <div className="relative">
                    <select
                      value={selectedExistingId}
                      onChange={(e) => handleSelectExisting(e.target.value)}
                      className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10"
                    >
                      <option value="">Select a registered patient...</option>
                      {existingPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} ({p.patient_code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#242b33]">
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all"
                />
              </div>

              {/* Phone Number (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#242b33]">
                  Phone number <span className="text-[#6e8298] font-normal">(Optional)</span>
                </label>
                <div className="flex bg-white rounded-[12px] overflow-hidden focus-within:ring-2 focus-within:ring-[#0073f3]">
                  <div className="flex items-center px-4 text-sm sm:text-base text-[#242b33] font-medium bg-gray-50/50">
                    +234
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0800 000 0000"
                    className="w-full bg-transparent px-3 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none"
                  />
                </div>
              </div>

              {/* Age Band */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#242b33]">
                  Age band
                </label>
                <div className="relative">
                  <select
                    value={ageBand}
                    onChange={(e) => setAgeBand(e.target.value)}
                    className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10"
                  >
                    <option value="">Select an age band</option>
                    {AGE_BANDS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                </div>
              </div>

              {/* Occupation Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#242b33]">
                  Occupation type
                </label>
                <div className="relative">
                  <select
                    value={occupationType}
                    onChange={(e) => setOccupationType(e.target.value)}
                    className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10"
                  >
                    <option value="">Select an option</option>
                    {OCCUPATION_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            /* Anonymous mode fields (0:1855 & 0:1905) */
            <div className="flex flex-col gap-5">
              {/* Age Band */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="age-band-select" className="text-sm font-medium text-[#242b33]">
                  Age band
                </label>
                <div className="relative">
                  <select
                    id="age-band-select"
                    value={ageBand}
                    onChange={(e) => setAgeBand(e.target.value)}
                    className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10 cursor-pointer"
                  >
                    <option value="">Select an age band</option>
                    {AGE_BANDS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                </div>
              </div>

              {/* Sex */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="sex-select" className="text-sm font-medium text-[#242b33]">
                  Sex
                </label>
                <div className="relative">
                  <select
                    id="sex-select"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10 cursor-pointer"
                  >
                    <option value="">Select an option</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                </div>
              </div>

              {/* Pregnancy Status (0:1905 - conditionally rendered when sex === 'female') */}
              {sex === "female" && (
                <div className="flex flex-col gap-1.5 transition-all">
                  <label htmlFor="pregnancy-status-select" className="text-sm font-medium text-[#242b33]">
                    Pregnancy status
                  </label>
                  <div className="relative">
                    <select
                      id="pregnancy-status-select"
                      value={pregnancyStatus}
                      onChange={(e) => setPregnancyStatus(e.target.value)}
                      className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10 cursor-pointer"
                    >
                      <option value="">Select an option</option>
                      <option value="not_pregnant">Not pregnant</option>
                      <option value="pregnant">Pregnant</option>
                      <option value="postpartum">Postpartum</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Occupation Type */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="occupation-select" className="text-sm font-medium text-[#242b33]">
                  Occupation type
                </label>
                <div className="relative">
                  <select
                    id="occupation-select"
                    value={occupationType}
                    onChange={(e) => setOccupationType(e.target.value)}
                    className="w-full appearance-none bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] outline-none focus:ring-2 focus:ring-[#0073f3] transition-all pr-10 cursor-pointer"
                  >
                    <option value="">Select an option</option>
                    {OCCUPATION_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 text-[#6e8298] pointer-events-none" />
                </div>
              </div>

              {/* Policy Consent Checkbox */}
              <button
                type="button"
                id="policy-consent-btn"
                onClick={() => setPolicyConsent(!policyConsent)}
                className="flex items-center gap-3 text-left pt-2 cursor-pointer"
              >
                <div
                  className={cn(
                    "size-5 rounded-[4px] flex items-center justify-center transition-colors shrink-0",
                    policyConsent
                      ? "bg-[#0073f3] text-white"
                      : "border border-[#c7d2de] bg-white"
                  )}
                >
                  {policyConsent && <Check className="size-3.5 stroke-[3]" />}
                </div>
                <span className="text-xs sm:text-sm text-[#6e8298]">
                  I consent to the processing of my personal data in accordance with
                  EHA Clinics{" "}
                  <span className="text-[#0073f3] underline">Privacy Policy</span>.
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar - fixed to bottom on mobile */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Pre-Screening
          </span>
        </div>
        <button
          type="button"
          id="continue-demographics-btn"
          onClick={handleContinue}
          className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
        >
          {privacyMode === "identified" ? "Continue" : "Continue to screening"}
        </button>
      </div>
    </div>
  );
}
