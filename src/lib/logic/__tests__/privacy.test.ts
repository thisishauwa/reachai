import { describe, expect, it } from "vitest";
import { assertPrivacyCompliant, AnonymousPrivacyViolationError } from "../privacy";

describe("assertPrivacyCompliant", () => {
  it("allows a clean anonymous payload", () => {
    expect(() => assertPrivacyCompliant("anonymous", {})).not.toThrow();
  });

  it("rejects an anonymous payload carrying a name", () => {
    expect(() =>
      assertPrivacyCompliant("anonymous", { full_name: "Jane Doe" })
    ).toThrow(AnonymousPrivacyViolationError);
  });

  it("rejects an anonymous payload carrying a signature path", () => {
    expect(() =>
      assertPrivacyCompliant("anonymous", { signature_storage_path: "org/facility/e/c.png" })
    ).toThrow(AnonymousPrivacyViolationError);
  });

  it("rejects an anonymous payload linked to a patient_id", () => {
    expect(() => assertPrivacyCompliant("anonymous", { patient_id: "uuid" })).toThrow(
      AnonymousPrivacyViolationError
    );
  });

  it("requires a name snapshot for identified encounters", () => {
    expect(() => assertPrivacyCompliant("identified", {})).toThrow(
      AnonymousPrivacyViolationError
    );
    expect(() =>
      assertPrivacyCompliant("identified", { full_name: "Jane Doe" })
    ).not.toThrow();
  });
});
