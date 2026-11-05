"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRecentEncounters(facilityId: string, limit = 5) {
  return useQuery({
    queryKey: ["encounters", "recent", facilityId, limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients!encounters_patient_id_fkey(full_name)",
        )
        .eq("facility_id", facilityId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Today / this-week recorded + referred tally for the Home screen (spec v0.3
 * "Today and this-week tally", walkthrough v0.4 screen 1). "This week" is a
 * rolling 7-day window, not a calendar week.
 */
export function useEncounterTally(facilityId: string | undefined) {
  return useQuery({
    queryKey: ["encounters", "tally", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const supabase = createClient();
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);

      const [todayRecorded, weekRecorded, todayReferred, weekReferred] =
        await Promise.all([
          supabase
            .from("encounters")
            .select("id", { count: "exact", head: true })
            .eq("facility_id", facilityId!)
            .neq("status", "voided")
            .gte("started_at", startOfToday.toISOString()),
          supabase
            .from("encounters")
            .select("id", { count: "exact", head: true })
            .eq("facility_id", facilityId!)
            .neq("status", "voided")
            .gte("started_at", startOfWeek.toISOString()),
          supabase
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("source_facility_id", facilityId!)
            .gte("created_at", startOfToday.toISOString()),
          supabase
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("source_facility_id", facilityId!)
            .gte("created_at", startOfWeek.toISOString()),
        ]);

      return {
        todayRecorded: todayRecorded.count ?? 0,
        weekRecorded: weekRecorded.count ?? 0,
        todayReferred: todayReferred.count ?? 0,
        weekReferred: weekReferred.count ?? 0,
      };
    },
  });
}

export function useEncounters(facilityId: string | undefined) {
  return useQuery({
    queryKey: ["encounters", "list", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients!encounters_patient_id_fkey(full_name)",
        )
        .eq("facility_id", facilityId!)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function usePatientEncounters(patientId: string | undefined) {
  return useQuery({
    queryKey: ["encounters", "patient", patientId],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id",
        )
        .eq("patient_id", patientId!)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useEncounter(encounterId: string | undefined) {
  return useQuery({
    queryKey: ["encounters", "detail", encounterId],
    enabled: Boolean(encounterId),
    queryFn: async () => {
      const supabase = createClient();
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          encounterId!,
        );

      let query = supabase.from("encounters").select(
        `id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, completed_at, patient_id, clinician_id, facility_id,
           patients!encounters_patient_id_fkey(id, full_name, patient_code, sex, age_band, phone_e164),
           encounter_demographics(*),
           encounter_syndromes(*, syndromes(id, label_en, code)),
           triage_outcomes(*),
           referrals(*)`,
      );

      if (isUuid) {
        query = query.eq("id", encounterId!);
      } else {
        query = query.eq("encounter_code", encounterId!);
      }

      const { data: encounter, error: encError } = await query.maybeSingle();

      if (encError || !encounter) {
        // Fallback to local Dexie draft/completed encounters
        try {
          const { db } = await import("@/lib/offline/db");
          let local = await db.draftEncounters.get(encounterId!);
          if (!local) {
            local = await db.draftEncounters
              .where("sessionCode")
              .equals(encounterId!)
              .first();
          }
          if (local) {
            return {
              id: local.encounterId,
              encounter_code: `ENC-${local.encounterId.slice(0, 8).toUpperCase()}`,
              workflow_mode: local.workflowMode,
              privacy_mode: local.privacyMode,
              status: local.status,
              session_code: local.sessionCode,
              started_at: new Date(local.updatedAt).toISOString(),
              completed_at:
                local.status === "completed"
                  ? new Date(local.updatedAt).toISOString()
                  : null,
              patient_id: local.patientId,
              clinician_id: "",
              facility_id: local.facilityId,
              patients: null,
              encounter_demographics: [],
              encounter_syndromes: [],
              triage_outcomes: [],
              referrals: [],
              answers: [],
            };
          }
        } catch (dexieErr) {
          console.warn("Dexie fallback error:", dexieErr);
        }
        if (encError) throw encError;
        return null;
      }

      const actualEncounterId = encounter.id;
      let answers: unknown[] = [];
      try {
        const { data: answersData } = await supabase
          .from("encounter_answers")
          .select(
            "*, questions!encounter_answers_question_id_fkey(id, prompt_en, code)",
          )
          .eq("encounter_id", actualEncounterId);
        answers = answersData ?? [];
      } catch (ansErr) {
        console.warn("Could not load answers with question relation:", ansErr);
      }

      return {
        ...encounter,
        answers,
      };
    },
  });
}

export interface EchoHistoryEncounter {
  id: string;
  encounter_code: string;
  session_code: string | null;
  started_at: string;
  status: string;
  encounter_demographics: { sex: string | null; age_band: string | null }[];
  triage_outcomes: { severity: string; condition_label_en: string | null }[];
  referrals: { status: string; referral_code: string }[];
}

/**
 * Encounter history for the ECHO workflow (spec v0.3 / walkthrough v0.4 screen 2).
 * Grouped by day, never carries a patient name — only sex + age band, matching
 * the anonymous-only ECHO model.
 */
export function useEchoEncounterHistory(facilityId: string | undefined) {
  return useQuery({
    queryKey: ["encounters", "echo-history", facilityId],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id, encounter_code, session_code, started_at, status, encounter_demographics(sex, age_band), triage_outcomes(severity, condition_label_en), referrals(status, referral_code)",
        )
        .eq("facility_id", facilityId!)
        .eq("workflow_mode", "echo")
        .neq("status", "voided")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as EchoHistoryEncounter[];
    },
  });
}

/**
 * Recent encounters for the ECHO Home screen "Recent encounters" card
 * (walkthrough v0.4 screen 1) — same anonymised shape as the full history,
 * just capped to a short list.
 */
export function useRecentEchoEncounters(
  facilityId: string | undefined,
  limit = 3,
) {
  const query = useEchoEncounterHistory(facilityId);
  return {
    ...query,
    data: (query.data ?? []).slice(0, limit),
  };
}
