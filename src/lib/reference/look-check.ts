export type LookCheckAnswer = "yes" | "no" | "unknown";

export interface LookCheckSign {
  code: string;
  label_en: string;
  label_ha: string;
  presentOnly?: boolean;
  newbornOnly?: boolean;
}

export const LOOK_CHECK_SIGNS: LookCheckSign[] = [
  { code: "L1", label_en: "Fitting now, or had a fit before coming", label_ha: "Yana farfadiya yanzu, ko ya yi farfadiya kafin zuwa" },
  { code: "L2", label_en: "Confused, very sleepy, or hard to wake", label_ha: "Yana rikice, yana barci sosai, ko yana da wahalar farkawa" },
  { code: "L3", label_en: "Bleeding from gums, nose, vomit, stool, urine, or unexplained bruising", label_ha: "Jini daga dasashi, hanci, amai, bayan gida ko fitsari, ko tabo ba tare da dalili ba" },
  { code: "L4", label_en: "Cannot stand, cannot drink, or had to be carried", label_ha: "Ba zai iya tsayuwa ko sha ba, ko sai an dauko shi" },
  { code: "L5", label_en: "Yellow eyes or yellow skin", label_ha: "Idanu ko fata sun yi rawaya" },
  { code: "L6", label_en: "Breathing very fast, or chest pulling in", label_ha: "Numfashi yana da sauri sosai, ko kirji yana ja ciki" },
  { code: "L7", label_en: "Baby under 28 days: not feeding, stiff, or having spasms", label_ha: "Jariri kasa da kwana 28: baya shan nono, jikinsa ya yi tauri, ko yana karkarwa" , newbornOnly: true },
  { code: "L8", label_en: "None of these, but this person looks very unwell to me", label_ha: "Babu wadannan, amma mutumin yana kama da mara lafiya sosai" },
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
    prompt_en: "Is the patient confused, very sleepy, or have they had a fit?",
    prompt_ha: "Shin majiyyacin yana rikice, yana barci sosai, ko ya yi farfadiya?",
    dangerAnswer: "yes",
  },
  {
    code: "L3",
    signCodes: ["L3"],
    prompt_en: "Have you seen any bleeding, or unexplained bruising?",
    prompt_ha: "Kun ga wani zubar jini ko tabo da ba a san dalilinsa ba?",
    dangerAnswer: "yes",
  },
  {
    code: "L4",
    signCodes: ["L4"],
    prompt_en: "Is the patient able to stand and drink by themselves?",
    prompt_ha: "Majiyyacin zai iya tsayuwa da shan ruwa da kansa?",
    dangerAnswer: "no",
  },
  {
    code: "L5",
    signCodes: ["L5"],
    prompt_en: "Are the patient's eyes or skin yellow?",
    prompt_ha: "Idanu ko fatar majiyyacin sun yi rawaya?",
    dangerAnswer: "yes",
  },
  {
    code: "L6",
    signCodes: ["L6"],
    prompt_en: "Is the patient breathing very fast?",
    prompt_ha: "Majiyyacin yana numfashi da sauri sosai?",
    dangerAnswer: "yes",
  },
  {
    code: "L7",
    signCodes: ["L7"],
    prompt_en: "Baby under 28 days: are they feeding, and is their body stiff?",
    prompt_ha: "Jariri kasa da kwana 28: yana shan nono, kuma jikinsa bai yi tauri ba?",
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
  const underFive = ["under_28_days", "under_1_year", "under_5", "0_28_days", "1_11_months", "1_4_years"].includes(ageBand);
  return LOOK_CHECK_SIGNS.filter((sign) => !sign.newbornOnly || newborn).map((sign) =>
    sign.code === "L4" && underFive
      ? { ...sign, label_en: "Cannot drink or breastfeed, or had to be carried", label_ha: "Ba zai iya sha ko shan nono ba, ko sai an dauko shi" }
      : sign,
  );
}

