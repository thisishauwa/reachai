"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Check, Clock3, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useReferral, useTransitionReferral } from "@/lib/queries/referrals";
import { useSession } from "@/lib/session/session-context";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";
import { careGuidanceFor } from "@/lib/reference/referral-guidance";

const CONFIRMATIONS = [
  "Confirmed IDSR priority disease",
  "Confirmed other IDSR disease",
  "Non-IDSR condition",
  "Indeterminate",
] as const;

function readableAnswer(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ").replaceAll("_", " ");
  if (value && typeof value === "object" && "answer" in value) return readableAnswer((value as { answer: unknown }).answer);
  return String(value ?? "Not recorded").replaceAll("_", " ");
}

export default function ReferralDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const router = useRouter();
  const { activeFacility } = useSession();
  const { data: referral, isLoading } = useReferral(id);
  const transition = useTransitionReferral();
  const [confirmation, setConfirmation] = useState<string>("");
  const [clinicalNote, setClinicalNote] = useState("");
  const [resultSaved, setResultSaved] = useState(false);

  const encounter = referral?.encounters;
  const triage = encounter?.triage_outcomes?.[0];
  const demographics = encounter?.encounter_demographics?.[0];
  const guidance = careGuidanceFor(triage?.condition_code || "UNCLASSIFIED", (triage?.severity as "emergency" | "urgent" | "routine") || "urgent");
  const isDestination = referral?.destination_facility_id === activeFacility.facilityId;
  const elapsed = referral ? formatDistanceToNow(new Date(referral.created_at)) : "";
  const answerRows = useMemo(() => (encounter?.encounter_answers ?? []).filter((answer) => answer.question_id !== "REFERRAL_OUTCOME"), [encounter?.encounter_answers]);

  if (isLoading || !referral) return <div className="p-6 space-y-4"><Skeleton className="h-12 w-48 rounded-full" /><Skeleton className="h-44 w-full rounded-[24px]" /><Skeleton className="h-80 w-full rounded-[24px]" /></div>;

  const saveClinicalResult = async (sendBackToOutlet: boolean) => {
    if (!confirmation) { toast.error("Choose a diagnosis confirmation before saving"); return; }
    if (!isDestination) { toast.error("Only the receiving clinic can close this referral"); return; }
    try {
      if (!resultSaved && referral.status !== "closed") {
        if (referral.status === "created") await transition.mutateAsync({ referralId: referral.id, toStatus: "arrived" });
        await transition.mutateAsync({ referralId: referral.id, toStatus: "closed", reason: `${confirmation}${clinicalNote.trim() ? `: ${clinicalNote.trim()}` : ""}` });
        setResultSaved(true);
      }
      toast.success(sendBackToOutlet ? "Clinical result sent back to the outlet" : "Clinical result saved to the backend");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the clinical result");
    }
  };

  return (
    <div className="flex flex-col gap-5 pt-4 pb-12 sm:pt-6">
      <MobileSubpageHeader title="Incoming referral" backHref="/referrals" backLabel="Referrals" rightElement={<span className="rounded-full bg-[#ffe7e1] px-3 py-1 font-mono text-xs font-bold text-[#b5351c]">{referral.referral_code}</span>} />
      <div className="hidden sm:flex items-center gap-4"><button type="button" onClick={() => router.back()} className="size-12 rounded-full bg-[#f2f3f5]">←</button><div><h1 className="text-2xl font-semibold text-[#242b33]">{activeFacility.facilityName} · incoming referral</h1><p className="text-sm text-[#6e8298]">Full clinical handover unlocked by the signed referral code.</p></div></div>

      <section className="rounded-[24px] bg-[#001f3e] p-5 sm:p-7 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-3xl font-bold tracking-[0.15em]">{referral.referral_code}</p><div className="flex flex-wrap items-center gap-2 mt-3"><span className="rounded-full bg-[#d44424] px-3 py-1 text-xs font-semibold">{triage?.severity === "emergency" ? "Acute" : triage?.severity === "routine" ? "Routine" : "Urgent"}</span><span className="inline-flex items-center gap-1 text-sm text-[#c4d9ec]"><Clock3 className="size-4" />{elapsed} since issue</span></div></div><p className="text-sm text-[#c4d9ec]">Issued {new Date(referral.created_at).toLocaleString("en-GB")}</p></div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-[22px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Referral details</p>
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-sm"><dt className="text-[#6e8298]">Referred by</dt><dd className="font-medium text-[#242b33]">{referral.source_facility_id}</dd><dt className="text-[#6e8298]">Cadre</dt><dd className="font-medium text-[#242b33]">CP / PPMV outlet</dd><dt className="text-[#6e8298]">Patient</dt><dd className="font-medium text-[#242b33]">{demographics ? `${demographics.sex || "Sex not stated"}, ${(demographics.age_band || "age unknown").replaceAll("_", " ")}${demographics.pregnancy_status === "pregnant" ? ", pregnant" : ""}` : "Anonymous patient"}</dd><dt className="text-[#6e8298]">Reason</dt><dd className="font-medium text-[#242b33]">{guidance.severityReason}</dd><dt className="text-[#6e8298]">Given at outlet</dt><dd className="font-medium text-[#242b33]">{guidance.give.join(" ")}</dd></dl>
        </section>

        <section className="rounded-[22px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Symptoms recorded at the outlet</p>
          {answerRows.length ? <ul className="mt-4 divide-y divide-[#edf0f2]">{answerRows.map((answer) => <li key={`${answer.question_id}-${readableAnswer(answer.value)}`} className="py-2.5 text-sm flex justify-between gap-4"><span className="text-[#5f7081]">{answer.question_id.replaceAll("_", " ")}</span><span className="font-medium text-[#242b33] text-right capitalize">{readableAnswer(answer.value)}</span></li>)}</ul> : <p className="mt-4 text-sm text-[#6e8298]">No answer rows were returned. Use the referral reason and contact the outlet if clarification is needed.</p>}
        </section>
      </div>

      <section className="rounded-[22px] border border-[#ffd5c8] bg-[#fff8f6] p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#a24431]">Signs consistent with</p><h2 className="text-xl font-semibold text-[#5b1c10] mt-2">{triage?.condition_label_en || "Signs that need a clinic check"}</h2><p className="mt-3 flex gap-2 text-sm text-[#a03823]"><ShieldAlert className="size-4 mt-0.5 shrink-0" /><span>Generated by symptom rules at the outlet. <strong>This is not a diagnosis</strong> and was not shown on the patient card.</span></p></section>

      <section className="rounded-[22px] border border-[#e4e8ec] bg-white p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Confirm the diagnosis</p><div className="grid sm:grid-cols-2 gap-2 mt-4">{CONFIRMATIONS.map((item) => <button key={item} type="button" aria-pressed={confirmation === item} onClick={() => setConfirmation(item)} className={cn("min-h-12 rounded-[12px] border px-4 py-3 text-left flex items-center justify-between gap-3", confirmation === item ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8] ring-1 ring-[#0073f3]" : "border-[#d8e0e7]")}><span className="font-medium">{item}</span>{confirmation === item && <Check className="size-5" />}</button>)}</div><textarea value={clinicalNote} onChange={(event) => setClinicalNote(event.target.value)} rows={3} placeholder="Optional clinical note" className="mt-4 w-full rounded-[12px] border border-[#d8e0e7] px-4 py-3 outline-none focus:border-[#0073f3]" /></section>

      <div className="grid sm:grid-cols-2 gap-3"><button type="button" disabled={!confirmation || transition.isPending || !isDestination} onClick={() => void saveClinicalResult(false)} className="min-h-12 rounded-[12px] bg-[#0073f3] px-5 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"><Send className="size-4" />Save and send to backend</button><button type="button" disabled={!confirmation || transition.isPending || !isDestination} onClick={() => void saveClinicalResult(true)} className="min-h-12 rounded-[12px] border border-[#0073f3] bg-white px-5 text-[#0073f3] font-medium disabled:opacity-50">Send result back to outlet</button></div>
    </div>
  );
}
