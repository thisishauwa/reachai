export type LookCheckAnswer = "yes" | "no" | "unknown";

export interface LookCheckSign {
  code: string;
  label_en: string;
  label_ha: string;
  presentOnly?: boolean;
  newbornOnly?: boolean;
}

export const LOOK_CHECK_SIGNS: LookCheckSign[] = [
  { code: "L1", label_en: "Collapsed, unconscious, or very difficult to wake", label_ha: "[Hausa pending]" },
  { code: "L2", label_en: "Struggling to breathe or breathing abnormally", label_ha: "[Hausa pending]" },
  { code: "L3", label_en: "Bleeding from the nose, mouth, skin, vomit, or stool", label_ha: "[Hausa pending]" },
  { code: "L4", label_en: "Cannot stand, sit upright, or drink", label_ha: "[Hausa pending]" },
  { code: "L5", label_en: "Eyes or skin look yellow", label_ha: "[Hausa pending]" },
  { code: "L6", label_en: "Having fits or convulsions now", label_ha: "[Hausa pending]" },
  { code: "L7", label_en: "Newborn looks ill, is not feeding, or feels very hot or cold", label_ha: "[Hausa pending]", newbornOnly: true },
  { code: "L8", label_en: "Looks very unwell to me", label_ha: "[Hausa pending]" },
];

export interface CaregiverQuestion {
  code: string;
  signCodes: string[];
  prompt_en: string;
  prompt_ha: string;
  dangerAnswer: "yes" | "no";
  newbornOnly?: boolean;
}

export const CAREGIVER_QUESTIONS: CaregiverQuestion[] = [
  {
    code: "L1_L2",
    signCodes: ["L1", "L2"],
    prompt_en: "Has the patient collapsed, become very difficult to wake, or started struggling to breathe?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "yes",
  },
  {
    code: "L3",
    signCodes: ["L3"],
    prompt_en: "Is the patient bleeding from the nose, mouth, skin, vomit, or stool?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "yes",
  },
  {
    code: "L4",
    signCodes: ["L4"],
    prompt_en: "Can the patient stand or sit upright and drink?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "no",
  },
  {
    code: "L5",
    signCodes: ["L5"],
    prompt_en: "Do the patient's eyes or skin look yellow?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "yes",
  },
  {
    code: "L6",
    signCodes: ["L6"],
    prompt_en: "Has the patient had a fit or convulsion during this illness?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "yes",
  },
  {
    code: "L7",
    signCodes: ["L7"],
    prompt_en: "Is the newborn not feeding, very hot or cold, or unusually sleepy?",
    prompt_ha: "[Hausa pending]",
    dangerAnswer: "yes",
    newbornOnly: true,
  },
];

export const LOOK_CHECK_PRIORITY = ["L7", "L3", "L1", "L2", "L5", "L4", "L6", "L8"] as const;

export function isNewbornAgeBand(ageBand: string): boolean {
  return ageBand === "under_28_days" || ageBand === "0_28_days";
}

export function visibleLookCheckSigns(ageBand: string): LookCheckSign[] {
  const newborn = isNewbornAgeBand(ageBand);
  return LOOK_CHECK_SIGNS.filter((sign) => !sign.newbornOnly || newborn);
}

export function visibleCaregiverQuestions(ageBand: string): CaregiverQuestion[] {
  const newborn = isNewbornAgeBand(ageBand);
  return CAREGIVER_QUESTIONS.filter((question) => !question.newbornOnly || newborn);
}

export function highestPrioritySign(codes: Iterable<string>): string | null {
  const selected = new Set(codes);
  return LOOK_CHECK_PRIORITY.find((code) => selected.has(code)) ?? null;
}

export function dangerSignsFromCaregiverAnswers(
  answers: Record<string, LookCheckAnswer>,
): string[] {
  const signs: string[] = [];
  for (const question of CAREGIVER_QUESTIONS) {
    if (answers[question.code] === question.dangerAnswer) signs.push(...question.signCodes);
  }
  return signs;
}

export function syndromeForLookCheckSign(code: string): string {
  const variants: Record<string, string> = {
    L1: "LOOK_CHECK_COLLAPSE",
    L2: "LOOK_CHECK_COLLAPSE",
    L3: "LOOK_CHECK_BLEEDING",
    L5: "LOOK_CHECK_JAUNDICE",
    L8: "LOOK_CHECK_UNWELL",
  };
  return variants[code] ?? `LOOK_CHECK_${code}`;
}

export function labelForLookCheckSign(code: string): string {
  return LOOK_CHECK_SIGNS.find((sign) => sign.code === code)?.label_en ?? "Acute danger sign";
}

export interface EmergencyQuestion {
  code: string;
  prompt_en: string;
  prompt_ha: string;
}

export interface EmergencyVariant {
  id: "collapse" | "bleeding" | "jaundice" | "unwell" | "pending";
  title: string;
  ipc: string;
  questions: EmergencyQuestion[];
}

const q = (code: string, prompt_en: string): EmergencyQuestion => ({
  code,
  prompt_en,
  prompt_ha: "[Hausa pending]",
});

export function emergencyVariantForSign(code: string): EmergencyVariant {
  if (code === "L3") {
    return {
      id: "bleeding",
      title: "Bleeding danger sign",
      ipc: "Put on gloves. Do not give an injection. Avoid direct contact with blood or body fluids.",
      questions: [
        q("E5", "Did the bleeding start without an injury?"),
        q("E6", "Is there blood in vomit or stool?"),
        q("E7", "Does the patient have a fever now or during this illness?"),
        q("E8", "Has the patient had contact with someone who was bleeding or very ill?"),
      ],
    };
  }
  if (code === "L5") {
    return {
      id: "jaundice",
      title: "Yellow eyes or skin",
      ipc: "Use gloves and clean hands carefully. Do not give an injection. Keep the toilet and touched surfaces clean.",
      questions: [
        q("E1", "Did the yellow colour start during this illness?"),
        q("E2", "Does the patient have a fever now or during this illness?"),
        q("E3", "Is the urine dark like tea or cola?"),
        q("E4", "Is the stool unusually pale?"),
      ],
    };
  }
  if (code === "L1" || code === "L2") {
    return {
      id: "collapse",
      title: "Collapse or breathing danger sign",
      ipc: "Keep a safe distance from body fluids and use gloves if available. Further IPC wording is pending PharmAccess.",
      questions: [
        q("E13", "Did the collapse or breathing problem start suddenly?"),
        q("E14", "Is the patient awake and responding normally now?"),
        q("E15", "Did the patient have a fit or convulsion?"),
        q("E16", "Was there fever before the collapse or breathing problem?"),
      ],
    };
  }
  if (code === "L8") {
    return {
      id: "unwell",
      title: "Patient looks very unwell",
      ipc: "Use standard precautions and avoid contact with body fluids until the clinic assesses the patient.",
      questions: [
        q("E25", "Did the illness become much worse today?"),
        q("E26", "Is the patient unusually sleepy, confused, or weak?"),
        q("E27", "Is there any other danger sign not already recorded?"),
      ],
    };
  }
  return {
    id: "pending",
    title: "Acute danger sign",
    ipc: "IPC instructions pending PharmAccess.",
    questions: [
      q(`${code}_DETAIL_1`, "Did this danger sign start suddenly?"),
      q(`${code}_DETAIL_2`, "Is the danger sign present now?"),
      q(`${code}_DETAIL_3`, "Has the patient's condition become worse today?"),
    ],
  };
}
