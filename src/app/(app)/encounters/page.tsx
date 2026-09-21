"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "@/lib/session/session-context";
import { useEncounters } from "@/lib/queries/encounters";

export default function EncountersPage() {
  const { activeFacility, workflowMode } = useSession();
  const [search, setSearch] = useState("");
  const { data: encounters = [], isLoading } = useEncounters(
    activeFacility?.facilityId
  );

  // Filter encounters by search
  const filteredEncounters = useMemo(() => {
    if (!search.trim()) return encounters;
    const term = search.toLowerCase().trim();
    return encounters.filter((e) => {
      const pName = (
        e.patients && typeof e.patients === "object" && "full_name" in e.patients
          ? (e.patients as { full_name: string }).full_name
          : ""
      ).toLowerCase();
      const code = (e.encounter_code || "").toLowerCase();
      const mode = (e.workflow_mode || "").toLowerCase();
      return pName.includes(term) || code.includes(term) || mode.includes(term);
    });
  }, [encounters, search]);

  // Group encounters by month (e.g. "May 2024", "Apr 2024")
  const groupedEncounters = useMemo(() => {
    const groups: Record<string, typeof filteredEncounters> = {};
    for (const e of filteredEncounters) {
      const date = e.started_at ? new Date(e.started_at) : new Date();
      const monthKey = format(date, "MMMM yyyy");
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(e);
    }
    return Object.keys(groups).map((monthKey) => ({
      month: monthKey,
      items: groups[monthKey],
    }));
  }, [filteredEncounters]);

  const newEncounterHref =
    workflowMode === "echo"
      ? "/encounters/echo/new"
      : "/encounters/reach/new";

  return (
    <div className="flex flex-col gap-5 pt-4 sm:pt-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-normal text-[#495766] tracking-[-0.3px]">
            All encounters
          </h1>
          <p className="text-sm sm:text-base text-[#6e8298] mt-0.5">
            Showing all{" "}
            <span className="font-medium text-[#242b33]">
              {encounters.length} encounters
            </span>
          </p>
        </div>

        <Link
          href={newEncounterHref}
          style={{ borderRadius: "12px", border: "none", boxShadow: "none" }}
          className="bg-[#0073F3] hover:bg-[#0062d4] text-white font-medium text-sm sm:text-[15px] px-4 sm:px-5 py-2.5 h-[48px] sm:h-[52px] rounded-[12px] flex items-center justify-center shrink-0 border-0 shadow-none transition-colors"
        >
          Start new encounter
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 size-5 pointer-events-none">
            <img
              src="/icons/search.svg"
              alt=""
              className="size-full"
            />
          </div>
          <input
            type="text"
            placeholder="Search encounters"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", boxShadow: "none" }}
            className="w-full h-[48px] sm:h-[52px] pl-11 pr-4 rounded-[16px] bg-[#fafafa] text-base text-[#242b33] placeholder:text-[#8e8e8e] focus:bg-[#f4f4f5] transition-colors border-0 shadow-none outline-none"
          />
        </div>

        {/* Filter Action Button */}
        <button
          type="button"
          aria-label="Filter"
          style={{ border: "none", outline: "none", boxShadow: "none" }}
          className="size-[48px] sm:size-[52px] rounded-[16px] bg-[#fafafa] hover:bg-[#f4f4f5] flex items-center justify-center text-[#0073F3] shrink-0 transition-colors cursor-pointer border-0 shadow-none"
        >
          <Send className="size-5" />
        </button>
      </div>

      {/* Monthly Grouped Encounters */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#6e8298]">
          Loading encounters...
        </div>
      ) : encounters.length === 0 ? (
        <div
          style={{ border: "none", boxShadow: "none" }}
          className="bg-[#fafafa] rounded-[28px] p-8 text-center text-sm text-[#6e8298] border-0 shadow-none"
        >
          No encounters found
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedEncounters.map(({ month, items }) => (
            <section key={month} className="flex flex-col gap-2.5">
              <h2 className="text-base font-medium text-[#6e8298] px-1">
                {month}
              </h2>

              <div
                style={{ border: "none", boxShadow: "none" }}
                className="bg-[#fafafa] rounded-[28px] p-4 sm:p-5 flex flex-col gap-4 border-0 shadow-none"
              >
                {items.map((e, index) => {
                  const dateObj = e.started_at
                    ? new Date(e.started_at)
                    : new Date();
                  const monthAbbr = format(dateObj, "MMM");
                  const dayStr = format(dateObj, "dd");
                  const patientName =
                    e.patients &&
                    typeof e.patients === "object" &&
                    "full_name" in e.patients
                      ? (e.patients as { full_name: string }).full_name
                      : e.patient_id
                      ? "Patient"
                      : `Anonymous \u00b7 ${e.session_code || e.encounter_code}`;
                  const isClosed = e.status === "completed";

                  return (
                    <div key={e.id} className="flex flex-col gap-4">
                      {index > 0 && (
                        <div className="h-px bg-[#f0f0f0] w-full" />
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Date Circle */}
                          <div
                            style={{ border: "1px solid #eaeaea" }}
                            className="size-[50px] sm:size-[56px] rounded-full bg-white flex flex-col items-center justify-center shrink-0"
                          >
                            <span className="text-[10px] sm:text-[11px] font-semibold text-[#0073f3] uppercase leading-tight">
                              {monthAbbr}
                            </span>
                            <span className="text-[15px] sm:text-[17px] font-medium text-[#111643] leading-none mt-0.5">
                              {dayStr}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <p className="text-[15px] sm:text-[16px] font-medium text-[#242b33] truncate">
                              {e.encounter_code || `ENC-${e.id.slice(0, 6).toUpperCase()}`}
                            </p>
                            <p className="text-xs sm:text-sm text-[#6e8298] truncate">
                              <span className="text-[#bfbfbf]">For</span>{" "}
                              <span>{patientName}</span>
                            </p>
                          </div>
                        </div>

                        {/* Action Button: Styled per Figma with clean 12px radius */}
                        <Link
                          href={isClosed ? `/encounters/${e.id}` : newEncounterHref}
                          style={{
                            borderRadius: "12px",
                            boxShadow: "none",
                          }}
                          className="bg-white border border-[#0073f3] hover:bg-[#0073f3]/5 px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-[#0073f3] rounded-[12px] shrink-0 transition-colors shadow-none"
                        >
                          {isClosed ? "View details" : "Complete encounter"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
