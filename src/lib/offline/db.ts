import Dexie, { type Table } from "dexie";

/**
 * IndexedDB schema for offline drafts and the mutation outbox.
 * See PRD 5.14 (Offline-first and synchronization).
 */

export type OutboxEntity =
  | "patient"
  | "encounter"
  | "encounter_status"
  | "encounter_demographics"
  | "consent"
  | "encounter_syndrome"
  | "encounter_answer"
  | "clinical_notes"
  | "encounter_lab_test"
  | "encounter_lab_result"
  | "encounter_diagnosis"
  | "treatment_plan"
  | "prescription"
  | "triage_evaluation"
  | "referral"
  | "referral_transition";

export interface OutboxItem {
  id: string; // = idempotencyKey
  entityType: OutboxEntity;
  entityId: string;
  operation: "insert" | "update" | "rpc";
  payload: unknown;
  dependsOn: string[]; // ids of other outbox items that must sync first
  attemptCount: number;
  nextAttemptAt: number; // epoch ms
  lastError: string | null;
  createdAt: number;
  syncedAt: number | null;
}

export interface DraftEncounter {
  encounterId: string; // client-generated UUID, becomes the server id too
  workflowMode: "reach" | "echo";
  privacyMode: "identified" | "anonymous";
  facilityId: string;
  patientId: string | null;
  sessionCode: string | null;
  state: Record<string, unknown>; // full in-progress form state (answers, notes, etc.)
  updatedAt: number;
  status: "draft" | "in_progress" | "completed" | "synced";
}

class EchoReachDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  draftEncounters!: Table<DraftEncounter, string>;

  constructor() {
    super("echo-reach");
    this.version(1).stores({
      outbox: "id, entityType, entityId, nextAttemptAt, syncedAt",
      draftEncounters: "encounterId, status, updatedAt",
    });
  }
}

export const db = new EchoReachDatabase();
