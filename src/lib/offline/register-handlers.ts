"use client";

import { createClient } from "@/lib/supabase/client";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { syncController } from "./sync";
import type { OutboxEntity, OutboxItem } from "./db";
import type {
  PrivacyMode,
  ReferralStatus,
} from "@/lib/supabase/database.types";

/**
 * Maps outbox entity types that are plain table upserts to their table name
 * and primary-key column(s). Every payload must already contain the primary
 * key (client-generated UUID for most tables, or the encounter_id for the
 * 1:1 tables) so retries are naturally idempotent (upsert on conflict).
 */
const TABLE_BY_ENTITY: Partial<
  Record<OutboxEntity, { table: string; conflictKey: string }>
> = {
  patient: { table: "patients", conflictKey: "id" },
  encounter: { table: "encounters", conflictKey: "id" },
  encounter_demographics: {
    table: "encounter_demographics",
    conflictKey: "encounter_id",
  },
  consent: { table: "consents", conflictKey: "id" },
  encounter_syndrome: {
    table: "encounter_syndromes",
    conflictKey: "encounter_id",
  },
  encounter_answer: { table: "encounter_answers", conflictKey: "id" },
  clinical_notes: { table: "clinical_notes", conflictKey: "encounter_id" },
  encounter_lab_test: { table: "encounter_lab_tests", conflictKey: "id" },
  encounter_lab_result: { table: "encounter_lab_results", conflictKey: "id" },
  encounter_diagnosis: { table: "encounter_diagnoses", conflictKey: "id" },
  treatment_plan: { table: "treatment_plans", conflictKey: "encounter_id" },
  prescription: { table: "prescriptions", conflictKey: "id" },
};

let registered = false;

/** Registers all outbox handlers exactly once per app session. */
export function registerOutboxHandlers() {
  if (registered) return;
  registered = true;

  const supabase = createClient();

  for (const [entityType, config] of Object.entries(TABLE_BY_ENTITY)) {
    syncController.registerHandler(
      entityType as OutboxEntity,
      async (item: OutboxItem) => {
        const { error } = await supabase
          .from(config!.table as never)
          .upsert(item.payload as never, { onConflict: config!.conflictKey });
        if (error) throw error;
      },
    );
  }

  syncController.registerHandler("encounter_status", async (item) => {
    const { id, ...rest } = item.payload as { id: string } & Record<
      string,
      unknown
    >;
    const { error } = await supabase
      .from("encounters")
      .update(rest as never)
      .eq("id", id);
    if (error) throw error;
  });

  syncController.registerHandler("triage_evaluation", async (item) => {
    const payload = item.payload as { encounterId: string };
    const { error } = await supabase.rpc("evaluate_triage", {
      p_encounter_id: payload.encounterId,
      p_idempotency_key: item.id,
    });
    if (error) throw error;
  });

  syncController.registerHandler("referral", async (item) => {
    const payload = item.payload as {
      encounterId: string;
      destinationFacilityId: string;
      privacyMode: PrivacyMode;
      consentId: string | null;
    };
    const { error } = await supabase.rpc("create_referral", {
      p_encounter_id: payload.encounterId,
      p_destination_facility_id: payload.destinationFacilityId,
      p_privacy_mode: payload.privacyMode,
      p_consent_id: payload.consentId,
      p_idempotency_key: item.id,
    });
    if (error) throw error;
  });

  syncController.registerHandler("referral_transition", async (item) => {
    const payload = item.payload as {
      referralId: string;
      toStatus: ReferralStatus;
      reason?: string | null;
    };
    const { error } = await supabase.rpc("transition_referral", {
      p_referral_id: payload.referralId,
      p_to_status: payload.toStatus,
      p_reason: payload.reason ?? null,
      p_idempotency_key: item.id,
    });
    if (error) throw error;
  });
}

export { createIdempotencyKey };
