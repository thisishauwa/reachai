"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { generatePatientCode } from "@/lib/reference/codes";
import { ChevronDown, Calendar } from "lucide-react";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT - Abuja", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara"
];

const GENDERS = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "intersex", label: "Intersex" },
  { id: "unknown", label: "Other / Prefer not to say" },
];



export default function NewPatientPage() {
  const router = useRouter();
  const { activeFacility, userId } = useSession();

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  // Address State
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [town, setTown] = useState("");
  const [lga, setLga] = useState("");
  const [stateName, setStateName] = useState("");

  // Consent Checkboxes
  const [consentPractitioner, setConsentPractitioner] = useState(false);
  const [consentDataProcess, setConsentDataProcess] = useState(false);
  const [consentBiometrics, setConsentBiometrics] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const formattedDob = useMemo(() => {
    if (!dob) return "";
    try {
      const parsed = new Date(dob);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, "MMMM d, yyyy");
      }
    } catch {
      // fallback
    }
    return dob;
  }, [dob]);

  const fullAddress = useMemo(() => {
    const parts = [street.trim(), (town || city).trim(), lga.trim(), stateName ? `${stateName} State` : ""].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "";
  }, [street, city, town, lga, stateName]);

  const facilityName = activeFacility?.facilityName || "Greenwood General Hospital";

  const allConsented = consentPractitioner && consentDataProcess && consentBiometrics;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter first and last name");
      return;
    }

    if (!gender) {
      toast.error("Please select a gender");
      return;
    }

    if (!allConsented) {
      toast.error("Please acknowledge all consent items to proceed");
      return;
    }

    setSubmitting(true);
    const id = crypto.randomUUID();
    const patientCode = generatePatientCode();

    const formattedPhone = phone.trim() ? `+234${phone.replace(/^\+?234|^0/, "").trim()}` : null;

    // Estimate age band based on DOB if provided
    let ageBand = "18_49_years";
    if (dob) {
      try {
        const birthDate = new Date(dob);
        const ageInYears = (Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (ageInYears < 0.08) ageBand = "0_28_days";
        else if (ageInYears < 1) ageBand = "1_11_months";
        else if (ageInYears < 5) ageBand = "1_4_years";
        else if (ageInYears < 15) ageBand = "5_14_years";
        else if (ageInYears < 18) ageBand = "15_17_years";
        else if (ageInYears < 50) ageBand = "18_49_years";
        else ageBand = "50_plus_years";
      } catch {
        ageBand = "18_49_years";
      }
    }

    try {
      const patientPayload = {
        id,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        patient_code: patientCode,
        full_name: fullName,
        phone_e164: formattedPhone,
        age_band: ageBand,
        sex: gender as "female" | "male" | "intersex" | "unknown",
        pregnancy_status: gender === "female" ? "not_pregnant" : null,
        occupation_type: "other",
        created_by: userId,
      };

      // 1. Direct upsert to Supabase
      const supabase = createClient();
      const { error: patientErr } = await supabase
        .from("patients")
        .upsert(patientPayload, { onConflict: "id" });
      if (patientErr) {
        console.warn("Direct patient upsert warning (will queue in outbox):", patientErr);
      }

      // 2. Queue in outbox so sync status & offline storage are updated
      const { synced } = await syncController.enqueueAndSync(
        "patient",
        id,
        "insert",
        patientPayload
      );

      toast.success(synced ? "Patient created successfully" : "Patient saved offline — will sync when connected");
      router.push(`/patients/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create patient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-32 pt-2 sm:pt-4">
      {/* Mobile Top Navigation Bar: Back to Patients + Screen Title + Consistent Menu */}
      <MobileSubpageHeader title="New Patient" backHref="/patients" backLabel="Patients" />

      {/* Desktop Page Title */}
      <div className="hidden sm:block">
        <h1 className="text-[22px] sm:text-[28px] font-normal text-[#001f3e] tracking-[-0.3px]">
          Create new patient
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-10">
        {/* Section 1: Profile */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 md:gap-12 items-start">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-medium text-[#495766]">Profile</h2>
            <p className="text-[14px] text-[#a1aebc] leading-relaxed">
              Preliminary information about the patient
            </p>
          </div>

          <div className="flex flex-col gap-5 max-w-xl">
            {/* First name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">First name</label>
              <input
                type="text"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* Last name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Last name</label>
              <input
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* Date of birth */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Date of birth</label>
              <div className="relative">
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] outline-none focus:border-[#0073f3] transition-colors"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[#6e8298] pointer-events-none" />
              </div>
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Gender</label>
              <div className="relative">
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full appearance-none bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] outline-none focus:border-[#0073f3] transition-colors cursor-pointer"
                >
                  <option value="" disabled>Select gender</option>
                  {GENDERS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[#6e8298] pointer-events-none" />
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Phone number</label>
              <div className="flex items-center bg-white border border-[#e4e8ec] rounded-[12px] overflow-hidden focus-within:border-[#0073f3] transition-colors">
                <span className="px-4 py-3 bg-[#fafafa] border-r border-[#e4e8ec] text-[#6e8298] text-[16px] font-normal select-none">
                  +234
                </span>
                <input
                  type="tel"
                  placeholder="0800 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-[#f2f3f5]" />

        {/* Section 2: Address */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 md:gap-12 items-start">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-medium text-[#495766]">Address</h2>
            <p className="text-[14px] text-[#a1aebc] leading-relaxed">
              Information about where the patient lives
            </p>
          </div>

          <div className="flex flex-col gap-5 max-w-xl">
            {/* Street */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Street</label>
              <input
                type="text"
                placeholder="Mubi-Gombi Road"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* City */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">City</label>
              <input
                type="text"
                placeholder="Ila Orangun"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* Town */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">Town</label>
              <input
                type="text"
                placeholder="Ila Orangun"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* LGA */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">LGA</label>
              <input
                type="text"
                placeholder="Yamaltu-Deba"
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                className="w-full bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] placeholder:text-[#6e8298] outline-none focus:border-[#0073f3] transition-colors"
              />
            </div>

            {/* State */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[14px] font-medium text-[#242b33]">State</label>
              <div className="relative">
                <select
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full appearance-none bg-white border border-[#e4e8ec] rounded-[12px] px-4 py-3 text-[16px] text-[#242b33] outline-none focus:border-[#0073f3] transition-colors cursor-pointer"
                >
                  <option value="" disabled>Select a state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-[#6e8298] pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-[#f2f3f5]" />

        {/* Section 3: Patient Consent */}
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 md:gap-12 items-start">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-medium text-[#495766]">Patient consent</h2>
          </div>

          <div className="flex flex-col gap-6 max-w-xl">
            {/* Dynamic Consent Box */}
            <div className="bg-white border border-[#e4e8ec] rounded-[12px] p-5 text-[14px] leading-relaxed text-[#495766] max-h-48 overflow-y-auto select-none">
              <p>
                I,{" "}
                <span className="text-[#0073f3] font-medium">
                  {fullName || "[Patient's full name]"}
                </span>
                , born{" "}
                <span className="text-[#0073f3] font-medium">
                  {formattedDob || "[Date of birth]"}
                </span>
                , of{" "}
                <span className="text-[#0073f3] font-medium">
                  {fullAddress || "[Patient's location]"}
                </span>
                , hereby consent to receive medical care and services at{" "}
                <span className="text-[#0073f3] font-medium">{facilityName}</span>. I
                understand that my personal information, including my name, date of birth,
                gender, address, phone number, and other contact details, will be securely
                stored and used by the hospital for medical, administrative, and legal purposes in
                accordance with applicable data protection laws.
              </p>
              <p className="mt-3">
                I understand that all information shared with the medical team will be kept confidential
                and will only be disclosed in accordance with medical ethics and relevant legal guidelines.
              </p>
            </div>

            {/* Consent Checkboxes */}
            <div className="flex flex-col gap-3.5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentPractitioner}
                  onChange={(e) => setConsentPractitioner(e.target.checked)}
                  className="mt-1 size-4 rounded border-[#e4e8ec] text-[#0073f3] focus:ring-[#0073f3] cursor-pointer"
                />
                <span className="text-[14px] text-[#242b33] leading-snug">
                  The medical practitioner has thoroughly explained the scope and nature of the clinical assessment.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentDataProcess}
                  onChange={(e) => setConsentDataProcess(e.target.checked)}
                  className="mt-1 size-4 rounded border-[#e4e8ec] text-[#0073f3] focus:ring-[#0073f3] cursor-pointer"
                />
                <span className="text-[14px] text-[#242b33] leading-snug">
                  I consent to the collection, processing, and storage of my personal and medical data.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentBiometrics}
                  onChange={(e) => setConsentBiometrics(e.target.checked)}
                  className="mt-1 size-4 rounded border-[#e4e8ec] text-[#0073f3] focus:ring-[#0073f3] cursor-pointer"
                />
                <span className="text-[14px] text-[#242b33] leading-snug">
                  I consent to the capture of biometric or clinical imagery if required during examination.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#e4e8ec] px-4 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 text-[15px] font-medium text-[#495766] hover:bg-[#f4f5f7] rounded-[12px] transition-colors cursor-pointer"
            >
              Exit
            </button>

            <button
              type="submit"
              disabled={submitting || !allConsented}
              className="px-6 py-3 text-[15px] font-medium text-white bg-[#0073f3] hover:bg-[#0062d1] disabled:opacity-50 disabled:cursor-not-allowed rounded-[12px] transition-colors cursor-pointer shadow-none"
            >
              {submitting ? "Creating..." : "Create patient"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
