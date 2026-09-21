"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRecentEncounters(facilityId: string, limit = 2) {
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
        .eq("status", "completed")
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
        .eq("status", "completed")
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
      const { data: encounter, error: encError } = await supabase
        .from("encounters")
        .select(
          `id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, completed_at, patient_id, clinician_id, facility_id,
           patients!encounters_patient_id_fkey(id, full_name, patient_code, sex, date_of_birth, phone_number, state, lga),
           encounter_demographics(*),
           encounter_syndromes(*, syndromes(id, label_en, code)),
           triage_outcomes(*),
           referrals(*)`
        )
        .eq("id", encounterId!)
        .single();
      if (encError) throw encError;

      const { data: answers } = await supabase
        .from("encounter_answers")
        .select("*, questions!encounter_answers_question_id_fkey(id, prompt_en, code)")
        .eq("encounter_id", encounterId!);

      return {
        ...encounter,
        answers: answers ?? [],
      };
    },
  });
}
