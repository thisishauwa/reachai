"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useSession } from "@/lib/session/session-context";
import { useReferrals } from "@/lib/queries/referrals";

export default function ReferralsPage() {
  const { activeFacility } = useSession();
  const [search, setSearch] = useState("");
  const { data: referrals = [], isLoading } = useReferrals(
    activeFacility?.facilityId,
    search
  );

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-medium text-[#001f3e] tracking-tight">
          All referrals
        </h1>
        <p className="text-base text-[#8e8e8e] mt-0.5">
          Showing all{" "}
          <span className="font-medium text-[#495766]">
            {referrals.length} referrals
          </span>
        </p>
      </div>

      {/* Search Bar (NO border) */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 size-5 pointer-events-none">
          <img
            src="/icons/search.svg"
            alt=""
            className="size-full"
          />
        </div>
        <input
          type="text"
          placeholder="Search ID, initials..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ border: "none", outline: "none" }}
          className="w-full h-[52px] pl-11 pr-4 rounded-[16px] bg-[#fafafa] text-base text-[#242b33] placeholder:text-[#8e8e8e] focus:bg-[#f4f4f5] transition-colors"
        />
      </div>

      <div className="h-px bg-[#f0f0f0] w-full" />

      {/* Referrals List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#6e8298]">
          Loading referrals...
        </div>
      ) : referrals.length === 0 ? (
        <div className="bg-[#fafafa] rounded-[28px] p-8 text-center text-sm text-[#6e8298] border-0 shadow-none">
          No referrals found
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {referrals.map((r) => {
            const incentive = Array.isArray(r.incentive_evaluations)
              ? r.incentive_evaluations[0]
              : null;
            const isEligible = incentive?.eligible;
            const isArrived = r.status === "arrived";
            const isClosed = r.status === "closed";
            // Show sync error ONLY if explicitly marked with a sync error flag
            const hasSyncError = (r as unknown as { has_sync_error?: boolean })
              .has_sync_error === true;

            const dateStr = format(
              new Date(r.created_at),
              "MMM d'th at' HH:mm"
            );
            const statusLabel =
              r.status === "created"
                ? "Created"
                : r.status === "arrived"
                ? "Arrived"
                : r.status === "closed"
                ? "Closed"
                : r.status;

            return (
              <Link
                key={r.id}
                href={`/referrals/${r.id}`}
                className="group bg-[#fafafa] hover:bg-[#f4f4f5] rounded-[28px] px-5 py-4 flex items-center justify-between transition-colors outline-none border-0 shadow-none"
              >
                {/* Left details */}
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2.5">
                    <p className="text-base font-normal text-[#242b33]">
                      Referral {r.referral_code}
                    </p>
                    {hasSyncError && (
                      <img
                        src="/icons/danger.svg"
                        alt="Sync error"
                        className="size-5 shrink-0"
                      />
                    )}
                    {isArrived && (
                      <img
                        src="/icons/clock.svg"
                        alt="Arrived"
                        className="size-5 shrink-0"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-sm text-[#6e8298]">{dateStr}</span>
                    <span className="size-1 rounded-full bg-[#cdd1d9]" />
                    <span className="text-sm text-[#6e8298]">
                      {statusLabel}
                    </span>
                  </div>
                </div>

                {/* Right actions & badges */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <img
                    src="/icons/arrow-right.svg"
                    alt=""
                    className="size-[18px] opacity-70 group-hover:opacity-100 transition-opacity"
                  />

                  {hasSyncError && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                      className="flex items-center gap-1 text-sm font-medium text-[#ff512b] hover:underline cursor-pointer"
                    >
                      <img
                        src="/icons/refresh.svg"
                        alt=""
                        className="size-4 shrink-0"
                      />
                      Tap to retry sync
                    </button>
                  )}

                  {isClosed && isEligible && (
                    <span className="bg-[#ebf8ee] text-[#16a34a] text-xs font-medium px-2.5 py-0.5 rounded-full">
                      Eligible
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
