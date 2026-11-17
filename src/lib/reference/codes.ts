function randomBase32(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function generateEncounterCode(): string {
  return `ENC-${randomBase32(6)}`;
}

/** Opaque session code for anonymous ECHO encounters -- never derived from PII. */
export function generateSessionCode(): string {
  return `AN-${randomBase32(6)}`;
}

/** Standard patient code — PAT-XXXXXX (6 base-32 chars). Used by all patient creation paths. */
export function generatePatientCode(): string {
  return `PAT-${randomBase32(6)}`;
}

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPRSTVWXYZ";
const REFERRAL_BLOCKLIST = new Set(["ASS", "BAD", "DIE", "SEX"]);

function referralLetters(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
  }
  return value;
}

/** v0.3 referral format: outlet pair + three pronounceable, unambiguous letters. */
export function generateReferralCode(outletCode?: string): string {
  const cleanedOutlet = (outletCode ?? "BK")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/[IOQU]/g, "")
    .slice(0, 2);
  const prefix = cleanedOutlet.length === 2 ? cleanedOutlet : "BK";
  let suffix = referralLetters(3);
  while (REFERRAL_BLOCKLIST.has(suffix)) suffix = referralLetters(3);
  return `${prefix}-${suffix}`;
}

/** The QR contains a signed lookup URL, never the clinical payload or plain code alone. */
export function referralLookupUrl(code: string): string {
  const signature = Array.from(code).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 2166136261).toString(36);
  return `https://idsr.ng/r/${encodeURIComponent(code)}?sig=${signature}`;
}
