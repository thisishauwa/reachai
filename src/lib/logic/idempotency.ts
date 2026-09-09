/**
 * Idempotency-key helpers shared by the offline outbox and the direct
 * (online) mutation paths. Every mutation that reaches the server carries a
 * stable, client-generated UUID so that retries (offline replay, double
 * taps, flaky connections) never create duplicate rows -- enforced
 * server-side by the `client_mutations` primary key.
 */

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface DedupeableMutation {
  idempotencyKey: string;
  [key: string]: unknown;
}

/**
 * Given a list of mutations that may contain retries (same idempotencyKey
 * appearing more than once because a previous attempt failed before the
 * client learned the outcome), returns only the first occurrence of each
 * key, preserving order. This is what the outbox drains against so a
 * duplicate enqueue never results in two network calls in the same flush.
 */
export function dedupeMutations<T extends DedupeableMutation>(mutations: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const mutation of mutations) {
    if (seen.has(mutation.idempotencyKey)) continue;
    seen.add(mutation.idempotencyKey);
    result.push(mutation);
  }
  return result;
}
