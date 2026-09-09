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
