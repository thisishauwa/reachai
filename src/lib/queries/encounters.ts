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
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients(full_name)"
        )
        .eq("facility_id", facilityId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useEncounters(facilityId: string) {
  return useQuery({
    queryKey: ["encounters", "list", facilityId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id, encounter_code, workflow_mode, privacy_mode, status, session_code, started_at, patient_id, patients(full_name)"
        )
        .eq("facility_id", facilityId)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
