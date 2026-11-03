/**
 * Step 1 — "What is the customer asking for?" (spec v0.3 §Step 1 / walkthrough v0.4 screen 3).
 *
 * Logged for surveillance only. A rise in a given request type across a ward is an
 * informative signal on its own, even with no symptom detail captured. The choice
 * here never routes or changes any later question (AC3).
 */
export interface RequestOption {
  value: string;
  label_en: string;
  label_ha: string;
}

export const REQUEST_OPTIONS: RequestOption[] = [
  { value: "malaria_medicine", label_en: "Malaria medicine", label_ha: "Maganin zazzabin cizon sauro" },
  { value: "antibiotic", label_en: "Antibiotic", label_ha: "Maganin rigakafin kwayoyin cuta" },
  { value: "pain_fever_tablet", label_en: "Pain or fever tablet", label_ha: "Kwayar zazzabi ko ciwo" },
  { value: "ors_antidiarrhoeal", label_en: "ORS or anti-diarrhoeal", label_ha: "ORS ko maganin gudawa" },
  { value: "cough_syrup", label_en: "Cough syrup", label_ha: "Maganin tari" },
  { value: "skin_cream", label_en: "Skin cream", label_ha: "Man shafawa na fata" },
  { value: "other", label_en: "Other", label_ha: "Wani abu" },
  { value: "advice_only", label_en: "Nothing, came for advice", label_ha: "Babu, don shawara kawai" },
];

/**
 * Step 2 — "Is the patient here now?" + age band (spec v0.3 §Step 2 / walkthrough screen 4).
 * Six bands only — no numeric field (AC4). Distinct from the REACH/anonymous-setup
 * seven-band taxonomy in `lib/reference/demographics.ts`, which an upcoming ticket
 * (AIR-857) may reconcile.
 */
export interface IdsrAgeBand {
  value: string;
  label_en: string;
  label_ha: string;
  /** Bands under 18 — drives "parental/guardian consent" wording downstream. */
  isMinor: boolean;
}

export const IDSR_AGE_BANDS: IdsrAgeBand[] = [
  { value: "under_28_days", label_en: "Under 28 days", label_ha: "Kasa da kwana 28", isMinor: true },
  { value: "under_1_year", label_en: "Under 1 year", label_ha: "Kasa da shekara 1", isMinor: true },
  { value: "under_5", label_en: "Under 5", label_ha: "Kasa da shekara 5", isMinor: true },
  { value: "5_to_17", label_en: "5 to 17", label_ha: "Shekara 5 zuwa 17", isMinor: true },
  { value: "18_to_49", label_en: "18 to 49", label_ha: "Shekara 18 zuwa 49", isMinor: false },
  { value: "50_plus", label_en: "50 and over", label_ha: "Shekara 50 zuwa sama", isMinor: false },
];

export type PatientPresence = "with_me" | "at_home";

export const PRESENCE_OPTIONS: { value: PatientPresence; label_en: string; label_ha: string }[] = [
  { value: "with_me", label_en: "Yes, with me", label_ha: "I, tare da ni" },
  { value: "at_home", label_en: "No, at home", label_ha: "A'a, yana gida" },
];

export function isMinorAgeBand(ageBand: string): boolean {
  return IDSR_AGE_BANDS.find((b) => b.value === ageBand)?.isMinor ?? false;
}

/** Humanises an age band value for display, tolerant of older/legacy band formats. */
export function formatAgeBandLabel(ageBand: string | null | undefined): string {
  if (!ageBand) return "Age unknown";
  const match = IDSR_AGE_BANDS.find((b) => b.value === ageBand);
  if (match) return match.label_en;
  // Legacy 7-band taxonomy (lib/reference/demographics.ts) or anything unrecognised:
  // fall back to a readable version of the raw value.
  const legacyMap: Record<string, string> = {
    "0_28_days": "Under 28 days",
    "1_11_months": "Under 1 year",
    "1_4_years": "Under 5",
    "5_14_years": "5 to 17",
    "15_17_years": "5 to 17",
    "18_49_years": "18 to 49",
    "50_plus_years": "50 and over",
    "25_49_years": "18 to 49",
    "50_64_years": "50 and over",
    "65_plus": "50 and over",
  };
  if (legacyMap[ageBand]) return legacyMap[ageBand];
  return ageBand.replace(/_/g, " ").replace(/\byears?\b/g, "").trim();
}
