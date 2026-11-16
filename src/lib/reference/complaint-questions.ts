export type ComplaintAreaCode = "A" | "B" | "C" | "D" | "E" | "F";
export type ComplaintAnswer = string | string[];

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

export interface ComplaintOption {
  value: string;
  label: string;
  label_ha: string;
}

export interface ComplaintQuestion {
  id: string;
  answerKey: string;
  prompt_en: string;
  prompt_ha: string;
  options: ComplaintOption[];
  multiple?: boolean;
  visibleForAgeBands?: string[];
}

const option = (value: string, label: string, label_ha = "[Hausa pending]"): ComplaintOption => ({ value, label, label_ha });
const YES_NO = [option("yes", "Yes", "I"), option("no", "No", "A'a")];
const YES_NO_UNKNOWN = [...YES_NO, option("unknown", "Don't know", "Ban sani ba")];
const UNDER_15_BANDS = ["under_28_days", "under_1_year", "under_5", "5_to_17", "0_28_days", "1_11_months", "1_4_years", "5_14_years"];
const UNDER_1_BANDS = ["under_28_days", "under_1_year", "0_28_days", "1_11_months"];
const NEWBORN_BANDS = ["under_28_days", "0_28_days"];

const question = (
  id: string,
  answerKey: string,
  prompt_en: string,
  options: ComplaintOption[],
  config: Pick<ComplaintQuestion, "multiple" | "visibleForAgeBands"> = {},
): ComplaintQuestion => ({ id, answerKey, prompt_en, prompt_ha: "[Hausa pending]", options, ...config });

export const COMPLAINT_QUESTION_SETS: Record<ComplaintAreaCode, ComplaintQuestion[]> = {
  A: [
    question("A1", "FEVER_DURATION", "How many days has the fever lasted?", [option("1_2_days", "1 to 2"), option("3_6_days", "3 to 6"), option("7_plus_days", "7 or more")]),
    question("A2", "NECK_FLEXION", "Can the patient bend the chin down to touch the chest?", [option("yes_easily", "Yes, easily"), option("no_stiff", "No, stiff")]),
    question("A3", "RASH_PRESENT", "Is there a rash?", YES_NO),
    question("A4", "MALARIA_MEDICINE_NO_IMPROVEMENT", "Already took malaria medicine without getting better?", YES_NO_UNKNOWN),
    question("A5", "LASSA_EXPOSURE", "In the last 3 weeks: rats in the house, cared for someone with a similar illness, or a funeral of someone who died of fever?", YES_NO),
    question("A6", "YELLOW_FEVER_EXPOSURE", "Severe back or muscle pain, and stayed in a farm, forest or rural area in the last 2 weeks?", YES_NO),
    question("A7", "DIARRHOEA_OR_VOMITING", "Is there also diarrhoea or vomiting?", YES_NO),
    question("A8", "COUGH_PRESENT", "Is there also a cough?", YES_NO),
  ],
  B: [
    question("B1", "WATERY_STOOL_COUNT", "How many loose or watery stools in the last 24 hours?", [option("3_5", "3 to 5"), option("6_10", "6 to 10"), option("over_10", "More than 10")]),
    question("B2", "BLOOD_OR_MUCUS_STOOL", "Blood or mucus in the stool?", YES_NO),
    question("B3", "RICE_WATER_STOOL", "Stool like rice water — pale, cloudy, little smell?", YES_NO),
    question("B4", "DEHYDRATION_SIGNS", "Which of these do you see?", [option("sunken_eyes", "Sunken eyes"), option("very_thirsty", "Very thirsty"), option("slow_skin_pinch", "Skin pinch goes back slowly"), option("none", "None")], { multiple: true }),
    question("B5", "URINE_LAST_6_HOURS", "Passed urine in the last 6 hours?", YES_NO),
    question("B6", "HOUSEHOLD_WATERY_DIARRHOEA", "Anyone else at home with watery diarrhoea in the last 7 days?", YES_NO),
    question("B7", "DRINKING_WATER_SOURCE", "Main drinking water source?", [option("piped", "Piped"), option("borehole", "Borehole"), option("sachet", "Sachet"), option("river_or_pond", "River or pond"), option("other", "Other")]),
  ],
  C: [
    question("C1", "FEVER_PRESENT", "Is there fever with the rash?", YES_NO),
    question("C2", "RASH_START_LOCATION", "Where did the rash start?", [option("face_or_behind_ears", "Face or behind ears, spreading down"), option("hands_face_genitals", "Hands, face or genitals"), option("elsewhere", "Elsewhere")]),
    question("C3", "MEASLES_EYE_COUGH_SIGNS", "Red watery eyes, cough or runny nose?", YES_NO),
    question("C4", "BLISTERS_SAME_STAGE", "Blisters or pus-filled bumps, all at the same stage?", YES_NO),
    question("C5", "RASH_CONTACT", "Contact with someone with fever and rash in last 3 weeks?", YES_NO),
    question("C6", "RASH_COMPLICATION_SIGNS", "Ear discharge, mouth ulcers, or unable to feed?", YES_NO),
    question("C7", "MEASLES_VACCINE", "Measles vaccine?", YES_NO_UNKNOWN, { visibleForAgeBands: UNDER_15_BANDS }),
  ],
  D: [
    question("D1", "FEVER_PRESENT", "Is there fever?", YES_NO),
    question("D2", "NECK_FLEXION", "Can the patient bend the chin to the chest?", [option("yes_easily", "Yes, easily"), option("no_stiff", "No, stiff")]),
    question("D3", "PHOTOPHOBIA", "Does light hurt the eyes?", YES_NO),
    question("D4", "NON_BLANCHING_SPOTS", "Purple or dark spots that stay when pressed with a glass?", YES_NO),
    question("D5", "BULGING_FONTANELLE", "Infant under 1: soft spot bulging?", [...YES_NO, option("not_applicable", "N/A")], { visibleForAgeBands: UNDER_1_BANDS }),
    question("D6", "MENINGITIS_CONTACT", "Anyone nearby diagnosed with meningitis in last 2 weeks?", YES_NO_UNKNOWN),
  ],
  E: [
    question("cough E1", "COUGH_DURATION", "How long has the cough lasted?", [option("under_2_weeks", "Under 2 weeks"), option("2_plus_weeks", "2 weeks or more")]),
    question("cough E2", "FEVER_PRESENT", "Is there fever?", YES_NO),
    question("cough E3", "BLOOD_IN_SPUTUM", "Blood in the sputum?", YES_NO),
    question("cough E4", "WEIGHT_LOSS_OR_NIGHT_SWEATS", "Weight loss or night sweats?", YES_NO),
    question("cough E5", "DIPHTHERIA_SIGNS", "Grey coating in the throat, or neck swelling?", YES_NO),
    question("cough E6", "RASH_PRESENT", "Is there a rash?", YES_NO),
  ],
  F: [
    question("F1", "WEAK_LIMB", "Sudden weakness or floppy arm or leg, under 15?", YES_NO, { visibleForAgeBands: UNDER_15_BANDS }),
    question("F2", "ANIMAL_BITE", "Bitten or scratched by an animal in last 3 months?", YES_NO),
    question("F3", "SICK_NEWBORN_SIGNS", "Baby under 28 days: feeding difficulty, stiffness, or spasms?", YES_NO, { visibleForAgeBands: NEWBORN_BANDS }),
    question("F4", "FEVER_PRESENT", "Is there fever?", YES_NO),
    question("F5", "OTHER_MAIN_PROBLEM", "None of these — main problem", [option("other_not_listed", "Other problem — detailed pick list pending PharmAccess")]),
  ],
};

