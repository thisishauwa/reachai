"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Copy, MessageSquareText, Printer, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session/session-context";
import { useDestinationFacilities } from "@/lib/queries/referrals";
import { syncController } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { careGuidanceFor } from "@/lib/reference/referral-guidance";
import { referralLookupUrl } from "@/lib/reference/codes";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { ReferralGeneratedSheet } from "@/components/echo/referral-generated-sheet";
import type { PrivacyMode, TriageSeverity } from "@/lib/supabase/database.types";

type ReferralOutcome = "referred" | "refused" | "not_referred";

interface StepReferralProps {
  encounterId: string;
  privacyMode?: PrivacyMode;
  consentId?: string | null;
  referralCode: string;
  severity: TriageSeverity;
  conditionCode: string;
  conditionLabel: string;
  guidanceText: string;
  ipcGuidance?: string | null;
  onComplete: () => void;
}

const OUTCOMES: { value: ReferralOutcome; label: string; ha: string }[] = [
  { value: "referred", label: "Yes, referred", ha: "I, an tura" },
  { value: "refused", label: "Yes, but the patient refused", ha: "I, amma majiyyacin ya ki" },
  { value: "not_referred", label: "No", ha: "A'a" },
];

const FALLBACK_DESTINATION = {
  id: "00000000-0000-0000-0000-000000000011",
  name: "EHA Clinic, Nassarawa",
  code: "Jaen Road",
  phone_e164: null,
  address_text: "Jaen Road",
  distance_label: "1.8 km",
  opening_status: "Open now",
};