export function visibleCaregiverQuestions(ageBand: string): CaregiverQuestion[] {
  const newborn = isNewbornAgeBand(ageBand);
  const underFive = ["under_28_days", "under_1_year", "under_5", "0_28_days", "1_11_months", "1_4_years"].includes(ageBand);
  return CAREGIVER_QUESTIONS.filter((question) => !question.newbornOnly || newborn).map((question) =>
    question.code === "L4" && underFive
      ? { ...question, prompt_en: "Is the patient able to drink or breastfeed?", prompt_ha: "Majiyyacin zai iya sha ko shan nono?" }
      : question,
  );
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
    L1: "LOOK_CHECK_FIT",
    L2: "LOOK_CHECK_CONFUSION",
    L3: "LOOK_CHECK_BLEEDING",
    L4: "LOOK_CHECK_COLLAPSE",
    L5: "LOOK_CHECK_JAUNDICE",
    L6: "LOOK_CHECK_BREATHING",
    L7: "LOOK_CHECK_NEWBORN",
    L8: "LOOK_CHECK_UNWELL",
  };
  return variants[code] ?? `LOOK_CHECK_${code}`;
}

export function labelForLookCheckSign(code: string): string {
  return LOOK_CHECK_SIGNS.find((sign) => sign.code === code)?.label_en ?? "Acute danger sign";
}

/** L8 stays Acute, but a positive E25-E27 answer opens the matching normal set. */
export function complaintAreaForL8Answers(answers: Record<string, unknown>): "A" | "B" | "C" | null {
  if (answers.E25 === "yes") return "A";
  if (answers.E26 === "yes") return "B";
  if (answers.E27 === "yes") return "C";
  return null;
}

export interface EmergencyQuestion {
  code: string;
  prompt_en: string;
  prompt_ha: string;
  allowUnknown?: boolean;
}

export interface EmergencyVariant {
  id: "collapse" | "bleeding" | "jaundice" | "neurologic" | "breathing" | "newborn" | "unwell";
  title: string;
  ipc: string;
  ipc_ha: string;
  questions: EmergencyQuestion[];
}

const EMERGENCY_PROMPTS_HA: Record<string, string> = {
  E1: "Rawar idanun ta fara ne bayan zazzabi?",
  E2: "Fitsarin yana da duhu?",
  E3: "Akwai amai baki ko mai jini?",
  E4: "An taba yi wa majiyyacin rigakafin cutar zazzabin shawara?",
  E5: "Majiyyacin ya yi zazzabi na kwana 3 ko fiye?",
  E6: "Majiyyacin ya sha maganin zazzabin cizon sauro amma bai samu sauki ba?",
  E7: "Akwai beraye a gida, ko majiyyacin ya kula da wani mai irin wannan rashin lafiyar?",
  E8: "Majiyyacin yana da ciwon makogwaro ko kumburin fuska?",
  E9: "Akwai zazzabi?",
  E10: "Majiyyacin zai iya lankwasa habarsa zuwa kirjinsa, ko wuyansa ya yi tauri ko yana ciwo?",
  E11: "Akwai tabo masu ruwan shunayya ko duhu da ba sa bacewa idan an matsa?",
  E12: "Ga jariri kasa da shekara 1: wurin laushin kansa ya kumbura?",
  E13: "Majiyyacin ya yi gudawa mai ruwa cikin awanni 24 da suka wuce?",
  E14: "Bayan gidan yana kama da ruwan shinkafa?",
  E15: "Akwai zazzabi?",
  E16: "Majiyyacin ya yi fitsari cikin awanni 6 da suka wuce?",
  E17: "Akwai zazzabi?",
  E18: "Akwai kuraje?",
  E19: "Majiyyacin ya yi tari na makonni 2 ko fiye?",
  E20: "Akwai toka a makogwaro ko kumburin wuya?",
  E21: "An yanke cibiyar jaririn da reza mai tsabta?",
  E22: "Jikin jaririn ya yi tauri ko yana karkarwa?",
  E23: "Jaririn yana da zazzabi?",
  E24: "Jaririn ya sha nono tun bayan haihuwa?",
  E25: "Akwai zazzabi?",
  E26: "Akwai gudawa?",
  E27: "Akwai kuraje?",
};

const q = (code: string, prompt_en: string, allowUnknown = false): EmergencyQuestion => ({
  code,
  prompt_en,
  prompt_ha: EMERGENCY_PROMPTS_HA[code],
  allowUnknown,
});