export interface DisplayQuestion extends ComplaintQuestion {
  bridgeFrom?: "A7" | "A8";
}

function appliesToAge(question: ComplaintQuestion, ageBand: string): boolean {
  return !question.visibleForAgeBands || question.visibleForAgeBands.includes(ageBand);
}

export function visibleComplaintQuestions(area: ComplaintAreaCode, answers: Record<string, ComplaintAnswer>, ageBand = "18_to_49"): DisplayQuestion[] {
  const result: DisplayQuestion[] = COMPLAINT_QUESTION_SETS[area].filter((item) => appliesToAge(item, ageBand));

  if (area === "A" && answers.DIARRHOEA_OR_VOMITING === "yes") {
    result.push(...COMPLAINT_QUESTION_SETS.B.slice(0, 4).map((item) => ({ ...item, bridgeFrom: "A7" as const })));
  }
  if (area === "A" && answers.COUGH_PRESENT === "yes") {
    const coughBridge = [COMPLAINT_QUESTION_SETS.E[0], COMPLAINT_QUESTION_SETS.E[2], COMPLAINT_QUESTION_SETS.E[3]];
    result.push(...coughBridge.map((item) => ({ ...item, bridgeFrom: "A8" as const })));
  }

  const seen = new Set<string>();
  return result.filter((item) => {
    if (seen.has(item.answerKey)) return false;
    seen.add(item.answerKey);
    return true;
  });
}

export function hasComplaintAnswer(answer: ComplaintAnswer | undefined): boolean {
  return Array.isArray(answer) ? answer.length > 0 : Boolean(answer);
}
