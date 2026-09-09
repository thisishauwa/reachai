"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { ConsentKind } from "@/lib/supabase/database.types";

export function useSyndromes() {
  return useQuery({
    queryKey: ["reference", "syndromes"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("syndromes")
        .select("id, code, label_en, label_ha, display_order, audio_storage_path")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useActiveQuestionSet(syndromeId: string | null) {
  return useQuery({
    queryKey: ["reference", "question-set", syndromeId],
    enabled: !!syndromeId,
    queryFn: async () => {
      const supabase = createClient();
      const { data: set, error: setError } = await supabase
        .from("question_sets")
        .select("id, version")
        .eq("syndrome_id", syndromeId!)
        .eq("status", "published")
        .order("version", { ascending: false })
        .limit(1)
        .single();
      if (setError) throw setError;

      const { data: questions, error: qError } = await supabase
        .from("questions")
        .select("id, code, type, prompt_en, prompt_ha, help_en, help_ha, is_required, display_order, validation, show_when, audio_storage_path")
        .eq("question_set_id", set.id)
        .eq("is_active", true)
        .order("display_order");
      if (qError) throw qError;

      const { data: options, error: oError } = await supabase
        .from("question_options")
        .select("id, question_id, value, label_en, label_ha, display_order")
        .in("question_id", questions.map((q) => q.id))
        .order("display_order");
      if (oError) throw oError;

      return { questionSetId: set.id, questions, options };
    },
    staleTime: 5 * 60_000,
  });
}

export function useActiveConsentText(kind: ConsentKind) {
  return useQuery({
    queryKey: ["reference", "consent-text", kind],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("consent_text_versions")
        .select("id, kind, version, text_en, text_ha")
        .eq("kind", kind)
        .lte("effective_from", new Date().toISOString())
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useLabCatalogue() {
  return useQuery({
    queryKey: ["reference", "lab-catalogue"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: defs, error } = await supabase
        .from("lab_test_definitions")
        .select("id, code, name_en, name_ha, result_type")
        .eq("is_active", true)
        .order("name_en");
      if (error) throw error;

      const { data: components, error: cError } = await supabase
        .from("lab_test_components")
        .select("id, lab_test_definition_id, code, label_en, result_type, unit, reference_range, options, is_required, display_order")
        .order("display_order");
      if (cError) throw cError;

      return { definitions: defs, components };
    },
    staleTime: 5 * 60_000,
  });
}
