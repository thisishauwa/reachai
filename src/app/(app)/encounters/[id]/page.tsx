"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
  Trash2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useEncounter } from "@/lib/queries/encounters";
import { createClient } from "@/lib/supabase/client";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";

export default function EncounterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : "";

  const { data: encounter, isLoading, error } = useEncounter(id);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    try {
      setIsDeleting(true);
      const supabase = createClient();
      
      // Try using the secure RPC first
      const { error: rpcErr } = await (supabase.rpc as any)("delete_encounter", {
        p_encounter_id: id,
      });

      if (rpcErr) {
        // Fallback to direct delete if RPC is not present
        const { error: delErr } = await supabase
          .from("encounters")
          .delete()
          .eq("id", id);
        if (delErr) throw delErr;
      }

      await queryClient.invalidateQueries({ queryKey: ["encounters"] });
      toast.success("Encounter deleted successfully");
      router.push("/encounters");
    } catch (err: unknown) {
      console.error("Failed to delete encounter:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete encounter"
      );
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="size-8 animate-spin text-[#0073F3]" />
        <p className="text-sm text-[#6e8298]">Loading encounter details...</p>
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="flex flex-col gap-6 pt-4 pb-20">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/encounters")}
            className="size-10 sm:size-14 rounded-full bg-[#f7f7f7] hover:bg-[#eaeaea] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <ArrowLeft className="size-5 sm:size-6 text-[#495766]" />
          </button>
          <h1 className="text-xl sm:text-2xl font-medium text-[#001f3e]">
            Encounter Details
          </h1>
        </div>

        <div className="bg-[#fafafa] rounded-[24px] p-8 text-center flex flex-col items-center gap-3">
          <AlertTriangle className="size-10 text-amber-500" />
          <p className="text-base font-medium text-[#242b33]">
            Encounter not found
          </p>
          <p className="text-sm text-[#6e8298]">
            This encounter may have been deleted or scrubbed.
          </p>
          <Link
            href="/encounters"
            className="mt-2 bg-[#0073F3] text-white px-5 py-2.5 rounded-[12px] text-sm font-medium hover:bg-[#0062d4] transition-colors"
          >
            Return to encounters
          </Link>
        </div>
      </div>
    );
  }

  const patient = (encounter.patients as unknown) as {
    id: string;
    full_name: string;
    patient_code: string;
    sex?: string;
    date_of_birth?: string;
    phone_number?: string;
    state?: string;
    lga?: string;
  } | null;

  const isAnonymous = encounter.privacy_mode === "anonymous";
  const patientDisplayName = isAnonymous
    ? `Anonymous \u00b7 ${encounter.session_code || encounter.encounter_code}`
    : patient?.full_name || "Patient";

  const dateObj = encounter.started_at ? new Date(encounter.started_at) : new Date();
  const completedDateObj = encounter.completed_at ? new Date(encounter.completed_at) : null;

  const syndromesList = Array.isArray(encounter.encounter_syndromes)
    ? encounter.encounter_syndromes
    : [];

  const triageList = Array.isArray(encounter.triage_outcomes)
    ? encounter.triage_outcomes
    : [];
  const latestTriage = triageList[0] as
    | {
        severity?: string;
        condition_label_en?: string;
        guidance_en?: string;
        ipc_guidance_en?: string;
        referral_required?: boolean;
      }
    | undefined;

  const referralsList = Array.isArray(encounter.referrals)
    ? encounter.referrals
    : [];
  const activeReferral = referralsList[0] as
    | {
        id: string;
        referral_code: string;
        status: string;
      }
    | undefined;

  const answers = Array.isArray(encounter.answers) ? encounter.answers : [];

  return (
    <div className="flex flex-col gap-6 pt-4 pb-20">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold text-[#242b33]">
                Delete Encounter?
              </h3>
              <p className="text-sm text-[#6e8298]">
                Are you sure you want to delete encounter{" "}
                <span className="font-semibold text-[#242b33]">
                  {encounter.encounter_code}
                </span>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-[12px] bg-[#f4f5f7] hover:bg-[#e4e8ec] text-[#495766] font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-[12px] bg-[#d44424] hover:bg-[#b83820] text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="size-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Top Navigation Bar */}
      <MobileSubpageHeader
        title={encounter.encounter_code || "Encounter details"}
        backHref="/encounters"
        backLabel="Encounters"
        rightElement={
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="size-10 rounded-full bg-red-50 hover:bg-red-100 text-[#d44424] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Delete encounter"
          >
            <Trash2 className="size-4" />
          </button>
        }
      />

      {/* Desktop Top Header */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/encounters")}
            className="size-14 rounded-full bg-[#f7f7f7] hover:bg-[#eaeaea] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            aria-label="Back to encounters"
          >
            <ArrowLeft className="size-6 text-[#495766]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-medium text-[#001f3e] tracking-tight truncate">
              {encounter.encounter_code || "Encounter details"}
            </h1>
            <p className="text-sm text-[#6e8298]">
              {format(dateObj, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="size-12 rounded-[12px] bg-red-50 hover:bg-red-100 text-[#d44424] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          title="Delete encounter"
        >
          <Trash2 className="size-5" />
        </button>
      </div>

      {/* Overview Status Card */}
      <div className="bg-[#fafafa] rounded-[24px] p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececec] pb-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#16a34a]" />
            <span className="text-sm font-semibold uppercase tracking-wider text-[#16a34a]">
              {encounter.status === "completed" ? "Completed" : encounter.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#6e8298] uppercase tracking-wider px-2.5 py-1 bg-white rounded-full border border-gray-200">
              {encounter.workflow_mode === "echo"
                ? "ECHO Surveillance"
                : "REACH Rabies"}
            </span>
            <span className="text-xs font-medium text-[#0073F3] uppercase tracking-wider px-2.5 py-1 bg-blue-50 rounded-full">
              {encounter.privacy_mode}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#8e8e8e] flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Started
            </span>
            <span className="text-sm font-medium text-[#242b33]">
              {format(dateObj, "HH:mm")}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#8e8e8e] flex items-center gap-1.5">
              <Clock className="size-3.5" /> Completed
            </span>
            <span className="text-sm font-medium text-[#242b33]">
              {completedDateObj ? format(completedDateObj, "HH:mm") : "Done"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#8e8e8e] flex items-center gap-1.5">
              <Shield className="size-3.5" /> Privacy
            </span>
            <span className="text-sm font-medium text-[#242b33] capitalize">
              {encounter.privacy_mode}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#8e8e8e] flex items-center gap-1.5">
              <Activity className="size-3.5" /> Code
            </span>
            <span className="text-sm font-semibold text-[#0073F3] truncate">
              {encounter.encounter_code}
            </span>
          </div>
        </div>
      </div>

      {/* Patient Information Card */}
      <div className="bg-[#fafafa] rounded-[24px] p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#001f3e]">
            <User className="size-5 text-[#0073F3]" />
            <h2 className="text-base sm:text-lg font-medium">
              Patient Information
            </h2>
          </div>
          {patient?.id && (
            <Link
              href={`/patients/${patient.id}`}
              className="text-xs sm:text-sm font-medium text-[#0073F3] hover:underline flex items-center gap-1"
            >
              View profile <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>

        <div className="bg-white rounded-[16px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-semibold text-[#242b33]">
                {patientDisplayName}
              </p>
              {patient?.patient_code && (
                <p className="text-xs text-[#6e8298] font-mono mt-0.5">
                  ID: {patient.patient_code}
                </p>
              )}
            </div>

            {isAnonymous ? (
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                Anonymous Mode
              </span>
            ) : (
              patient?.sex && (
                <span className="px-3 py-1 bg-[#f2f3f5] text-[#495766] rounded-full text-xs font-medium capitalize">
                  {patient.sex}
                </span>
              )
            )}
          </div>

          {patient?.phone_number && (
            <div className="text-xs sm:text-sm text-[#6e8298] pt-1 border-t border-gray-100 flex items-center justify-between">
              <span>Phone:</span>
              <span className="font-medium text-[#242b33]">
                {patient.phone_number}
              </span>
            </div>
          )}

          {patient?.state && (
            <div className="text-xs sm:text-sm text-[#6e8298] flex items-center justify-between">
              <span>Location:</span>
              <span className="font-medium text-[#242b33]">
                {patient.lga ? `${patient.lga}, ` : ""}
                {patient.state}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Clinical Assessment / Syndrome */}
      <div className="bg-[#fafafa] rounded-[24px] p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-[#001f3e]">
          <Activity className="size-5 text-[#0073F3]" />
          <h2 className="text-base sm:text-lg font-medium">
            Clinical Assessment & Triage
          </h2>
        </div>

        {/* Syndrome Tag */}
        {syndromesList.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs text-[#8e8e8e] font-medium uppercase tracking-wider">
              Suspected Syndrome
            </span>
            <div className="flex flex-wrap gap-2">
              {syndromesList.map((s, idx) => {
                const synData = s.syndromes as { label_en?: string } | null;
                return (
                  <div
                    key={idx}
                    className="bg-white border border-[#0073F3]/20 text-[#0073F3] px-3.5 py-2 rounded-[12px] text-sm font-medium flex items-center gap-2"
                  >
                    <span className="size-2 rounded-full bg-[#0073F3]" />
                    <span>{synData?.label_en || "Assessed Syndrome"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[16px] p-4 text-xs sm:text-sm text-[#6e8298]">
            General Disease Surveillance Evaluation completed.
          </div>
        )}

        {/* Triage Outcome */}
        {latestTriage && (
          <div className="bg-white rounded-[16px] p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8e8e8e] font-medium uppercase tracking-wider">
                Triage Severity
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  latestTriage.severity === "red"
                    ? "bg-red-100 text-red-700"
                    : latestTriage.severity === "amber"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {latestTriage.severity || "Standard"}
              </span>
            </div>

            {latestTriage.guidance_en && (
              <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
                <span className="text-xs font-medium text-[#495766]">
                  Clinical Guidance:
                </span>
                <p className="text-sm text-[#242b33] leading-relaxed">
                  {latestTriage.guidance_en}
                </p>
              </div>
            )}

            {latestTriage.ipc_guidance_en && (
              <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
                <span className="text-xs font-medium text-[#495766]">
                  Infection Prevention & Control:
                </span>
                <p className="text-sm text-[#6e8298] leading-relaxed">
                  {latestTriage.ipc_guidance_en}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Referral Card (if referral was required/created) */}
      {activeReferral && (
        <div className="bg-[#fafafa] rounded-[24px] p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#001f3e]">
              <FileText className="size-5 text-[#0073F3]" />
              <h2 className="text-base sm:text-lg font-medium">
                Referral Generated
              </h2>
            </div>
            <Link
              href={`/referrals/${activeReferral.id}`}
              className="text-xs sm:text-sm font-medium text-[#0073F3] hover:underline flex items-center gap-1"
            >
              Open referral <ExternalLink className="size-3.5" />
            </Link>
          </div>

          <div className="bg-white rounded-[16px] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8e8e8e]">Referral Code</p>
              <p className="text-base font-bold text-[#242b33] tracking-wide mt-0.5">
                {activeReferral.referral_code}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 capitalize">
              {activeReferral.status}
            </span>
          </div>
        </div>
      )}

      {/* Question Responses (if recorded) */}
      {answers.length > 0 && (
        <div className="bg-[#fafafa] rounded-[24px] p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[#001f3e]">
            <CheckCircle2 className="size-5 text-[#16a34a]" />
            <h2 className="text-base sm:text-lg font-medium">
              Surveillance Responses ({answers.length})
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {answers.map((ans, idx) => {
              const q = (ans.questions as unknown) as { prompt_en?: string } | null;
              const answerVal =
                typeof ans.value === "object"
                  ? JSON.stringify(ans.value)
                  : String(ans.value ?? "Yes");

              return (
                <div
                  key={idx}
                  className="bg-white rounded-[14px] p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <span className="text-xs sm:text-sm text-[#495766] font-medium">
                    {q?.prompt_en || `Assessment Item ${idx + 1}`}
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-[#0073F3] self-start sm:self-auto bg-blue-50 px-2.5 py-1 rounded-md">
                    {answerVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
