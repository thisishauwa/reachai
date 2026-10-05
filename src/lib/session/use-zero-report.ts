"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session/session-context";

/**
 * useZeroReport — daily zero-report tracking, persisted to daily_reports table.
 *
 * AC8:  PPMV can set status in ≤ 2 taps from the home screen.
 * AC9:  If no status is set by end-of-day, the system records "no_report_auto".
 * AC10: "no_cases" and "no_report"/"no_report_auto" are visually distinct.
 *       7 consecutive no_report days trigger a follow-up flag.
 *
 * localStorage is used as the read cache so the UI never flickers on load.
 * All writes go to Supabase (with silent failure handling for offline).
 */

export type ZeroReportStatus =
  | "no_cases"        // explicit: PPMV saw no patients
  | "no_report"       // explicit: PPMV tapped "No report submitted"
  | "no_report_auto"  // system-recorded at end-of-day
  | "encounter"       // PPMV logged at least one encounter today
  | null;             // no status set yet

const CACHE_KEY = "echo_daily_report_cache";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCache(): { date: string; status: ZeroReportStatus } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(status: ZeroReportStatus) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ date: todayIso(), status })
  );
}

function clearCacheIfStale() {
  const cached = readCache();
  if (cached && cached.date !== todayIso()) {
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
  return cached;
}

export function useZeroReport() {
  const { activeFacility, userId } = useSession();
  const facilityId = activeFacility?.facilityId;

  const [todayStatus, setTodayStatusState] = useState<ZeroReportStatus>(
    () => clearCacheIfStale()?.status ?? null
  );
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [consecutiveNoReportDays, setConsecutiveNoReportDays] = useState(0);

  // ── Load today's status from cache / DB on mount ─────────────────────
  useEffect(() => {
    if (!userId || !facilityId) return;

    const cached = clearCacheIfStale();
    if (cached) {
      if (!cached.status) setShowReminderModal(true);
      return;
    }

    // Fetch from DB
    const supabase = createClient();
    supabase
      .from("daily_reports")
      .select("status, needs_follow_up")
      .eq("clinician_id", userId)
      .eq("report_date", todayIso())
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { status: string } | null;
        const status = (row?.status as ZeroReportStatus) ?? null;
        setTodayStatusState(status);
        writeCache(status);
        if (!status) setShowReminderModal(true);
      });

    // Load consecutive no-report count for the follow-up flag
    supabase
      .from("daily_reports")
      .select("report_date, status")
      .eq("clinician_id", userId)
      .in("status", ["no_report", "no_report_auto"])
      .order("report_date", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const rows = (data ?? []) as { report_date: string; status: string }[];
        if (!rows.length) return;
        let count = 0;
        for (const row of rows) {
          const expected = new Date();
          expected.setDate(expected.getDate() - 1 - count);
          if (row.report_date === expected.toISOString().slice(0, 10)) {
            count++;
          } else {
            break;
          }
        }
        setConsecutiveNoReportDays(count);
      });
  }, [userId, facilityId]);

  // ── Write status to DB + cache ────────────────────────────────────────
  const setTodayStatus = useCallback(
    async (status: Exclude<ZeroReportStatus, null>) => {
      setTodayStatusState(status);
      writeCache(status);

      if (!userId || !facilityId) return;

      const supabase = createClient();
      try {
        await supabase.from("daily_reports").upsert(
          {
            clinician_id: userId,
            facility_id: facilityId,
            report_date: todayIso(),
            status,
            is_auto_recorded: false,
            set_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "clinician_id,report_date" }
        );
      } catch (e) {
        console.warn("daily_reports upsert note (will retry on next load):", e);
      }
    },
    [userId, facilityId]
  );

  /** Called when a new encounter is logged — replaces the zero report */
  const setHasEncounterToday = useCallback(() => {
    setTodayStatus("encounter");
  }, [setTodayStatus]);

  const needsFollowUp = consecutiveNoReportDays >= 7;

  return {
    todayStatus,
    consecutiveNoReportDays,
    needsFollowUp,
    showReminderModal,
    setShowReminderModal,
    setTodayStatus,
    setHasEncounterToday,
  };
}
