"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { useReferral, useTransitionReferral } from "@/lib/queries/referrals";
import { useSession } from "@/lib/session/session-context";
import { canTransitionReferral } from "@/lib/logic/referral-state-machine";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";
import type { ReferralStatus } from "@/lib/supabase/database.types";

export default function ReferralDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const router = useRouter();
  const { activeFacility } = useSession();
  const { data: referral, isLoading } = useReferral(id);
  const transition = useTransitionReferral();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  if (isLoading || !referral) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-48 rounded-full" />
        <Skeleton className="h-28 w-full rounded-[28px]" />
        <Skeleton className="h-72 w-full rounded-[28px]" />
      </div>
    );
  }

  const actor = {
    isSourceMember: referral.source_facility_id === activeFacility?.facilityId,
    isDestinationMember:
      referral.destination_facility_id === activeFacility?.facilityId,
  };

  async function doTransition(toStatus: ReferralStatus, reason?: string) {
    const check = canTransitionReferral(referral!.status, toStatus, actor, reason);
    if (!check.allowed) {
      toast.error(check.reason);
      return;
    }
    try {
      await transition.mutateAsync({
        referralId: referral!.id,
        toStatus,
        reason,
      });
      toast.success(`Referral marked ${toStatus}`);
      setShowCancel(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transition failed");
    }
  }

  const events = [...(referral.referral_events ?? [])].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );

  const createdDate = new Date(referral.created_at);
  const createdTimeStr = format(createdDate, "HH:mm");
  const createdDayStr = format(createdDate, "d MMMM yyyy");

  const arrivedEvent = events.find((e) => e.to_status === "arrived");
  const arrivedDate = arrivedEvent ? new Date(arrivedEvent.occurred_at) : createdDate;
  const isArrived =
    referral.status === "arrived" ||
    referral.status === "closed" ||
    Boolean(arrivedEvent);

  const closedEvent = events.find((e) => e.to_status === "closed");
  const closedDate = closedEvent ? new Date(closedEvent.occurred_at) : createdDate;
  const isClosed = referral.status === "closed" || Boolean(closedEvent);

  const incentive = Array.isArray(referral.incentive_evaluations)
    ? referral.incentive_evaluations[0]
    : null;
  const isEligible = Boolean(incentive?.eligible);
  const closureHours =
    incentive?.closure_seconds != null
      ? Math.round(incentive.closure_seconds / 3600)
      : 12;

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-6">
      {/* Mobile Top Navigation Bar: Back + Title + Code + Menu */}
      <MobileSubpageHeader
        title="Referral Details"
        backHref="/referrals"
        backLabel="Referrals"
        rightElement={
          <div className="bg-[#ffdcd5] px-2.5 py-1 rounded-full shrink-0 border-0 shadow-none">
            <span className="text-[#d44424] font-mono text-xs font-semibold">
              {referral.referral_code}
            </span>
          </div>
        }
      />

      {/* Desktop Top Header */}
      <div className="hidden sm:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            style={{ border: "none", outline: "none", boxShadow: "none" }}
            className="size-[56px] rounded-full bg-[#f7f7f7] hover:bg-[#ececec] flex items-center justify-center transition-colors cursor-pointer shrink-0 border-0 border-none shadow-none"
          >
            <img
              src="/icons/arrow-left.svg"
              alt=""
              className="size-7"
            />
          </button>
          <h1 className="text-xl sm:text-[24px] font-normal text-[#495766] tracking-[-0.3px]">
            Referral Details
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div 
            style={{ border: "none", boxShadow: "none" }}
            className="bg-[#ffdcd5] px-2.5 py-0.5 rounded-full shrink-0 border-0 shadow-none"
          >
            <span className="text-[#d44424] font-mono text-xs sm:text-sm font-medium">
              {referral.referral_code}
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Protected Banner (Figma 9021:12007) - Strictly NO drop shadow, NO border */}
      <div 
        style={{ border: "none", boxShadow: "none", filter: "none" }}
        className="bg-[#fafafa] rounded-[28px] p-5 flex gap-5 items-start w-full border-0 border-none shadow-none"
      >
        <div 
          style={{ border: "none", boxShadow: "none" }}
          className="size-[56px] rounded-[12px] bg-[#f2f3f5] flex items-center justify-center shrink-0 border-0 shadow-none"
        >
          <img
            src="/icons/security-safe.svg"
            alt=""
            className="size-6"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-[#242b33] text-[18px]">
            Privacy protected
          </h2>
          <p className="text-[#6e8298] text-[16px] leading-[24px] mt-0.5">
            Patient identifiers and clinical details are intentionally hidden
            from this view to maintain security compliance.
          </p>
        </div>
      </div>

      {/* Incentive Eligible Banner (Figma 9021:12098) - Strictly NO drop shadow, NO border */}
      {isEligible && (
        <div 
          style={{ border: "none", boxShadow: "none", filter: "none" }}
          className="bg-[#f1fdf3] rounded-[28px] p-5 flex gap-5 items-start w-full border-0 border-none shadow-none animate-in fade-in-50 duration-200"
        >
          <div 
            style={{ border: "none", boxShadow: "none" }}
            className="size-[56px] rounded-[12px] bg-[#d3f6d8] flex items-center justify-center shrink-0 border-0 shadow-none"
          >
            <img
              src="/icons/gift.svg"
              alt=""
              className="size-6"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-[#077d17] text-[18px]">
              Incentive eligible
            </h2>
            <p className="text-[#0bad21] text-[16px] leading-[24px] mt-0.5">
              This referral has met all criteria for incentive.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="size-1.5 rounded-full bg-[#09951c]" />
              <p className="text-sm text-[#6e8298]">
                Time to closure:{" "}
                <span className="font-medium text-[#6e8298]">
                  {closureHours} hours
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Referral Timeline (Figma 9021:12007, 12050, 12098) */}
      <section className="flex flex-col gap-2">
        <h2 className="text-[18px] font-normal text-[#495766]">
          Referral timeline
        </h2>

        <div 
          style={{ border: "none", boxShadow: "none" }}
          className="bg-[#fafafa] rounded-[28px] p-5 flex flex-col gap-5 w-full border-0 border-none shadow-none"
        >
          {/* Step 1: Referral created */}
          <div className="flex items-center gap-5">
            <div 
              style={{ border: "none", boxShadow: "none" }}
              className="size-[48px] rounded-full bg-[#f2f3f5] flex items-center justify-center shrink-0 border-0 shadow-none"
            >
              <img
                src="/icons/tick.svg"
                alt="Completed"
                className="size-5"
              />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="font-medium text-[#242b33] text-[18px]">
                Referral created
              </p>
              <div className="flex items-center gap-2 text-[#6e8298] text-sm">
                <span>{createdTimeStr}</span>
                <span className="size-1 rounded-full bg-[#a1aebc]" />
                <span>{createdDayStr}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#f0f0f0] w-full" />

          {/* Step 2: Patient arrival */}
          <div className="flex items-center gap-5">
            <div
              style={{ border: "none", boxShadow: "none" }}
              className={`size-[48px] rounded-full flex items-center justify-center shrink-0 border-0 shadow-none ${
                isArrived ? "bg-[#f2f3f5]" : "bg-[#f2f3f5]/50"
              }`}
            >
              {isArrived ? (
                <img
                  src="/icons/tick.svg"
                  alt="Completed"
                  className="size-5"
                />
              ) : (
                <span className="size-2 rounded-full bg-[#cdd1d9]" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <p
                className={`font-medium text-[18px] ${
                  isArrived ? "text-[#242b33]" : "text-[#a1aebc]"
                }`}
              >
                Patient arrival confirmed
              </p>
              <div className="text-sm">
                {isArrived ? (
                  <div className="flex items-center gap-2 text-[#6e8298]">
                    <span>{format(arrivedDate, "HH:mm")}</span>
                    <span className="size-1 rounded-full bg-[#a1aebc]" />
                    <span>{format(arrivedDate, "d MMMM yyyy")}</span>
                  </div>
                ) : (
                  <p className="text-[#a1aebc]">Awaiting patient arrival</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-[#f0f0f0] w-full" />

          {/* Step 3: Referral closed */}
          <div className="flex items-center gap-5">
            <div
              style={{ border: "none", boxShadow: "none" }}
              className={`size-[48px] rounded-full flex items-center justify-center shrink-0 border-0 shadow-none ${
                isClosed ? "bg-[#f2f3f5]" : "bg-[#f2f3f5]/50"
              }`}
            >
              {isClosed ? (
                <img
                  src="/icons/tick.svg"
                  alt="Completed"
                  className="size-5"
                />
              ) : (
                <span className="size-2 rounded-full bg-[#cdd1d9]" />
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <p
                className={`font-medium text-[18px] ${
                  isClosed ? "text-[#242b33]" : "text-[#a1aebc]"
                }`}
              >
                Referral closed
              </p>
              <div className="text-sm">
                {isClosed ? (
                  <div className="flex items-center gap-2 text-[#6e8298]">
                    <span>{format(closedDate, "HH:mm")}</span>
                    <span className="size-1 rounded-full bg-[#a1aebc]" />
                    <span>{format(closedDate, "d MMMM yyyy")}</span>
                  </div>
                ) : (
                  <p className="text-[#a1aebc]">Pending clinical resolution</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      {(referral.status === "created" || referral.status === "arrived") && (
        <div className="flex flex-col gap-2.5 pt-2">
          {referral.status === "created" && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => doTransition("arrived")}
              style={{ borderRadius: "12px", border: "none", outline: "none", boxShadow: "none" }}
              className="w-full h-[52px] rounded-[12px] bg-[#0073F3] hover:bg-[#0062d4] text-white font-medium text-[16px] transition-colors cursor-pointer flex items-center justify-center border-0 border-none shadow-none outline-none"
            >
              {transition.isPending ? "Updating..." : "Mark arrived"}
            </button>
          )}

          {referral.status === "arrived" && (
            <button
              type="button"
              disabled={transition.isPending}
              onClick={() => doTransition("closed")}
              style={{ borderRadius: "12px", border: "none", outline: "none", boxShadow: "none" }}
              className="w-full h-[52px] rounded-[12px] bg-[#0073F3] hover:bg-[#0062d4] text-white font-medium text-[16px] transition-colors cursor-pointer flex items-center justify-center border-0 border-none shadow-none outline-none"
            >
              {transition.isPending ? "Updating..." : "Mark closed"}
            </button>
          )}

          {!showCancel ? (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              style={{ borderRadius: "12px", border: "none", outline: "none", boxShadow: "none" }}
              className="w-full py-2.5 text-[15px] font-normal text-[#e05338] hover:text-[#c43b22] hover:bg-[#fff1ed] rounded-[12px] transition-colors cursor-pointer text-center border-0 border-none shadow-none outline-none"
            >
              Cancel referral
            </button>
          ) : (
            <div 
              style={{ border: "none", boxShadow: "none" }}
              className="bg-[#fafafa] rounded-[24px] p-5 flex flex-col gap-3 border-0 border-none shadow-none"
            >
              <p className="text-sm font-medium text-[#242b33]">
                Reason for cancellation
              </p>
              <Textarea
                placeholder="Provide a brief clinical reason..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ border: "none", outline: "none", borderRadius: "12px", boxShadow: "none" }}
                className="rounded-[12px] text-sm bg-white p-3 border-0 shadow-none resize-none focus:ring-1 focus:ring-[#e05338]"
              />
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCancel(false)}
                  style={{ borderRadius: "12px", border: "none", outline: "none", boxShadow: "none" }}
                  className="flex-1 h-[44px] rounded-[12px] bg-[#f2f3f5] hover:bg-[#e7e8eb] text-sm font-medium text-[#495766] transition-colors border-0 border-none shadow-none outline-none"
                >
                  Keep referral
                </button>
                <button
                  type="button"
                  disabled={!cancelReason.trim() || transition.isPending}
                  onClick={() => doTransition("cancelled", cancelReason.trim())}
                  style={{ borderRadius: "12px", border: "none", outline: "none", boxShadow: "none" }}
                  className="flex-1 h-[44px] rounded-[12px] bg-[#e05338] hover:bg-[#c43b22] text-white text-sm font-medium transition-colors disabled:opacity-50 border-0 border-none shadow-none outline-none"
                >
                  Confirm cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
