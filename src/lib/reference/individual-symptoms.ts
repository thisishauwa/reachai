/**
 * Individual danger signs for the ECHO symptom-entry screen.
 *
 * Matches the stakeholder's Sentinel prototype exactly:
 *   • 6 danger-sign checkboxes (select all that apply)
 *   • 1 dehydration sub-section (No / Mild / moderate / Severe)
 *
 * The symptom codes map to IDSR syndrome IDs on the backend.
 */

export interface DangerSign {
  id: string;
  code: string;
  label_en: string;
  label_ha: string;
  /** IDSR syndrome codes this sign contributes to */
  syndromes: string[];
}

export const DANGER_SIGNS: DangerSign[] = [
  {
    id: "SYM_BLEEDING",
    code: "BLEEDING",
    label_en: "Bleeding",
    label_ha: "Jini na fita",
    syndromes: ["FEVER_BLEEDING"],
  },
  {
    id: "SYM_YELLOW_EYES_SKIN",
    code: "YELLOW_EYES_SKIN",
    label_en: "Yellow eyes or skin",
    label_ha: "Idanu ko fata sun yi rawaya",
    syndromes: ["JAUNDICE"],
  },
  {
    id: "SYM_NECK_STIFFNESS",
    code: "NECK_STIFFNESS",
    label_en: "Neck stiffness",
    label_ha: "Wuya ta kafe",
    syndromes: ["FEVER_NECK_STIFFNESS"],
  },
  {
    id: "SYM_NEW_RASH",
    code: "NEW_RASH",
    label_en: "New rash",
    label_ha: "Kurji a fata",
    syndromes: ["FEVER_RASH"],
  },
  {
    id: "SYM_DIARRHEA",
    code: "DIARRHEA",
    label_en: "Diarrhea",
    label_ha: "Gudawa",
    syndromes: ["ACUTE_WATERY_DIARRHOEA"],
  },
  {
    id: "SYM_CONVULSIONS",
    code: "CONVULSIONS",
    label_en: "Convulsions / fits",
    label_ha: "Farfaɗiya",
    syndromes: ["NEONATAL_DANGER_SIGNS", "FEVER_NECK_STIFFNESS"],
  },
];

export type DehydrationLevel = "no" | "mild_moderate" | "severe";

export const DEHYDRATION_OPTIONS: {
  value: DehydrationLevel;
  label_en: string;
  label_ha: string;
  syndromes: string[];
}[] = [
  {
    value: "no",
    label_en: "No",
    label_ha: "A'a",
    syndromes: [],
  },
  {
    value: "mild_moderate",
    label_en: "Mild / moderate",
    label_ha: "Kaɗan / matsakaici",
    syndromes: ["ACUTE_WATERY_DIARRHOEA"],
  },
  {
    value: "severe",
    label_en: "Severe",
    label_ha: "Mai tsanani",
    syndromes: ["ACUTE_WATERY_DIARRHOEA"],
  },
];

/**
 * Derive IDSR syndrome IDs from selected danger sign codes + dehydration level.
 * Deduplicates the result.
 */
export function dangerSignsToSyndromes(
  selectedCodes: string[],
  dehydrationLevel: DehydrationLevel
): string[] {
  const set = new Set<string>();

  for (const code of selectedCodes) {
    const sign = DANGER_SIGNS.find((s) => s.code === code);
    if (sign) sign.syndromes.forEach((s) => set.add(s));
  }

  const dehydOption = DEHYDRATION_OPTIONS.find((o) => o.value === dehydrationLevel);
  if (dehydOption) dehydOption.syndromes.forEach((s) => set.add(s));

  return Array.from(set);
}
