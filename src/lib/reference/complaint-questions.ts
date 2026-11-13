export type ComplaintAreaCode = "A" | "B" | "C" | "D" | "E" | "F";
export type ComplaintAnswer = "yes" | "no" | "unknown";

export interface ComplaintArea {
  code: ComplaintAreaCode;
  label_en: string;
  label_ha: string;
}

export const COMPLAINT_AREAS: ComplaintArea[] = [
  { code: "A", label_en: "Fever or hot body", label_ha: "[Hausa pending]" },
  { code: "B", label_en: "Diarrhoea or vomiting", label_ha: "[Hausa pending]" },
  { code: "C", label_en: "Rash or skin problem", label_ha: "[Hausa pending]" },
  { code: "D", label_en: "Headache or neck pain", label_ha: "[Hausa pending]" },
  { code: "E", label_en: "Cough or breathing problem", label_ha: "[Hausa pending]" },
  { code: "F", label_en: "Something else, or not sure", label_ha: "[Hausa pending]" },
];

export interface ComplaintQuestion {
  /** Display ID from spec v0.3. */
  id: string;
  /** Canonical storage key; shared concepts such as fever use one key. */
  answerKey: string;
  prompt_en: string;
  prompt_ha: string;
}

const question = (id: string, answerKey: string, prompt_en: string): ComplaintQuestion => ({
  id,
  answerKey,
  prompt_en,
  prompt_ha: "[Hausa pending]",
});

export const COMPLAINT_QUESTION_SETS: Record<ComplaintAreaCode, ComplaintQuestion[]> = {
  A: [
    question("A1", "FEVER_PRESENT", "Does the patient have a fever or feel hot now?"),
    question("A2", "FEVER_THREE_DAYS", "Has the fever lasted for three days or more?"),
    question("A3", "FEVER_CHILLS", "Has the patient had chills or shivering?"),
    question("A4", "FEVER_HEADACHE", "Does the patient also have a headache?"),
    question("A5", "FEVER_RASH", "Does the patient also have a new rash?"),
    question("A6", "FEVER_YELLOW", "Do the patient's eyes or skin look yellow?"),
    question("A7", "DIARRHOEA_OR_VOMITING", "Does the patient also have diarrhoea or vomiting?"),
    question("A8", "COUGH_OR_BREATHING", "Does the patient also have a cough or breathing problem?"),
  ],
  B: [
    question("B1", "DIARRHOEA_WATERY", "Is the diarrhoea watery?"),
    question("B2", "DIARRHOEA_FREQUENT", "Has the patient passed loose stool three or more times today?"),
    question("B3", "VOMITING_REPEATED", "Has the patient vomited repeatedly?"),
    question("B4", "ABLE_TO_DRINK", "Can the patient drink and keep fluids down?"),
    question("B5", "BLOOD_IN_STOOL", "Is there blood in the stool or vomit?"),
    question("B6", "FEVER_PRESENT", "Does the patient also have a fever or hot body?"),
    question("B7", "DIARRHOEA_CONTACT", "Is anyone nearby sick with similar diarrhoea or vomiting?"),
  ],
  C: [
    question("C1", "FEVER_PRESENT", "Does the patient also have a fever or hot body?"),
    question("C2", "RASH_NEW", "Did the rash or skin problem start during this illness?"),
    question("C3", "RASH_SPREADING", "Is the rash spreading across the face or body?"),
    question("C4", "RASH_BLISTER", "Are there blisters, peeling skin, or open sores?"),
    question("C5", "RASH_RED_EYES", "Are the patient's eyes red or watery?"),
    question("C6", "RASH_ITCH", "Is the rash very itchy or painful?"),
    question("C7", "RASH_CONTACT", "Has the patient been near someone with a similar rash?"),
  ],
  D: [
    question("D1", "FEVER_PRESENT", "Does the patient also have a fever or hot body?"),
    question("D2", "HEADACHE_SEVERE", "Is the headache severe or getting worse?"),
    question("D3", "NECK_PAIN", "Is the neck painful or difficult to bend forward?"),
    question("D4", "LIGHT_PAIN", "Does bright light hurt the patient's eyes?"),
    question("D5", "HEADACHE_VOMITING", "Has the patient vomited with the headache?"),
    question("D6", "HEADACHE_CONFUSION", "Is the patient confused or unusually sleepy?"),
  ],
  E: [
    question("cough E1", "COUGH_PRESENT", "Does the patient have a cough?"),
    question("cough E2", "FEVER_PRESENT", "Does the patient also have a fever or hot body?"),
    question("cough E3", "BREATHING_FAST", "Is the patient breathing faster than usual?"),
    question("cough E4", "BREATHING_CHEST", "Does the chest pull in or is breathing difficult?"),
    question("cough E5", "COUGH_TWO_WEEKS", "Has the cough lasted for two weeks or more?"),
    question("cough E6", "COUGH_BLOOD", "Is the patient coughing up blood?"),
  ],
  F: [
    question("F1", "WEAK_LIMB", "Has an arm or leg suddenly become weak or floppy?"),
    question("F2", "OTHER_SUDDEN", "Did the main problem start suddenly?"),
    question("F3", "OTHER_WORSE", "Has the problem become worse today?"),
    question("F4", "FEVER_PRESENT", "Does the patient also have a fever or hot body?"),
    question("F5", "OTHER_CONTACT", "Is anyone nearby sick with a similar problem?"),
  ],
};

export interface DisplayQuestion extends ComplaintQuestion {
  bridgeFrom?: "A7" | "A8";
}

/**
 * Returns the selected area's visible questions. Set A can reveal bridge
 * questions, but canonical answer keys already present in the store are never
 * returned a second time.
 */
export function visibleComplaintQuestions(
  area: ComplaintAreaCode,
  answers: Record<string, ComplaintAnswer>,
): DisplayQuestion[] {
  const base = COMPLAINT_QUESTION_SETS[area];
  const result: DisplayQuestion[] = [...base];

  if (area === "A" && answers.DIARRHOEA_OR_VOMITING === "yes") {
    result.push(...COMPLAINT_QUESTION_SETS.B.slice(0, 4).map((item) => ({ ...item, bridgeFrom: "A7" as const })));
  }
  if (area === "A" && answers.COUGH_OR_BREATHING === "yes") {
    const coughBridge = [
      COMPLAINT_QUESTION_SETS.E[0],
      COMPLAINT_QUESTION_SETS.E[2],
      COMPLAINT_QUESTION_SETS.E[3],
    ];
    result.push(...coughBridge.map((item) => ({ ...item, bridgeFrom: "A8" as const })));
  }

  const seen = new Set<string>();
  return result.filter((item) => {
    if (seen.has(item.answerKey)) return false;
    seen.add(item.answerKey);
    return true;
  });
}
