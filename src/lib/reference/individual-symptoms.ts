/**
 * Individual danger signs and general symptoms for the ECHO screening flow.
 *
 * Flow order per clinical requirements:
 * 1. Danger Signs Screen: IDSR priority danger signs (Bleeding, Yellow eyes, Neck stiffness, etc.)
 *    • If danger signs selected → Disease-specific follow-up questions → Triage → Referral.
 *    • If NO danger signs selected → Normal symptoms screen (Fever, Cough, Headache, etc.) → Routine assessment advice.
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
    syndromes: ["NEONATAL_DANGER_SIGNS"],
  },
  {
    id: "SYM_PARALYSIS",
    code: "PARALYSIS",
    label_en: "Sudden limb weakness / paralysis",
    label_ha: "Raunin gaba ko shanyewar jiki kwatsam",
    syndromes: ["ACUTE_FLACCID_PARALYSIS"],
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
 * Normal / General Symptoms for outpatient triage when no IDSR danger signs are present.
 * These are managed at the community outlet (PPMV / Community Pharmacy) with rest,
 * OTC medication, oral hydration, and counseling on warning signs.
 */
export interface GeneralSymptom {
  id: string;
  code: string;
  label_en: string;
  label_ha: string;
  description_en: string;
}

export const GENERAL_SYMPTOMS: GeneralSymptom[] = [
  {
    id: "GEN_FEVER",
    code: "FEVER",
    label_en: "Fever / Hot body",
    label_ha: "Zazzabi / Zafin jiki",
    description_en: "Elevated body temperature, chills, or sweating",
  },
  {
    id: "GEN_COUGH",
    code: "COUGH",
    label_en: "Cough",
    label_ha: "Tari",
    description_en: "Dry or productive cough without fast breathing",
  },
  {
    id: "GEN_HEADACHE",
    code: "HEADACHE",
    label_en: "Headache",
    label_ha: "Ciwon kai",
    description_en: "Mild to moderate head pain",
  },
  {
    id: "GEN_BODY_ACHE",
    code: "BODY_ACHE",
    label_en: "Body ache / Joint pain",
    label_ha: "Ciwon jiki ko gabbai",
    description_en: "Generalized muscle or joint aches",
  },
  {
    id: "GEN_STOMACHACHE",
    code: "STOMACHACHE",
    label_en: "Stomachache / Abdominal pain",
    label_ha: "Ciwon ciki",
    description_en: "Mild abdominal discomfort or cramps",
  },
  {
    id: "GEN_RUNNY_NOSE",
    code: "RUNNY_NOSE",
    label_en: "Runny nose / Catarrh",
    label_ha: "Majina / Murfushi",
    description_en: "Clear nasal discharge, sneezing, or stuffiness",
  },
  {
    id: "GEN_SORE_THROAT",
    code: "SORE_THROAT",
    label_en: "Sore throat",
    label_ha: "Ciwon makogwaro",
    description_en: "Pain or irritation in throat on swallowing",
  },
  {
    id: "GEN_FATIGUE",
    code: "FATIGUE",
    label_en: "Fatigue / General weakness",
    label_ha: "Gajiya / Rashin ƙarfi",
    description_en: "Feeling unusually tired or lethargic",
  },
  {
    id: "GEN_LOSS_OF_APPETITE",
    code: "LOSS_OF_APPETITE",
    label_en: "Loss of appetite",
    label_ha: "Rashin son cin abinci",
    description_en: "Decreased desire to eat",
  },
  {
    id: "GEN_MILD_DIARRHEA",
    code: "MILD_DIARRHEA",
    label_en: "Mild loose stool",
    label_ha: "Gudawa kaɗan",
    description_en: "1 to 2 loose motions without dehydration",
  },
];

/**
 * Derive IDSR syndrome IDs from selected danger sign codes + dehydration level.
 * Deduplicates the result.
 */
export function dangerSignsToSyndromes(
  selectedCodes: string[],
  dehydrationLevel: DehydrationLevel = "no"
): string[] {
  const set = new Set<string>();

  for (const code of selectedCodes) {
    const sign = DANGER_SIGNS.find((s) => s.code === code);
    if (sign) sign.syndromes.forEach((s) => set.add(s));
  }

  // Dehydration only escalates if diarrhea is present or severe dehydration is noted
  if (selectedCodes.includes("DIARRHEA") || dehydrationLevel === "severe") {
    const dehydOption = DEHYDRATION_OPTIONS.find((o) => o.value === dehydrationLevel);
    if (dehydOption) dehydOption.syndromes.forEach((s) => set.add(s));
  }

  return Array.from(set);
}