export function emergencyVariantForSign(code: string): EmergencyVariant {
  if (code === "L3") {
    return {
      id: "bleeding",
      title: "Bleeding danger sign",
      ipc: "Put on gloves. Do not give an injection. Avoid direct contact with blood or body fluids.",
      ipc_ha: "Sanya safar hannu. Kada a yi allura. Kada a taba jini ko ruwan jiki kai tsaye.",
      questions: [
        q("E5", "Has the patient had fever for 3 or more days?"),
        q("E6", "Has the patient taken malaria medicine without getting better?"),
        q("E7", "Are there rats in the house, or did the patient care for someone with a similar illness?"),
        q("E8", "Does the patient have a sore throat or facial swelling?"),
      ],
    };
  }
  if (code === "L5") {
    return {
      id: "jaundice",
      title: "Yellow eyes or skin",
      ipc: "Wear gloves now. Do not give any injection. Do not touch blood or vomit with bare hands.",
      ipc_ha: "Sanya safar hannu yanzu. Kada a yi allura. Kada a taba jini ko amai da hannu babu safar hannu.",
      questions: [
        q("E1", "Did the yellow eyes start after the fever?"),
        q("E2", "Is the urine dark?"),
        q("E3", "Is there black or bloody vomit?"),
        q("E4", "Has the patient ever had a yellow fever vaccine?", true),
      ],
    };
  }
  if (code === "L1" || code === "L2") {
    return {
      id: "neurologic",
      title: code === "L1" ? "Fit or convulsion danger sign" : "Confusion or reduced consciousness",
      ipc: "Use standard precautions. Keep the area clear and do not put anything in the patient's mouth during a fit.",
      ipc_ha: "Bi ka'idojin kariya. Bude wurin, kuma kada a saka komai a bakin majiyyacin idan yana farfadiya.",
      questions: [
        q("E9", "Is there fever?"),
        q("E10", "Can the patient put their chin to their chest, or is the neck stiff or painful?"),
        q("E11", "Are there purple or dark spots that stay when pressed?"),
        q("E12", "For an infant under 1: is the soft spot on the head bulging?", true),
      ],
    };
  }
  if (code === "L4") {
    return {
      id: "collapse",
      title: "Cannot stand or drink",
      ipc: "Wash your hands with soap. Pour stool and vomit into the latrine. Clean the floor with bleach.",
      ipc_ha: "Wanke hannu da sabulu. Zuba bayan gida da amai a bandaki. Wanke kasa da sinadarin bleach.",
      questions: [
        q("E13", "Has the patient had watery diarrhoea in the last 24 hours?"),
        q("E14", "Is the stool like rice water?"),
        q("E15", "Is there fever?"),
        q("E16", "Has the patient passed urine in the last 6 hours?"),
      ],
    };
  }
  if (code === "L6") {
    return {
      id: "breathing",
      title: "Fast breathing or chest pulling in",
      ipc: "Use standard precautions. Give the patient space and improve airflow while transport is arranged.",
      ipc_ha: "Bi ka'idojin kariya. Ba majiyyacin sarari da iska yayin da ake shirya abin hawa.",
      questions: [
        q("E17", "Is there fever?"),
        q("E18", "Is there a rash?"),
        q("E19", "Has the patient had a cough for 2 weeks or more?"),
        q("E20", "Is there a grey coating in the throat or swelling of the neck?"),
      ],
    };
  }
  if (code === "L7") {
    return {
      id: "newborn",
      title: "Newborn danger sign",
      ipc: "Wash your hands before touching the baby. Keep the baby warm and avoid unnecessary handling.",
      ipc_ha: "Wanke hannu kafin taba jaririn. Rike jaririn da dumi kuma kada a yawaita taba shi ba dole ba.",
      questions: [
        q("E21", "Was the cord cut with a clean blade?", true),
        q("E22", "Does the baby have stiffness or spasms?"),
        q("E23", "Does the baby have a fever?"),
        q("E24", "Has the baby fed at all since birth?", true),
      ],
    };
  }
  if (code === "L8") {
    return {
      id: "unwell",
      title: "Patient looks very unwell",
      ipc: "Use standard precautions and avoid contact with body fluids until the clinic assesses the patient.",
      ipc_ha: "Bi ka'idojin kariya kuma guji taba ruwan jiki har sai asibiti ya duba majiyyacin.",
      questions: [
        q("E25", "Is there fever?"),
        q("E26", "Is there diarrhoea?"),
        q("E27", "Is there a rash?"),
      ],
    };
  }
  // All valid look-check codes are handled above. Keep an L8-safe fallback so
  // malformed persisted data never invents an unapproved question set.
  return emergencyVariantForSign("L8");
}
