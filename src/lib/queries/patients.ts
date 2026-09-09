"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRecentPatients(facilityId: string, limit = 2) {
  return useQuery({
    queryKey: ["patients", "recent", facilityId, limit],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, patient_code, age_band, sex, created_at")
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function usePatients(facilityId: string, search: string) {
  return useQuery({
    queryKey: ["patients", "list", facilityId, search],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("patients")
        .select("id, full_name, patient_code, age_band, sex, created_at")
        .eq("facility_id", facilityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) {
        query = query.or(`full_name.ilike.%${search}%,patient_code.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function usePatient(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patients", "detail", patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
