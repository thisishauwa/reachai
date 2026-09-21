"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePatient } from "@/lib/queries/patients";
import { usePatientEncounters } from "@/lib/queries/encounters";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";

type TabKey = "summary" | "encounters" | "prescriptions" | "history";

export default function PatientProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const { data: patient, isLoading: isPatientLoading } = usePatient(id);
  const { data: encounters = [] } = usePatientEncounters(id);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>("summary");
  const [filterStatus, setFilterStatus] = useState("completed");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Format patient name parts
  const { firstName, lastName, middleName } = useMemo(() => {
    if (!patient?.full_name) {
      return { firstName: "Rukayya", lastName: "Jibrin", middleName: "-" };
    }
    const parts = patient.full_name.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: "", middleName: "-" };
    if (parts.length === 2) return { firstName: parts[0], lastName: parts[1], middleName: "-" };
    return { firstName: parts[0], lastName: parts[parts.length - 1], middleName: parts.slice(1, -1).join(" ") };
  }, [patient?.full_name]);

  const createdDateFormatted = useMemo(() => {
    if (!patient?.created_at) return "November 4, 2024";
    try {
      return format(new Date(patient.created_at), "MMMM d, yyyy");
    } catch {
      return "November 4, 2024";
    }
  }, [patient?.created_at]);

  const ageDisplay = useMemo(() => {
    if (!patient?.age_band) return "42 years old";
    return patient.age_band.replace(/_/g, " ").replace("plus", "+");
  }, [patient?.age_band]);

  const genderDisplay = useMemo(() => {
    if (!patient?.sex) return "Female";
    return patient.sex.charAt(0).toUpperCase() + patient.sex.slice(1);
  }, [patient?.sex]);

  async function handleDelete() {
    if (!patient) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      // Archive instead of hard-delete to preserve referential integrity
      const { error } = await supabase
        .from("patients")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", patient.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success(`${patient.full_name} has been removed`);
      router.push("/patients");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete patient");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (isPatientLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-36 w-full rounded-[24px]" />
          <Skeleton className="h-36 w-full rounded-[24px]" />
        </div>
        <Skeleton className="h-64 w-full rounded-[24px]" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
        <p className="text-lg font-medium text-[#242b33]">Patient not found</p>
        <button
          onClick={() => router.push("/patients")}
          className="bg-[#0073f3] text-white px-5 py-2.5 rounded-[12px] text-sm font-medium"
        >
          Back to all patients
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4 pb-20">
      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && patient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-[18px] font-medium text-[#121619]">Remove patient?</h2>
              <p className="text-[14px] text-[#6e8298] leading-relaxed">
                <strong className="text-[#242b33]">{patient.full_name}</strong> will be removed from your patient list. Their encounter records are preserved.
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 text-[14px] font-medium text-[#495766] bg-[#f4f5f7] hover:bg-[#e4e8ec] rounded-[12px] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 text-[14px] font-medium text-white bg-[#d44424] hover:bg-[#b83820] rounded-[12px] transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Removing..." : "Yes, remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Top Navigation Bar: Back + Title + Delete + Menu */}
      <MobileSubpageHeader
        title="Patient profile"
        backHref="/patients"
        backLabel="Patients"
        rightElement={
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="size-10 rounded-full bg-[#fff5f2] hover:bg-[#ffe4de] flex items-center justify-center text-[#d44424] transition-colors cursor-pointer"
            title="Remove patient"
          >
            <Trash2 className="size-4" />
          </button>
        }
      />

      {/* Desktop Header */}
      <div className="hidden sm:flex items-center justify-between relative py-2">
        <button
          type="button"
          onClick={() => router.push("/patients")}
          className="size-10 sm:size-12 rounded-full bg-[#f4f5f7] hover:bg-[#e4e8ec] flex items-center justify-center text-[#242b33] transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-[20px] sm:text-[22px] font-normal text-[#121619] tracking-[-0.2px]">
          Patient profile
        </h1>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="size-10 sm:size-12 rounded-full bg-[#fff5f2] hover:bg-[#ffe4de] flex items-center justify-center text-[#d44424] transition-colors cursor-pointer"
          title="Remove patient"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center border-b border-[#e4e8ec] overflow-x-auto no-scrollbar gap-8">
        {(
          [
            { id: "summary", label: "Summary" },
            { id: "encounters", label: "Encounters" },
            { id: "prescriptions", label: "Prescriptions" },
            { id: "history", label: "History" },
          ] as const
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-[15px] font-normal tracking-tight transition-all relative whitespace-nowrap cursor-pointer ${
                isActive
                  ? "text-[#0073f3] font-medium"
                  : "text-[#6e8298] hover:text-[#121619]"
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0073f3] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SUMMARY (Figma 6458:6104) */}
      {activeTab === "summary" && (
        <div className="flex flex-col gap-8">
          {/* Quick Action Encounter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Manual Encounter */}
            <Link
              href={`/encounters/reach/new?patientId=${patient.id}`}
              className="bg-[#f0f7ff] hover:bg-[#e6f1fe] rounded-[24px] p-6 flex items-center justify-between gap-4 transition-all group cursor-pointer"
            >
              <div className="flex flex-col justify-between h-full py-1">
                <p className="text-[#0057b7] text-[18px] font-medium leading-snug">
                  Start Manual<br />Encounter
                </p>
                <div className="size-10 rounded-full border-2 border-[#0057b7] flex items-center justify-center text-[#0057b7] mt-5 group-hover:scale-110 transition-transform">
                  <Plus className="size-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="w-[120px] h-[90px] shrink-0 flex items-center justify-center">
                <img
                  src="/assets/illustrations/manual-encounter.svg"
                  alt="Manual encounter"
                  className="w-full h-auto object-contain"
                />
              </div>
            </Link>

            {/* Start Guided Workflow */}
            <Link
              href={`/encounters/echo/new?patientId=${patient.id}`}
              className="bg-[#f0f7ff] hover:bg-[#e6f1fe] rounded-[24px] p-6 flex items-center justify-between gap-4 transition-all group cursor-pointer"
            >
              <div className="flex flex-col justify-between h-full py-1">
                <p className="text-[#0057b7] text-[18px] font-medium leading-snug">
                  Start Guided<br />Workflow
                </p>
                <div className="size-10 rounded-full border-2 border-[#0057b7] flex items-center justify-center text-[#0057b7] mt-5 group-hover:scale-110 transition-transform">
                  <Plus className="size-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="w-[120px] h-[90px] shrink-0 flex items-center justify-center">
                <img
                  src="/assets/illustrations/guided-workflow.svg"
                  alt="Guided workflow"
                  className="w-full h-auto object-contain"
                />
              </div>
            </Link>
          </div>

          {/* Section: Patient Information */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-normal text-[#495766]">
                Patient Information
              </h2>
              <button
                type="button"
                onClick={() => router.push(`/patients/new`)}
                className="text-[#0073f3] text-[14px] font-medium hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="bg-[#fafafa] rounded-[24px] p-6 grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
              <InfoCell label="Created on" value={createdDateFormatted} />
              <InfoCell label="Patient ID" value={patient.patient_code || "—"} />
              <InfoCell
                label="Total encounters"
                value={encounters.length > 0 ? `${encounters.length}` : "None"}
              />
              <InfoCell label="Status" value="Active" />
              <InfoCell label="Gender" value={genderDisplay} />
              <InfoCell label="Age" value={ageDisplay} />
            </div>
          </div>

          {/* Section: Personal Details */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-normal text-[#495766]">
                Personal Details
              </h2>
              <button
                type="button"
                onClick={() => router.push(`/patients/new`)}
                className="text-[#0073f3] text-[14px] font-medium hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="bg-[#fafafa] rounded-[24px] p-6 grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
              <InfoCell label="First name" value={firstName} />
              <InfoCell label="Last name" value={lastName} />
              <InfoCell label="Middle name" value={middleName} />
              <InfoCell label="Date of birth" value="Aug 21, 1988" />
              <InfoCell label="Age" value={ageDisplay} />
              <InfoCell label="Gender" value={genderDisplay} />
            </div>
          </div>

          {/* Section: Contact Information */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-normal text-[#495766]">
                Contact Information
              </h2>
              <button
                type="button"
                onClick={() => router.push(`/patients/new`)}
                className="text-[#0073f3] text-[14px] font-medium hover:underline cursor-pointer"
              >
                Edit
              </button>
            </div>

            <div className="bg-[#fafafa] rounded-[24px] p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
              <InfoCell label="Phone" value={patient.phone_e164 || "0808 456 7683"} />
              <InfoCell label="Address" value="15 Lusa Road, Bogoro, Bauchi" />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ENCOUNTERS (Figma 6458:6238 & 6458:6364) */}
      {activeTab === "encounters" && (
        <div className="flex flex-col gap-6">
          {/* Action and Filter bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-[#6e8298]">Showing:</span>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none bg-white border border-[#e4e8ec] rounded-[10px] pl-3 pr-8 py-1.5 text-[14px] text-[#242b33] font-medium outline-none cursor-pointer"
                >
                  <option value="completed">Completed</option>
                  <option value="in_progress">In progress</option>
                  <option value="all">All</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#6e8298] pointer-events-none" />
              </div>
            </div>

            <Link
              href={`/encounters/reach/new?patientId=${patient.id}`}
              className="bg-[#0073f3] hover:bg-[#0062d1] text-white rounded-[12px] px-5 py-2.5 text-[14px] font-medium transition-colors cursor-pointer"
            >
              Create new encounter
            </Link>
          </div>

          {/* Encounter List Groups */}
          <div className="flex flex-col gap-6">
            {/* This month group */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-normal text-[#6e8298]">This month</h3>
              <div className="bg-[#fafafa] rounded-[24px] p-5 flex flex-col gap-4">
                <EncounterRow
                  month="AUG"
                  day="10"
                  title="Rabies Vaccination Encounter"
                  onClick={() => router.push("/encounters")}
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <EncounterRow
                  month="AUG"
                  day="08"
                  title="Malaria Consultation"
                  onClick={() => router.push("/encounters")}
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <EncounterRow
                  month="AUG"
                  day="24"
                  title="Malaria Consultation"
                  onClick={() => router.push("/encounters")}
                />
              </div>
            </div>

            {/* Earlier group */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-normal text-[#6e8298]">Earlier</h3>
              <div className="bg-[#fafafa] rounded-[24px] p-5 flex flex-col gap-4">
                <EncounterRow
                  month="AUG"
                  day="10"
                  title="Rabies Vaccination Encounter"
                  onClick={() => router.push("/encounters")}
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <EncounterRow
                  month="AUG"
                  day="08"
                  title="Malaria Consultation"
                  onClick={() => router.push("/encounters")}
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <EncounterRow
                  month="AUG"
                  day="24"
                  title="Malaria Consultation"
                  onClick={() => router.push("/encounters")}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRESCRIPTIONS (Figma 6458:6489 & 6458:6568) */}
      {activeTab === "prescriptions" && (
        <div className="flex flex-col gap-6">
          {/* Filter Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-[#6e8298]">Showing:</span>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none bg-white border border-[#e4e8ec] rounded-[10px] pl-3 pr-8 py-1.5 text-[14px] text-[#242b33] font-medium outline-none cursor-pointer"
                >
                  <option value="completed">Completed</option>
                  <option value="active">Active</option>
                  <option value="all">All</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-[#6e8298] pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Prescriptions List (Figma 6458:6489) */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-normal text-[#6e8298]">This month</h3>
              <div className="bg-[#fafafa] rounded-[24px] p-5 flex flex-col gap-4">
                <PrescriptionCard
                  name="Paracetamol 500mg"
                  route="Oral"
                  indication="For fever and pain relief"
                  dosage="1-2 tablets every 4-6 hours as needed"
                  duration="For 5 days"
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <PrescriptionCard
                  name="Paracetamol 500mg"
                  route="Oral"
                  indication="For fever and pain relief"
                  dosage="1-2 tablets every 4-6 hours as needed"
                  duration="For 5 days"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-[15px] font-normal text-[#6e8298]">This month</h3>
              <div className="bg-[#fafafa] rounded-[24px] p-5 flex flex-col gap-4">
                <PrescriptionCard
                  name="Paracetamol 500mg"
                  route="Oral"
                  indication="For fever and pain relief"
                  dosage="1-2 tablets every 4-6 hours as needed"
                  duration="For 5 days"
                />
                <div className="w-full h-px bg-[#f2f3f5]" />
                <PrescriptionCard
                  name="Paracetamol 500mg"
                  route="Oral"
                  indication="For fever and pain relief"
                  dosage="1-2 tablets every 4-6 hours as needed"
                  duration="For 5 days"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          <h3 className="text-[15px] font-normal text-[#6e8298]">Patient History &amp; Activity</h3>
          <div className="bg-[#fafafa] rounded-[24px] p-6 flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="size-2.5 rounded-full bg-[#0073f3] mt-2 shrink-0" />
              <div>
                <p className="text-[15px] font-medium text-[#242b33]">Patient Registered</p>
                <p className="text-[13px] text-[#6e8298]">
                  Created on {createdDateFormatted} by Hauwa Suleiman
                </p>
              </div>
            </div>
            <div className="w-full h-px bg-[#f2f3f5]" />
            <div className="flex items-start gap-4">
              <div className="size-2.5 rounded-full bg-neutral-300 mt-2 shrink-0" />
              <div>
                <p className="text-[15px] font-medium text-[#242b33]">Consent Captured</p>
                <p className="text-[13px] text-[#6e8298]">
                  Biometric and medical treatment consent verified on device
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[14px] text-[#6e8298] font-normal">{label}</p>
      <p className="text-[16px] text-[#242b33] font-medium truncate">{value}</p>
    </div>
  );
}

function EncounterRow({
  month,
  day,
  title,
  onClick,
}: {
  month: string;
  day: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
    >
      <div className="size-14 rounded-full bg-white border border-[#f2f3f5] flex flex-col items-center justify-center shrink-0">
        <span className="text-[10px] font-medium text-[#0073f3] tracking-wide leading-tight">
          {month}
        </span>
        <span className="text-[18px] font-medium text-[#121619] leading-tight">
          {day}
        </span>
      </div>
      <p className="text-[16px] font-medium text-[#242b33]">{title}</p>
    </div>
  );
}

function PrescriptionCard({
  name,
  route,
  indication,
  dosage,
  duration,
}: {
  name: string;
  route: string;
  indication: string;
  dosage: string;
  duration: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-medium text-[#242b33]">{name}</p>
        <span className="bg-[#f2f3f5] text-[#495766] text-[12px] font-medium rounded-[6px] px-2 py-0.5">
          {route}
        </span>
      </div>
      <p className="text-[14px] text-[#6e8298]">{indication}</p>
      <div className="flex flex-col gap-0.5 mt-1">
        <p className="text-[14px] text-[#242b33]">
          {dosage.split("every").map((part, i) =>
            i === 0 ? (
              <strong key={i} className="font-medium">
                {part}
              </strong>
            ) : (
              `every ${part}`
            )
          )}
        </p>
        <p className="text-[13px] text-[#6e8298]">{duration}</p>
      </div>
    </div>
  );
}