export function StepReferral({ encounterId, privacyMode = "anonymous", consentId = null, referralCode, severity, conditionCode, conditionLabel, guidanceText, ipcGuidance, onComplete }: StepReferralProps) {
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const { data: destinationFacilities = [] } = useDestinationFacilities(activeFacility.facilityId);
  const guidance = careGuidanceFor(conditionCode, severity);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [isOther, setIsOther] = useState(false);
  const [otherFacilityName, setOtherFacilityName] = useState("");
  const [outcome, setOutcome] = useState<ReferralOutcome | null>(null);
  const [reason, setReason] = useState("");
  const [showCard, setShowCard] = useState(false);
  const [saving, setSaving] = useState(false);

  const facilityOptions = useMemo(
    () => destinationFacilities.length > 0 ? destinationFacilities : [FALLBACK_DESTINATION],
    [destinationFacilities],
  );
  const resolvedSelectedFacilityId = selectedFacilityId || facilityOptions[0].id;
  const selectedFacility = useMemo(() => facilityOptions.find((facility) => facility.id === resolvedSelectedFacilityId), [facilityOptions, resolvedSelectedFacilityId]);
  const destinationName = isOther ? otherFacilityName.trim() || "Other facility" : selectedFacility?.name || FALLBACK_DESTINATION.name;
  const destinationAddress = selectedFacility
    ? `${selectedFacility.address_text || selectedFacility.code || FALLBACK_DESTINATION.address_text} · ${selectedFacility.distance_label || "Distance unavailable"} · ${selectedFacility.opening_status || "Hours unavailable"}`
    : `${FALLBACK_DESTINATION.address_text} · ${FALLBACK_DESTINATION.distance_label} · ${FALLBACK_DESTINATION.opening_status}`;
  const showsDestination = outcome === "referred" || outcome === "refused";
  const canSave = Boolean(outcome) && (!showsDestination || (isOther ? otherFacilityName.trim() : resolvedSelectedFacilityId));

  const copySmsLink = async () => {
    const message = `Referral ${referralCode}: ${destinationName}. Go today and show this code at reception. ${referralLookupUrl(referralCode)}`;
    await navigator.clipboard?.writeText(message);
    toast.success("SMS text and secure link copied");
  };

  const saveOutcome = async () => {
    if (!canSave || !outcome) return;
    setSaving(true);
    let referralId = crypto.randomUUID();
    const destinationFacilityId = resolvedSelectedFacilityId;
    const status = outcome === "referred" ? "created" : "cancelled";
    const payload = {
      id: referralId,
      encounter_id: encounterId,
      organization_id: activeFacility.organizationId,
      source_facility_id: activeFacility.facilityId,
      destination_facility_id: destinationFacilityId,
      privacy_mode: privacyMode,
      consent_id: privacyMode === "identified" ? consentId : null,
      referral_code: referralCode,
      status,
      created_by: userId,
      destination_facility_name_free_text: isOther ? otherFacilityName.trim() : null,
      referral_outcome: outcome,
      referral_outcome_reason: reason.trim() || null,
      secure_lookup_url: referralLookupUrl(referralCode),
    };
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_referral_v03" as never, {
        p_encounter_id: encounterId,
        p_destination_facility_id: destinationFacilityId,
        p_privacy_mode: privacyMode,
        p_consent_id: privacyMode === "identified" ? consentId : null,
        p_referral_code: referralCode,
        p_idempotency_key: createIdempotencyKey(),
      } as never);
      if (error) throw error;
      referralId = (data as { id?: string } | null)?.id || referralId;
      payload.id = referralId;
      await supabase.from("referrals").update({
        referral_outcome: outcome,
        referral_outcome_reason: reason.trim() || null,
        destination_facility_name_free_text: isOther ? otherFacilityName.trim() : null,
        secure_lookup_url: referralLookupUrl(referralCode),
        ...(outcome === "referred" ? {} : { status: "cancelled", cancellation_reason: reason.trim() || outcome }),
      } as never).eq("id", referralId);
    } catch (error) {
      console.warn("Referral outcome online save note:", error);
    }
    try {
      await syncController.enqueue("referral", referralId, "insert", payload);
      const outcomeAnswerId = crypto.randomUUID();
      await syncController.enqueue("encounter_answer", outcomeAnswerId, "insert", {
        id: outcomeAnswerId, encounter_id: encounterId, question_id: "REFERRAL_OUTCOME", value: { outcome, reason: reason.trim() || null, recommended_destination: facilityOptions[0].name, actual_destination: showsDestination ? destinationName : null }, answered_by: userId, client_updated_at: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
      toast.success("Referral outcome saved");
      onComplete();
    } catch (error) {
      console.warn("Referral outcome queue note:", error);
      toast.error("Could not save the outcome. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-28">
      <section className={cn("rounded-[20px] border p-5 sm:p-7", severity === "emergency" ? "border-[#f2c8bd] bg-[#fff5f2]" : "border-[#f0d7b1] bg-[#fffaf1]") }>
        <p className="text-xs font-bold uppercase tracking-wider opacity-70">Step 6a · Referral</p>
        <h2 className="text-xl sm:text-2xl font-semibold mt-1">{guidance.severityLabel}</h2>
        <p className="text-sm mt-2 opacity-80">{guidance.severityReason}</p>
      </section>

      <section className="rounded-[20px] border border-[#d9e8f7] bg-[#f6faff] p-5 sm:p-7 flex items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#5d7892]">Referral code</p><p className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.16em] text-[#001f3e] mt-2">{referralCode}</p><p className="text-xs text-[#6e8298] mt-2">Read this aloud to the clinic and copy it onto the card.</p></div>
        <button type="button" aria-label="Copy referral code" onClick={() => void navigator.clipboard?.writeText(referralCode)} className="size-11 rounded-[12px] bg-white border border-[#d9e8f7] text-[#0073f3] flex items-center justify-center"><Copy className="size-5" /></button>
      </section>

      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">What this looks like</p><h3 className="text-lg sm:text-xl font-semibold text-[#242b33] mt-2">{conditionLabel}</h3><p className="text-sm text-[#5f7081] mt-2">{guidanceText}</p>
        <p className="mt-3 rounded-[12px] bg-[#fff8f6] border border-[#ffd5c8] px-4 py-3 text-sm text-[#a03823] flex gap-2"><ShieldAlert className="size-4 shrink-0 mt-0.5" /><span><strong>This is not a diagnosis.</strong> A qualified health worker must confirm it.</span></p>
      </section>

      <section className="rounded-[20px] border border-[#d9e8f7] bg-[#f6faff] p-5 sm:p-7 grid sm:grid-cols-2 gap-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#356b9e]">Before transport - give</p><ul className="mt-3 space-y-2 text-sm text-[#365b7d]">{guidance.give.map((item) => <li key={item} className="flex gap-2"><Check className="size-4 mt-0.5 shrink-0" /><span>{item}</span></li>)}</ul></div>
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#a24431]">Do not give</p><ul className="mt-3 space-y-2 text-sm text-[#7d4337]">{guidance.doNotGive.map((item) => <li key={item} className="flex gap-2"><span>•</span><span>{item}</span></li>)}</ul></div>
      </section>

      <section className="rounded-[20px] border border-[#ead8b9] bg-[#fffbf3] p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-wider text-[#8a5b00]">Protect yourself and others</p><ul className="mt-3 space-y-2 text-sm text-[#694e1d]">{(ipcGuidance ? [ipcGuidance] : guidance.ipc).map((item) => <li key={item} className="flex gap-2"><ShieldAlert className="size-4 mt-0.5 shrink-0" /><span>{item}</span></li>)}</ul>{guidance.surveillanceNotice && <p className="mt-3 font-semibold text-sm text-[#a03823]">{guidance.surveillanceNotice}</p>}</section>

      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Recommended clinic</p><div className="flex items-start gap-3 mt-3"><Building2 className="size-5 text-[#0073f3] shrink-0" /><div><h3 className="font-semibold text-[#242b33]">{facilityOptions[0].name}</h3><p className="text-sm text-[#6e8298] mt-1">{destinationAddress}</p><p className="text-sm font-medium text-[#287a39] mt-1">Nearest clinic able to treat this. The clinic notification is sent when you save the referral.</p></div></div>
      </section>

      <section className="rounded-[20px] bg-[#001f3e] p-5 sm:p-7 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-[#9ccaff]">Say to the patient</p><p className="text-base sm:text-lg leading-relaxed mt-3">“{guidance.patientScript}”</p></section>

      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setShowCard(true)} className="min-h-11 rounded-[12px] border border-[#c7d2de] bg-white text-[#244b70] font-medium flex items-center justify-center gap-2"><Printer className="size-4" />Print card</button><button type="button" onClick={() => void copySmsLink()} className="min-h-11 rounded-[12px] border border-[#c7d2de] bg-white text-[#244b70] font-medium flex items-center justify-center gap-2"><MessageSquareText className="size-4" />Send SMS link</button></div>

      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7 flex flex-col gap-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Referral outcome</p><h3 className="text-lg font-semibold text-[#242b33] mt-1">Did you refer this patient?</h3></div>
        <div className="grid gap-2">{OUTCOMES.map((item) => <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => { setOutcome(item.value); setReason(""); }} className={cn("min-h-12 rounded-[12px] border px-4 py-3 text-left flex items-center justify-between gap-3", outcome === item.value ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8] ring-1 ring-[#0073f3]" : "border-[#d8e0e7] bg-white text-[#242b33]")}><span><span className="font-medium">{item.label}</span><span className="block text-xs opacity-70">{item.ha}</span></span>{outcome === item.value && <Check className="size-5" />}</button>)}</div>

        {showsDestination && <div className="flex flex-col gap-3"><div><p className="text-sm font-semibold text-[#242b33]">Referred to</p><p className="text-xs text-[#6e8298]">The recommended clinic is selected. Change it only if the patient was sent elsewhere.</p></div><div className="grid sm:grid-cols-2 gap-2">{facilityOptions.map((facility) => <button key={facility.id} type="button" onClick={() => { setSelectedFacilityId(facility.id); setIsOther(false); }} className={cn("min-h-11 rounded-[12px] border px-3 py-2 text-left text-sm", resolvedSelectedFacilityId === facility.id && !isOther ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8]" : "border-[#d8e0e7]")}>{facility.name}</button>)}<button type="button" onClick={() => { setIsOther(true); setSelectedFacilityId(""); }} className={cn("min-h-11 rounded-[12px] border px-3 py-2 text-left text-sm", isOther ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8]" : "border-[#d8e0e7]")}>Other facility</button></div>{isOther && <input value={otherFacilityName} onChange={(event) => setOtherFacilityName(event.target.value)} placeholder="Facility name" className="min-h-11 rounded-[12px] border border-[#d8e0e7] px-4 outline-none focus:border-[#0073f3]" />}</div>}

        {(outcome === "refused" || outcome === "not_referred") && <div><label htmlFor="referral-reason" className="text-sm font-semibold text-[#242b33]">Reason - optional</label><textarea id="referral-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder={outcome === "refused" ? "For example: no transport money or children at home" : "Why was the recommendation not followed?"} className="mt-2 w-full rounded-[12px] border border-[#d8e0e7] px-4 py-3 outline-none focus:border-[#0073f3]" /><p className="text-xs text-[#6e8298] mt-1">You can leave this blank. It helps us understand why referrals do not happen.</p></div>}
      </section>

      <div className="encounter-action-bar"><button type="button" disabled={!canSave || saving} onClick={() => void saveOutcome()} className="w-full min-h-12 rounded-[12px] bg-[#0073f3] px-6 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save and finish"}</button></div>

      {showCard && <ReferralGeneratedSheet referralCode={referralCode} destinationName={destinationName} destinationAddress={destinationAddress.split(" · ")[0]} createdAt={new Date().toISOString()} onClose={() => setShowCard(false)} onComplete={() => { window.print(); }} />}
    </div>
  );
}
