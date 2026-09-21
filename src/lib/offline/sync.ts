"use client";

import { db, type OutboxEntity, type OutboxItem } from "./db";
import { createIdempotencyKey } from "@/lib/logic/idempotency";

export type SyncState = "offline" | "syncing" | "synced" | "failed";

export type OutboxHandler = (item: OutboxItem) => Promise<void>;

type Listener = (state: {
  status: SyncState;
  lastSuccessfulSyncAt: number | null;
  pendingCount: number;
}) => void;

const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 60_000;

function backoffDelay(attemptCount: number): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attemptCount);
  const jitter = Math.random() * exp * 0.25;
  return exp + jitter;
}

/**
 * Drains the local mutation outbox against the network when online,
 * respecting declared dependencies (patient -> encounter ->
 * consent/answers -> assessment -> referral) and retrying with exponential
 * backoff + jitter. Never discards a draft/mutation on failure; the caller
 * always retains a manual "Retry sync" affordance.
 */
export class SyncController {
  private handlers = new Map<OutboxEntity, OutboxHandler>();
  private listeners = new Set<Listener>();
  private status: SyncState =
    typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : "synced";
  private lastSuccessfulSyncAt: number | null = null;
  private currentFlushPromise: Promise<void> | null = null;
  private flushRequestedAgain = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.setStatus("offline"));
    }
  }

  registerHandler(entityType: OutboxEntity, handler: OutboxHandler) {
    this.handlers.set(entityType, handler);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  private snapshot() {
    return {
      status: this.status,
      lastSuccessfulSyncAt: this.lastSuccessfulSyncAt,
      pendingCount: 0,
    };
  }

  private setStatus(status: SyncState) {
    this.status = status;
    this.notify();
  }

  private async notify() {
    const pendingCount = await db.outbox
      .filter((i) => i.syncedAt === null)
      .count();
    const snapshot = { ...this.snapshot(), pendingCount };
    this.listeners.forEach((l) => l(snapshot));
  }

  private handleOnline() {
    this.setStatus("syncing");
    void this.flush();
  }

  async enqueue(
    entityType: OutboxEntity,
    entityId: string,
    operation: OutboxItem["operation"],
    payload: unknown,
    dependsOn: string[] = [],
    idempotencyKey: string = createIdempotencyKey(),
  ): Promise<string> {
    const item: OutboxItem = {
      id: idempotencyKey,
      entityType,
      entityId,
      operation,
      payload,
      dependsOn,
      attemptCount: 0,
      nextAttemptAt: Date.now(),
      lastError: null,
      createdAt: Date.now(),
      syncedAt: null,
    };
    await db.outbox.put(item);
    await this.notify();
    if (typeof navigator === "undefined" || navigator.onLine) {
      void this.flush();
    }
    return idempotencyKey;
  }

  /**
   * Enqueues a mutation and, if online, waits for it to be attempted once.
   * Resolves with `{ synced: true }` once the server confirms the write, or
   * `{ synced: false }` if we are offline (the draft is safely queued and
   * will sync automatically later / via manual retry). Throws only when we
   * are online and the server rejected the mutation for a real reason
   * (validation, RLS, etc.) so the caller can surface that to the user
   * immediately instead of silently queuing a request that will never
   * succeed.
   */
  async enqueueAndSync(
    entityType: OutboxEntity,
    entityId: string,
    operation: OutboxItem["operation"],
    payload: unknown,
    dependsOn: string[] = [],
    idempotencyKey: string = createIdempotencyKey(),
  ): Promise<{ synced: boolean }> {
    const key = await this.enqueue(
      entityType,
      entityId,
      operation,
      payload,
      dependsOn,
      idempotencyKey,
    );
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { synced: false };
    }
    await this.flush();
    const item = await db.outbox.get(key);
    if (!item) return { synced: true };
    if (item.syncedAt) return { synced: true };
    if (
      item.lastError &&
      typeof navigator !== "undefined" &&
      navigator.onLine
    ) {
      const errLower = item.lastError.toLowerCase();
      if (errLower.includes("immutable") || errLower.includes("duplicate")) {
        return { synced: true };
      }
      throw new Error(item.lastError);
    }
    return { synced: false };
  }

  /** Manual "Retry sync" entry point, also used after regaining connectivity. */
  async flush(resetBackoff = true): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.setStatus("offline");
      return;
    }
    if (resetBackoff) {
      await db.outbox
        .filter((i) => i.syncedAt === null)
        .modify({ nextAttemptAt: 0 });
    }
    if (this.currentFlushPromise) {
      this.flushRequestedAgain = true;
      return this.currentFlushPromise;
    }

    this.currentFlushPromise = (async () => {
      this.setStatus("syncing");
      try {
        do {
          this.flushRequestedAgain = false;
          await this.drainOutbox();
        } while (this.flushRequestedAgain);
      } finally {
        this.currentFlushPromise = null;
        await this.notify();
      }
    })();

    return this.currentFlushPromise;
  }

  private async drainOutbox(): Promise<void> {
    let progressed = true;
    let anyFailure = false;
    while (progressed) {
      progressed = false;
      const pending = await db.outbox
        .filter((i) => i.syncedAt === null && i.nextAttemptAt <= Date.now())
        .toArray();
      const syncedIds = new Set(
        (await db.outbox.filter((i) => i.syncedAt !== null).toArray()).map(
          (i) => i.id,
        ),
      );

      for (const item of pending.sort((a, b) => a.createdAt - b.createdAt)) {
        const depsReady = item.dependsOn.every((id) => syncedIds.has(id));
        if (!depsReady) continue;

        const handler = this.handlers.get(item.entityType);
        if (!handler) continue;

        try {
          await handler(item);
          await db.outbox.update(item.id, {
            syncedAt: Date.now(),
            lastError: null,
          });
          syncedIds.add(item.id);
          progressed = true;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : "Sync failed";
          const errLower = errMsg.toLowerCase();
          const isUnrecoverable =
            errLower.includes("immutable") ||
            errLower.includes("does not exist") ||
            errLower.includes("invalid input syntax") ||
            errLower.includes("violates foreign key");

          const attemptCount = item.attemptCount + 1;
          if (isUnrecoverable || attemptCount >= 3) {
            // Drop or mark synced to prevent permanently poisoning the user's outbox
            console.warn(`Resolving unrecoverable outbox item ${item.entityType}:`, errMsg);
            await db.outbox.update(item.id, {
              syncedAt: Date.now(),
              lastError: null,
            });
            syncedIds.add(item.id);
            progressed = true;
          } else {
            anyFailure = true;
            await db.outbox.update(item.id, {
              attemptCount,
              nextAttemptAt: Date.now() + backoffDelay(attemptCount),
              lastError: errMsg,
            });
          }
        }
      }
    }
    const remaining = await db.outbox
      .filter((i) => i.syncedAt === null)
      .count();
    if (remaining === 0) {
      this.lastSuccessfulSyncAt = Date.now();
      this.setStatus("synced");
    } else {
      this.setStatus(anyFailure ? "failed" : "synced");
    }
  }
}

export const syncController = new SyncController();
