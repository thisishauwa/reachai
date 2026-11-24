"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Copy, MessageSquareText, Printer } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session/session-context";
import { useDestinationFacilities } from "@/lib/queries/referrals";
import { syncController } from "@/lib/offline/sync";
import { createClient } from "@/lib/supabase/client";
import { careGuidanceFor } from "@/lib/reference/referral-guidance";
import { referralLookupUrl } from "@/lib/reference/codes";
import {
  REFERRAL_FACILITIES,
  referralFacilityCapabilities,
  type ReferralFacility,
} from "@/lib/reference/referral-facilities";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { referralStatusForOutcome } from "@/lib/logic/written-journey-flow";
import { ReferralGeneratedSheet } from "@/components/echo/referral-generated-sheet";
import type { PrivacyMode, TriageSeverity } from "@/lib/supabase/database.types";

export type ReferralOutcome = "referred" | "refused" | "not_referred";

export interface ReferralCompletion {
  outcome: ReferralOutcome;
  reason: string | null;
  destinationName: string | null;
}

interface StepReferralProps {
  encounterId: string;
  privacyMode?: PrivacyMode;
  consentId?: string | null;
  referralCode: string;
  severity: TriageSeverity;
  conditionCode: string;
  caregiverReported?: boolean;
  requiresMaternityCapability?: boolean;
  onComplete: (completion: ReferralCompletion) => void;
}

const OUTCOMES: { value: ReferralOutcome; label: string; ha: string }[] = [
  { value: "referred", label: "Yes, referred", ha: "I, an tura" },
  { value: "refused", label: "Yes, but the patient refused", ha: "I, amma majiyyacin ya ki" },
  { value: "not_referred", label: "No", ha: "A'a" },
];

