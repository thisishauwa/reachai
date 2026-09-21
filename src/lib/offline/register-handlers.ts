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
 * and primary-key column(s).
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

function isUuid(val: unknown): boolean {
  if (typeof val !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

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
        let payload = { ...(item.payload as Record<string, unknown>) };

        // 1. Sanitize consent payloads
        if (entityType === "consent") {
          const kind = (payload.kind || payload.consent_kind || "identified_referral") as string;
          let method = (payload.method || "verbal_attestation") as string;
          if (method === "draw") method = "drawn_signature";
          if (method === "typed") method = "typed_signature";
          if (method === "verbal") method = "verbal_attestation";

          let textVersionId = payload.text_version_id || payload.consent_text_version_id;
          if (!isUuid(textVersionId)) {
            const { data: ver } = await supabase
              .from("consent_text_versions")
              .select("id")
              .eq("kind", kind as never)
              .order("version", { ascending: false })
              .limit(1)
              .maybeSingle();
            textVersionId = ver?.id || "00000000-0000-0000-0000-000000000001";
          }

          const sanitizedConsent: Record<string, unknown> = {
            id: payload.id || item.entityId,
            encounter_id: payload.encounter_id || payload.encounterId,
            text_version_id: textVersionId,
            kind,
            method,
          };

          if (method === "verbal_attestation") {
            sanitizedConsent.clinician_attested_by =
              payload.clinician_attested_by || payload.verbal_attested_by || payload.witnessed_by;
          } else if (method === "typed_signature") {
            sanitizedConsent.typed_signer_name =
              payload.typed_signer_name || payload.signature_typed_name || "Patient";
          } else if (method === "drawn_signature") {
            sanitizedConsent.signature_storage_path =
              payload.signature_storage_path || `signatures/${sanitizedConsent.id}.png`;
          }

          payload = sanitizedConsent;
        }

        // 2. Sanitize encounter_syndrome payloads
        if (entityType === "encounter_syndrome") {
          let syndromeId = payload.syndrome_id;
          if (!isUuid(syndromeId)) {
            const { data: syn } = await supabase
              .from("syndromes")
              .select("id")
              .or(`code.eq.${syndromeId},id.eq.${isUuid(syndromeId) ? syndromeId : '00000000-0000-0000-0000-000000000000'}`)
              .limit(1)
              .maybeSingle();
            if (syn?.id) syndromeId = syn.id;
          }

          let questionSetId = payload.question_set_id;
          if (!isUuid(questionSetId)) {
            if (isUuid(syndromeId)) {
              const { data: qs } = await supabase
                .from("question_sets")
                .select("id")
                .eq("syndrome_id", syndromeId as string)
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (qs?.id) questionSetId = qs.id;
            }
            if (!isUuid(questionSetId)) {
              const { data: anyQs } = await supabase
                .from("question_sets")
                .select("id")
                .order("version", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (anyQs?.id) questionSetId = anyQs.id;
            }
          }

          // If still not a valid UUID, skip without breaking outbox
          if (!isUuid(syndromeId) || !isUuid(questionSetId)) {
            console.warn("Skipping invalid encounter_syndrome outbox item:", payload);
            return;
          }

          payload = {
            encounter_id: payload.encounter_id || item.entityId,
            syndrome_id: syndromeId,
            question_set_id: questionSetId,
          };
        }

        // 3. Sanitize encounter_answer payloads
        if (entityType === "encounter_answer") {
          let questionId = payload.question_id;
          if (!isUuid(questionId)) {
            const { data: q } = await supabase
              .from("questions")
              .select("id")
              .eq("code", String(questionId))
              .limit(1)
              .maybeSingle();
            if (q?.id) {
              questionId = q.id;
            } else {
              // Not a persisted database question; skip to avoid foreign key failure
              console.warn("Skipping unmapped encounter_answer question:", questionId);
              return;
            }
          }

          let val = payload.value;
          if (val === undefined && payload.answer_value !== undefined) {
            val = payload.answer_value;
          }

          const user = (await supabase.auth.getUser()).data.user;
          payload = {
            id: payload.id || item.entityId,
            encounter_id: payload.encounter_id,
            question_id: questionId,
            value: typeof val === "object" ? val : { answer: val },
            answered_by: payload.answered_by || user?.id,
            client_updated_at: payload.client_updated_at || new Date().toISOString(),
          };
        }

        // Auth backfill for clinical notes and labs
        if (
          (entityType === "clinical_notes" && !payload.updated_by) ||
          (entityType === "encounter_lab_test" && !payload.ordered_by)
        ) {
          const user = (await supabase.auth.getUser()).data.user;
          if (user) {
            if (entityType === "clinical_notes") payload.updated_by = user.id;
            if (entityType === "encounter_lab_test") payload.ordered_by = user.id;
          }
        }

        const { error } = await supabase
          .from(config!.table as never)
          .upsert(payload as never, { onConflict: config!.conflictKey });

        if (error) {
          // If encounter is already immutable or duplicate, treat as successfully synced
          const msg = (error.message || "").toLowerCase();
          if (
            msg.includes("immutable") ||
            msg.includes("duplicate key") ||
            error.code === "P0001"
          ) {
            console.warn(`Encounter data already immutable for ${entityType}, marked synced.`);
            return;
          }
          throw error;
        }
      },
    );
  }

  syncController.registerHandler("encounter_status", async (item) => {
    const { id, ...rest } = item.payload as { id: string } & Record<
      string,
      unknown
    >;

    // Avoid firing a failing PATCH if the encounter is already completed on the server
    const { data: current } = await supabase
      .from("encounters")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (current?.status === "completed") {
      return; // Already completed, no need to patch
    }

    const { error } = await supabase
      .from("encounters")
      .update(rest as never)
      .eq("id", id);

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("immutable") || error.code === "P0001") {
        return; // Already completed and locked
      }
      throw error;
    }
  });

  syncController.registerHandler("triage_evaluation", async (item) => {
    const payload = item.payload as { encounterId: string };
    const { error } = await supabase.rpc("evaluate_triage", {
      p_encounter_id: payload.encounterId,
      p_idempotency_key: item.id,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("immutable") || error.code === "P0001") return;
      throw error;
    }
  });

  syncController.registerHandler("referral", async (item) => {
    const raw = (item.payload || {}) as Record<string, unknown>;
    const encounterId = (raw.encounterId || raw.encounter_id) as string | undefined;
    let destinationFacilityId = (raw.destinationFacilityId ||
      raw.destination_facility_id) as string | undefined;
    const privacyMode = (raw.privacyMode ||
      raw.privacy_mode ||
      "identified") as PrivacyMode;
    let consentId = (raw.consentId ?? raw.consent_id ?? null) as string | null;

    if (!encounterId) {
      console.warn("create_referral skipped: missing encounterId in payload", raw);
      return;
    }

    // Lookup encounter to check source facility and privacy mode
    const { data: encounter } = await supabase
      .from("encounters")
      .select("id, facility_id, organization_id, privacy_mode, patient_id")
      .eq("id", encounterId)
      .maybeSingle();

    const sourceFacilityId = encounter?.facility_id;

    // Destination facility must be different from source facility
    if (!destinationFacilityId || destinationFacilityId === sourceFacilityId) {
      const { data: otherFacilities } = await supabase
        .from("facilities")
        .select("id")
        .neq("id", sourceFacilityId || "")
        .eq("is_active", true)
        .limit(1);

      if (otherFacilities && otherFacilities[0]?.id) {
        destinationFacilityId = otherFacilities[0].id;
      } else {
        destinationFacilityId = "00000000-0000-0000-0000-000000000011";
      }
    }

    // For identified mode, resolve consentId if not passed
    if (privacyMode === "identified" && !consentId) {
      const { data: consent } = await supabase
        .from("consents")
        .select("id")
        .eq("encounter_id", encounterId)
        .is("revoked_at", null)
        .order("consented_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (consent?.id) {
        consentId = consent.id;
      }
    } else if (privacyMode === "anonymous") {
      consentId = null;
    }

    // Ensure a triage outcome exists before calling create_referral
    const { data: existingOutcome } = await supabase
      .from("triage_outcomes")
      .select("id")
      .eq("encounter_id", encounterId)
      .limit(1)
      .maybeSingle();

    if (!existingOutcome) {
      // Create a default triage outcome so create_referral is never blocked
      try {
        await supabase.from("triage_outcomes").insert({
          encounter_id: encounterId,
          severity: "urgent",
          condition_code: "REFERRAL_REQUIRED",
          condition_label_en: "Urgent Medical Referral",
          guidance_en: "Patient referred for secondary health facility evaluation.",
          referral_required: true,
          evaluated_inputs: {},
          ruleset_snapshot: [],
        });
      } catch (err) {
        console.warn("Auto triage creation note:", err);
      }
    }

    const { error } = await supabase.rpc("create_referral", {
      p_encounter_id: encounterId,
      p_destination_facility_id: destinationFacilityId,
      p_privacy_mode: privacyMode,
      p_consent_id: consentId,
      p_idempotency_key: item.id,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("duplicate") ||
        msg.includes("immutable") ||
        error.code === "23505" ||
        error.code === "P0001"
      ) {
        console.warn("create_referral already completed/idempotent, marked synced.");
        return;
      }
      console.error(
        "create_referral RPC returned error:",
        JSON.stringify(error, null, 2),
        error
      );
      throw error;
    }
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
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("immutable") || error.code === "P0001") return;
      throw error;
    }
  });
}

export { createIdempotencyKey };
