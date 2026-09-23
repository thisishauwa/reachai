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
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients!encounters_patient_id_fkey(full_name)"
        )
        .eq("facility_id", facilityId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
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
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients!encounters_patient_id_fkey(full_name)"
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
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id"
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
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(encounterId!);
      
      let query = supabase
        .from("encounters")
        .select(
          `id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, completed_at, patient_id, clinician_id, facility_id,
           patients!encounters_patient_id_fkey(id, full_name, patient_code, sex, age_band, phone_e164),
           encounter_demographics(*),
           encounter_syndromes(*, syndromes(id, label_en, code)),
           triage_outcomes(*),
           referrals(*)`
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
            local = await db.draftEncounters.where("sessionCode").equals(encounterId!).first();
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
              completed_at: local.status === "completed" ? new Date(local.updatedAt).toISOString() : null,
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
          .select("*, questions!encounter_answers_question_id_fkey(id, prompt_en, code)")
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