export function StepReferral({ encounterId, privacyMode = "anonymous", consentId = null, referralCode, severity, conditionCode, caregiverReported = false, requiresMaternityCapability = false, onComplete }: StepReferralProps) {
  const queryClient = useQueryClient();
  const { activeFacility, userId } = useSession();
  const { data: destinationFacilities = [] } = useDestinationFacilities(activeFacility.facilityId);
  const guidance = careGuidanceFor(conditionCode, severity);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [outcome, setOutcome] = useState<ReferralOutcome | null>(null);
  const [reason, setReason] = useState("");
  const [showCard, setShowCard] = useState(false);
  const [saving, setSaving] = useState(false);

  const facilityOptions = useMemo<ReferralFacility[]>(
    () => REFERRAL_FACILITIES.map((configuredFacility) => {
      const databaseFacility = destinationFacilities.find(
        (facility) => facility.code === configuredFacility.code || facility.id === configuredFacility.id,
      );
      const facility = databaseFacility
        ? { ...configuredFacility, ...databaseFacility }
        : configuredFacility;

      return {
        ...facility,
        phone_e164: facility.phone_e164 ?? null,
        address_text: facility.address_text ?? null,
        distance_label: facility.distance_label ?? null,
        opening_status: facility.opening_status ?? null,
        capabilities: referralFacilityCapabilities(facility.code),
      };
    }),
    [destinationFacilities],
  );
  const recommendedFacility = useMemo(
    () => requiresMaternityCapability
      ? facilityOptions.find((facility) => facility.capabilities.includes("maternity")) ?? facilityOptions[0]
      : facilityOptions[0],
    [facilityOptions, requiresMaternityCapability],
  );
  const resolvedSelectedFacilityId = selectedFacilityId || recommendedFacility.id;
  const selectedFacility = useMemo(() => facilityOptions.find((facility) => facility.id === resolvedSelectedFacilityId), [facilityOptions, resolvedSelectedFacilityId]);
  const destinationName = selectedFacility?.name || REFERRAL_FACILITIES[0].name;
  const facilityDetails = (facility?: ReferralFacility) => facility
    ? `${facility.address_text || "Address not provided"} · ${facility.distance_label || "Distance unavailable"} · ${facility.opening_status || "Hours unavailable"}`
    : "Address not provided · Distance unavailable · Hours unavailable";
  const destinationAddress = facilityDetails(selectedFacility);
  const recommendedAddress = facilityDetails(recommendedFacility);
  const showsDestination = outcome === "referred" || outcome === "refused";
  const selectedFacilityMeetsMaternityRequirement = !requiresMaternityCapability || Boolean(selectedFacility?.capabilities.includes("maternity"));
  const canSave = Boolean(outcome) && (!showsDestination || (resolvedSelectedFacilityId && selectedFacilityMeetsMaternityRequirement));
  const caregiverScript = caregiverReported
    ? severity === "emergency"
      ? `The patient is not here. Bring them to ${destinationName} now and show this referral code. Do not delay for medicine at home.`
      : severity === "routine"
        ? `The patient is not here. Bring them to ${destinationName} within the week for the recommended test and show this referral code.`
        : `The patient is not here. Bring them to ${destinationName} today and show this referral code.`
    : guidance.patientScript;

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
    const status = referralStatusForOutcome(outcome);
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
      destination_facility_name_free_text: null,
      referral_outcome: outcome,
      referral_outcome_reason: reason.trim() || null,
      secure_lookup_url: referralLookupUrl(referralCode),
    };
    try {
      const supabase = createClient();
      const outcomeArgs = {
        p_encounter_id: encounterId,
        p_destination_facility_id: destinationFacilityId,
        p_privacy_mode: privacyMode,
        p_consent_id: privacyMode === "identified" ? consentId : null,
        p_referral_code: referralCode,
        p_referral_outcome: outcome,
        p_referral_outcome_reason: reason.trim() || null,
        p_destination_facility_name_free_text: null,
        p_idempotency_key: createIdempotencyKey(),
      };
      let { data, error } = await supabase.rpc("save_referral_outcome_v03" as never, outcomeArgs as never);

      // Keep older deployments usable for actual/refused referrals while the
      // migration rolls out. Never use the old notification-creating RPC for
      // Journey 12's "No" decision.
      if (error && outcome !== "not_referred") {
        const fallback = await supabase.rpc("create_referral_v03" as never, {
          p_encounter_id: encounterId,
          p_destination_facility_id: destinationFacilityId,
          p_privacy_mode: privacyMode,
          p_consent_id: privacyMode === "identified" ? consentId : null,
          p_referral_code: referralCode,
          p_idempotency_key: createIdempotencyKey(),
        } as never);
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      referralId = (data as { id?: string } | null)?.id || referralId;
      payload.id = referralId;
      if (outcome !== "not_referred") {
        await supabase.from("referrals").update({
          referral_outcome: outcome,
          referral_outcome_reason: reason.trim() || null,
          destination_facility_name_free_text: null,
          secure_lookup_url: referralLookupUrl(referralCode),
          status: "created",
        } as never).eq("id", referralId);
      }
    } catch (error) {
      console.warn("Referral outcome online save note:", error);
    }
    try {
      await syncController.enqueue("referral", referralId, "insert", payload);
      const outcomeAnswerId = crypto.randomUUID();
      await syncController.enqueue("encounter_answer", outcomeAnswerId, "insert", {
        id: outcomeAnswerId, encounter_id: encounterId, question_id: "REFERRAL_OUTCOME", value: { outcome, reason: reason.trim() || null, recommended_destination: recommendedFacility.name, actual_destination: showsDestination ? destinationName : null, matched_category_codes: conditionCode.split("+").filter(Boolean) }, answered_by: userId, client_updated_at: new Date().toISOString(),
      });
      await queryClient.invalidateQueries({ queryKey: ["referrals"] });
      toast.success("Referral outcome saved");
      onComplete({
        outcome,
        reason: reason.trim() || null,
        destinationName: showsDestination ? destinationName : null,
      });
    } catch (error) {
      console.warn("Referral outcome queue note:", error);
      toast.error("Could not save the outcome. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-28">
      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-wider text-[#5d7892]">Step 6a · Referral</p>
        <h2 className="text-xl sm:text-2xl font-semibold text-[#001f3e] mt-1">Complete the referral</h2>
        <p className="text-sm text-[#6e8298] mt-2">Give the patient the code and clinic details, then record what happened.</p>
        <p className="text-xs text-[#8a99a8] mt-1">[Hausa translation pending]</p>
      </section>

      <section className="rounded-[20px] border border-[#d9e8f7] bg-[#f6faff] p-5 sm:p-7 flex items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#5d7892]">Referral code</p><p className="font-mono text-3xl sm:text-4xl font-bold tracking-[0.16em] text-[#001f3e] mt-2">{referralCode}</p><p className="text-xs text-[#6e8298] mt-2">Read this aloud to the clinic and copy it onto the card.</p></div>
        <button type="button" aria-label="Copy referral code" onClick={() => void navigator.clipboard?.writeText(referralCode)} className="size-11 rounded-[12px] bg-white border border-[#d9e8f7] text-[#0073f3] flex items-center justify-center"><Copy className="size-5" /></button>
      </section>

      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Recommended clinic</p><div className="flex items-start gap-3 mt-3"><Building2 className="size-5 text-[#0073f3] shrink-0" /><div><h3 className="font-semibold text-[#242b33]">{recommendedFacility.name}</h3><p className="text-sm text-[#6e8298] mt-1">{recommendedAddress}</p>{requiresMaternityCapability && <p className="mt-2 inline-flex rounded-full bg-[#eaf7ed] px-3 py-1 text-xs font-semibold text-[#287a39]">Maternity-capable facility</p>}<p className="text-sm font-medium text-[#287a39] mt-1">Nearest clinic able to treat this. The clinic notification is sent when you save the referral.</p></div></div>
      </section>

      <section className="rounded-[20px] bg-[#001f3e] p-5 sm:p-7 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-[#9ccaff]">{caregiverReported ? "Say to the person reporting" : "Say to the patient"}</p><p className="text-base sm:text-lg leading-relaxed mt-3">“{caregiverScript}”</p></section>

      <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setShowCard(true)} className="min-h-11 rounded-[12px] border border-[#c7d2de] bg-white text-[#244b70] font-medium flex items-center justify-center gap-2"><Printer className="size-4" />Print card</button><button type="button" onClick={() => void copySmsLink()} className="min-h-11 rounded-[12px] border border-[#c7d2de] bg-white text-[#244b70] font-medium flex items-center justify-center gap-2"><MessageSquareText className="size-4" />Send SMS link</button></div>

      <section className="rounded-[20px] border border-[#e4e8ec] bg-white p-5 sm:p-7 flex flex-col gap-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Referral outcome</p><h3 className="text-lg font-semibold text-[#242b33] mt-1">Did you refer this patient?</h3></div>
        <div className="grid gap-2">{OUTCOMES.map((item) => <button key={item.value} type="button" aria-pressed={outcome === item.value} onClick={() => { setOutcome(item.value); setReason(""); }} className={cn("min-h-12 rounded-[12px] border px-4 py-3 text-left flex items-center justify-between gap-3", outcome === item.value ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8] ring-1 ring-[#0073f3]" : "border-[#d8e0e7] bg-white text-[#242b33]")}><span><span className="font-medium">{item.label}</span><span className="block text-xs opacity-70">{item.ha}</span></span>{outcome === item.value && <Check className="size-5" />}</button>)}</div>

        {showsDestination && <div className="flex flex-col gap-3"><div><p className="text-sm font-semibold text-[#242b33]">Referred to</p><p className="text-xs text-[#6e8298]">The recommended clinic is selected. Choose another listed clinic only if needed.</p></div><div className="grid sm:grid-cols-2 gap-2">{facilityOptions.map((facility) => <button key={facility.id} type="button" disabled={requiresMaternityCapability && !facility.capabilities.includes("maternity")} onClick={() => setSelectedFacilityId(facility.id)} className={cn("min-h-11 rounded-[12px] border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45", resolvedSelectedFacilityId === facility.id ? "border-[#0073f3] bg-[#f0f7ff] text-[#0051a8]" : "border-[#d8e0e7]")}>{facility.name}{requiresMaternityCapability && facility.capabilities.includes("maternity") && <span className="mt-1 block text-xs text-[#287a39]">Maternity capable</span>}</button>)}</div></div>}

        {(outcome === "refused" || outcome === "not_referred") && <div><label htmlFor="referral-reason" className="text-sm font-semibold text-[#242b33]">Reason — optional</label><textarea id="referral-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} aria-describedby="referral-reason-help" placeholder={outcome === "refused" ? "For example: no transport money or children at home" : "Why was the recommendation not followed?"} className="mt-2 w-full rounded-[12px] border border-[#d8e0e7] px-4 py-3 outline-none focus:border-[#0073f3]" /><p id="referral-reason-help" className="text-xs text-[#6e8298] mt-1">You can leave this blank. If provided, it is saved with the recommendation and outcome.</p></div>}
      </section>

      <div className="encounter-action-bar"><button type="button" disabled={!canSave || saving} onClick={() => void saveOutcome()} className="w-full min-h-12 rounded-[12px] bg-[#0073f3] px-6 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">{saving ? "Saving..." : "Save and finish"}</button></div>

      {showCard && <ReferralGeneratedSheet referralCode={referralCode} destinationName={destinationName} destinationAddress={destinationAddress.split(" · ")[0]} createdAt={new Date().toISOString()} onClose={() => setShowCard(false)} onComplete={() => { window.print(); }} />}
    </div>
  );
}
