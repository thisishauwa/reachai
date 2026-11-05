"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, isToday, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useEchoEncounterHistory,
  type EchoHistoryEncounter,
} from "@/lib/queries/encounters";
import { formatAgeBandLabel } from "@/lib/reference/request-options";

type HistoryFilter = "all" | "referred" | "results_in";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function sexLabel(sex: string | null | undefined): string {
  if (sex === "female") return "Female";
  if (sex === "male") return "Male";
  return "Patient";
}

export function rowStatus(e: EchoHistoryEncounter): {
  label: string;
  tone: "referred" | "results_in" | "routine" | "pending";
} {
  const hasClosedReferral = e.referrals?.some((r) => r.status === "closed");
  const hasOpenReferral = e.referrals?.some(
    (r) => r.status === "created" || r.status === "arrived",
  );
  if (hasClosedReferral) return { label: "Result in", tone: "results_in" };
  if (hasOpenReferral) return { label: "Referred", tone: "referred" };
  const severity = e.triage_outcomes?.[0]?.severity;
  if (severity && severity !== "none") {
    return {
      label: severity === "routine" ? "Routine" : "Pending",
      tone: severity === "routine" ? "routine" : "pending",
    };
  }
  return {
    label: e.status === "completed" ? "Routine" : "Pending",
    tone: e.status === "completed" ? "routine" : "pending",
  };
}

export const STATUS_STYLES: Record<string, string> = {
  referred: "bg-[#fff1ed] text-[#d4583b]",
  results_in: "bg-[#dcfce7] text-[#166534]",
  routine: "bg-[#f1f5f9] text-[#475569]",
  pending: "bg-[#fff8dc] text-[#92400e]",
};

/**
 * One anonymised encounter row — "Female, 18 to 49 / Cholera pattern · BK-TRN /
 * 14:20 / Referred" (walkthrough v0.4 screen 1 "Recent encounters" + screen 2
 * history list share this exact row shape).
 */
export function EchoEncounterRow({ e }: { e: EchoHistoryEncounter }) {
  const demo = e.encounter_demographics?.[0];
  const condition = e.triage_outcomes?.[0]?.condition_label_en;
  const referralCode = e.referrals?.[0]?.referral_code;
  const status = rowStatus(e);
  const timeLabel = format(new Date(e.started_at), "HH:mm");

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="text-[14px] sm:text-[15px] font-medium text-[#242b33] truncate">
          {sexLabel(demo?.sex)}, {formatAgeBandLabel(demo?.age_band)}
        </p>
        <p className="text-xs sm:text-sm text-[#6e8298] truncate">
          {condition ?? "No pattern matched"}
          {referralCode ? ` · ${referralCode}` : ""} · {timeLabel}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={cn(
            "text-[11px] font-medium px-2.5 py-1 rounded-full",
            STATUS_STYLES[status.tone],
          )}
        >
          {status.label}
        </span>
        <Link
          href={`/encounters/${e.id}`}
          className="bg-white border border-[#0073f3] hover:bg-[#0073f3]/5 px-3 py-1.5 text-xs font-medium text-[#0073f3] rounded-[10px] transition-colors"
        >
          View
        </Link>
      </div>
    </div>
  );
}

export function EchoEncounterHistory({
  facilityId,
}: {
  facilityId: string | undefined;
}) {
  const { data: encounters = [], isLoading } =
    useEchoEncounterHistory(facilityId);
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const withinWindow = useMemo(
    () =>
      encounters.filter(
        (e) => Date.now() - new Date(e.started_at).getTime() <= THIRTY_DAYS_MS,
      ),
    [encounters],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return withinWindow;
    return withinWindow.filter((e) => {
      const status = rowStatus(e);
      if (filter === "referred") return status.tone === "referred";
      if (filter === "results_in") return status.tone === "results_in";
      return true;
    });
  }, [withinWindow, filter]);

  const groups = useMemo(() => {
    const byDay = new Map<string, EchoHistoryEncounter[]>();
    for (const e of filtered) {
      const key = startOfDay(new Date(e.started_at)).toISOString();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(e);
    }
    const todayKey = startOfDay(new Date()).toISOString();
    if (!byDay.has(todayKey)) byDay.set(todayKey, []);

    return Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, items]) => ({ key, date: new Date(key), items }));
  }, [filtered]);

  const totalFiltered = filtered.length;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="text-xs sm:text-sm text-[#6e8298] px-1">
        No names are stored. Records are kept on this phone for 30 days.
        <span className="block text-[#a1aebc] italic mt-0.5">
          Ba a adana sunaye ba. Ana ajiye bayanai a wayar nan har kwana 30.
        </span>
      </p>

      {/* Filters */}
      <div
        className="flex items-center gap-2"
        role="tablist"
        aria-label="Filter encounter history"
      >
        {(
          [
            { value: "all", label: "All" },
            { value: "referred", label: "Referred" },
            { value: "results_in", label: "Results in" },
          ] as { value: HistoryFilter; label: string }[]
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            id={`history-filter-${f.value}`}
            onClick={() => setFilter(f.value)}
            className={cn(
              "min-h-11 px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer border",
              filter === f.value
                ? "bg-[#0073f3] border-[#0073f3] text-white"
                : "bg-white border-[#e4e8ec] text-[#495766] hover:bg-[#fafafa]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#6e8298]">
          Loading encounter history…
        </div>
      ) : totalFiltered === 0 && filter !== "all" ? (
        <div className="bg-[#fafafa] rounded-[20px] p-8 text-center text-sm text-[#6e8298]">
          No encounters match this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(({ key, date, items }) => {
            const today = isToday(date);
            const label = today ? "Today" : format(date, "EEEE, d MMMM");

            return (
              <section key={key} className="flex flex-col gap-2.5">
                <h2 className="text-sm font-medium text-[#6e8298] px-1">
                  {label}
                  {items.length > 0
                    ? ` · ${items.length} encounter${items.length === 1 ? "" : "s"}`
                    : ""}
                </h2>

                {items.length === 0 ? (
                  <div className="bg-[#fafafa] rounded-[20px] p-5 text-sm text-[#a1aebc]">
                    No encounters recorded
                  </div>
                ) : (
                  <div className="bg-[#fafafa] rounded-[20px] sm:rounded-[28px] p-4 sm:p-5 flex flex-col gap-4">
                    {items.map((e, idx) => (
                      <div key={e.id} className="flex flex-col gap-4">
                        {idx > 0 && (
                          <div className="h-px bg-[#f0f0f0] w-full" />
                        )}
                        <EchoEncounterRow e={e} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
