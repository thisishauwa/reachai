"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session/session-context";
import { usePatients } from "@/lib/queries/patients";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
  const { activeFacility } = useSession();
  const [search, setSearch] = useState("");
  const { data: patients = [], isLoading } = usePatients(
    activeFacility?.facilityId,
    search
  );

  // Group patients alphabetically by first letter of their full name
  const groupedPatients = useMemo(() => {
    const groups: Record<string, typeof patients> = {};
    for (const p of patients) {
      const letter = (p.full_name?.trim()[0] || "#").toUpperCase();
      if (!groups[letter]) {
        groups[letter] = [];
      }
      groups[letter].push(p);
    }
    return Object.keys(groups)
      .sort()
      .map((letter) => ({
        letter,
        patients: groups[letter],
      }));
  }, [patients]);

  return (
    <div className="flex flex-col gap-4 sm:gap-5 pt-2 sm:pt-6">
      {/* Mobile Top Navigation Bar: Back to Home + Screen Title + Consistent Menu */}
      <MobileSubpageHeader title="Patients" backHref="/home" />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="hidden sm:block text-xl sm:text-[28px] font-normal text-[#495766] tracking-[-0.3px]">
            All patients
          </h1>
          <p className="text-xs sm:text-base text-[#6e8298] mt-0.5">
            Showing all{" "}
            <span className="font-medium text-[#242b33]">
              {patients.length} patients
            </span>
          </p>
        </div>

        <Link
          href="/patients/new"
          style={{ borderRadius: "12px", border: "none", boxShadow: "none" }}
          className="bg-[#0073F3] hover:bg-[#0062d4] text-white font-medium text-xs sm:text-[15px] px-3.5 sm:px-5 py-2 sm:py-2.5 h-[38px] sm:h-[52px] rounded-[12px] flex items-center justify-center shrink-0 border-0 shadow-none transition-colors"
        >
          Create new patient
        </Link>
      </div>

      {/* Search & Actions Bar */}
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
            placeholder="Search patients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: "none", outline: "none", boxShadow: "none" }}
            className="w-full h-[48px] sm:h-[52px] pl-11 pr-4 rounded-[16px] bg-[#fafafa] text-base text-[#242b33] placeholder:text-[#8e8e8e] focus:bg-[#f4f4f5] transition-colors border-0 shadow-none outline-none"
          />
        </div>
      </div>

      {/* Patients List with Alphabetical Grouping */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-[#6e8298]">
          Loading patients...
        </div>
      ) : patients.length === 0 ? (
        <div 
          style={{ border: "none", boxShadow: "none" }}
          className="bg-[#fafafa] rounded-[28px] p-8 text-center text-sm text-[#6e8298] border-0 shadow-none"
        >
          No patients found
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedPatients.map(({ letter, patients: groupList }) => (
            <section key={letter} className="flex flex-col gap-2.5">
              <h2 className="text-base font-medium text-[#6e8298] px-1">
                {letter}
              </h2>

              <div className="flex flex-col gap-2.5">
                {groupList.map((p) => {
                  const pInitials = getInitials(p.full_name);
                  return (
                    <Link
                      key={p.id}
                      href={`/patients/${p.id}`}
                      style={{ border: "none", boxShadow: "none" }}
                      className="group bg-[#fafafa] hover:bg-[#f4f4f5] rounded-[20px] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 transition-colors border-0 shadow-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          style={{ border: "1px solid #eaeaea" }}
                          className="size-[46px] sm:size-[50px] rounded-full bg-white flex items-center justify-center shrink-0"
                        >
                          <span className="text-[#0073f3] text-[15px] sm:text-[16px] font-medium">
                            {pInitials}
                          </span>
                        </div>
                        <p className="text-[15px] sm:text-[16px] font-medium text-[#242b33] truncate">
                          {p.full_name}
                        </p>
                      </div>

                      <div className="bg-[#f2f3f5] px-2.5 py-0.5 rounded-full shrink-0">
                        <span className="text-[#495766] font-mono text-[11px] sm:text-xs font-medium">
                          {p.patient_code}
                        </span>
                      </div>
                    </Link>
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
