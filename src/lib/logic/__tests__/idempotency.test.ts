import { describe, expect, it } from "vitest";
import { dedupeMutations } from "../idempotency";

describe("dedupeMutations", () => {
  it("keeps only the first occurrence of a repeated idempotency key", () => {
    const mutations = [
      { idempotencyKey: "a", attempt: 1 },
      { idempotencyKey: "b", attempt: 1 },
      { idempotencyKey: "a", attempt: 2 },
    ];
    expect(dedupeMutations(mutations)).toEqual([
      { idempotencyKey: "a", attempt: 1 },
      { idempotencyKey: "b", attempt: 1 },
    ]);
  });

  it("returns an empty array unchanged", () => {
    expect(dedupeMutations([])).toEqual([]);
  });
});
