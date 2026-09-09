import type { PrivacyMode } from "@/lib/supabase/database.types";

/**
 * Client-side guard mirroring the database constraints/triggers that
 * enforce anonymous-mode privacy (see `private.enforce_encounter_privacy`
 * and `private.enforce_consent_privacy`). This is defense-in-depth only --
 * the database is the actual enforcement boundary -- but it lets us fail
 * fast in the UI and unit test the rule without a database.
 */

export interface DemographicsPayload {
  full_name?: string | null;
  phone_e164?: string | null;
  patient_code?: string | null;
  signature_storage_path?: string | null;
  typed_signer_name?: string | null;
  patient_id?: string | null;
}

export class AnonymousPrivacyViolationError extends Error {}

/**
 * Throws if an anonymous-mode payload carries any identifying field.
 * Identified mode requires at least a name snapshot.
 */
export function assertPrivacyCompliant(
  privacyMode: PrivacyMode,
  payload: DemographicsPayload
): void {
  if (privacyMode === "anonymous") {
    const leaked = (
      ["full_name", "phone_e164", "patient_code", "signature_storage_path", "typed_signer_name", "patient_id"] as const
    ).filter((key) => payload[key] != null);
    if (leaked.length > 0) {
      throw new AnonymousPrivacyViolationError(
        `Anonymous encounters cannot store: ${leaked.join(", ")}`
      );
    }
    return;
  }

  if (!payload.full_name) {
    throw new AnonymousPrivacyViolationError(
      "Identified encounters require a patient name snapshot"
    );
  }
}
