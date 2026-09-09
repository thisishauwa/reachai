"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import type {
  PrivacyMode,
  ReferralStatus,
} from "@/lib/supabase/database.types";

export function usePendingReferralAlert(facilityId: string) {
  return useQuery({
    queryKey: ["referrals", "pending-alert", facilityId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("referrals")
        .select(
          "id, referral_code, status, created_at, source_facility_id, destination_facility_id",
        )
        .or(
          `source_facility_id.eq.${facilityId},destination_facility_id.eq.${facilityId}`,
        )
        .in("status", ["created", "arrived"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

export function useReferrals(facilityId: string, search: string) {
  return useQuery({
    queryKey: ["referrals", "list", facilityId, search],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("referrals")
        .select(
          "id, referral_code, status, created_at, arrived_at, closed_at, source_facility_id, destination_facility_id, incentive_evaluations(eligible, closure_seconds)",
        )
        .or(
          `source_facility_id.eq.${facilityId},destination_facility_id.eq.${facilityId}`,
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (search.trim()) {
        query = query.ilike("referral_code", `%${search.trim()}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export interface ReferralDetail {
  id: string;
  referral_code: string;
  status: ReferralStatus;
  source_facility_id: string;
  destination_facility_id: string;
  referral_events: {
    id: string;
    from_status: ReferralStatus | null;
    to_status: ReferralStatus;
    reason: string | null;
    occurred_at: string;
  }[];
  incentive_evaluations: {
    eligible: boolean;
    reason: string | null;
    closure_seconds: number | null;
  }[];
}

export function useReferral(referralId: string | undefined) {
  return useQuery({
    queryKey: ["referrals", "detail", referralId],
    enabled: !!referralId,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("referrals")
        .select(
          "*, referral_events(id, from_status, to_status, reason, occurred_at), incentive_evaluations(eligible, reason, closure_seconds)",
        )
        .eq("id", referralId!)
        .single();
      if (error) throw error;
      return data as unknown as ReferralDetail;
    },
  });
}

export function useCreateReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      encounterId: string;
      destinationFacilityId: string;
      privacyMode: PrivacyMode;
      consentId: string | null;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("create_referral", {
        p_encounter_id: input.encounterId,
        p_destination_facility_id: input.destinationFacilityId,
        p_privacy_mode: input.privacyMode,
        p_consent_id: input.consentId,
        p_idempotency_key: createIdempotencyKey(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals"] }),
  });
}

export function useTransitionReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      referralId: string;
      toStatus: ReferralStatus;
      reason?: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("transition_referral", {
        p_referral_id: input.referralId,
        p_to_status: input.toStatus,
        p_reason: input.reason ?? null,
        p_idempotency_key: createIdempotencyKey(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referrals"] }),
  });
}

export function useDestinationFacilities(excludeFacilityId: string) {
  return useQuery({
    queryKey: ["facilities", "destinations", excludeFacilityId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("facilities")
        .select("id, name, code")
        .eq("is_active", true)
        .neq("id", excludeFacilityId);
      if (error) throw error;
      return data;
    },
  });
}
