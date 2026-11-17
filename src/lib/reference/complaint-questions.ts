export type ComplaintAreaCode = "A" | "B" | "C" | "D" | "E" | "F";
export type ComplaintAnswer = string | string[];

export interface ComplaintArea {
  code: ComplaintAreaCode;
  label_en: string;
  label_ha: string;
}

export const COMPLAINT_AREAS: ComplaintArea[] = [
  { code: "A", label_en: "Fever or hot body", label_ha: "Zazzabi ko jiki mai zafi" },
  { code: "B", label_en: "Diarrhoea or vomiting", label_ha: "Gudawa ko amai" },
  { code: "C", label_en: "Rash or skin problem", label_ha: "Kuraje ko matsalar fata" },
  { code: "D", label_en: "Headache or neck pain", label_ha: "Ciwon kai ko wuya" },
  { code: "E", label_en: "Cough or breathing problem", label_ha: "Tari ko matsalar numfashi" },
  { code: "F", label_en: "Something else, or not sure", label_ha: "Wani abu dabam, ko ba a tabbatar ba" },
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

const OPTION_HA_BY_VALUE: Record<string, string> = {
  "1_2_days": "Kwana 1 zuwa 2",
  "3_6_days": "Kwana 3 zuwa 6",
  "7_plus_days": "Kwana 7 ko fiye",
  yes_easily: "I, cikin sauki",
  no_stiff: "A'a, wuya ya yi tauri",
  yes: "I",
  no: "A'a",
  unknown: "Ban sani ba",
  "3_5": "Sau 3 zuwa 5",
  "6_10": "Sau 6 zuwa 10",
  over_10: "Fiye da sau 10",
  sunken_eyes: "Idanu sun fada ciki",
  very_thirsty: "Kishirwa sosai",
  slow_skin_pinch: "Fata tana komawa a hankali bayan an tsunkule",
  none: "Babu",
  piped: "Ruwan famfo",
  borehole: "Rijiyar burtsatse",
  sachet: "Ruwan leda",
  river_or_pond: "Kogi ko kududdufi",
  other: "Wani",
  face_or_behind_ears: "Fuska ko bayan kunne, yana bazuwa kasa",
  hands_face_genitals: "Hannu, fuska ko al'aura",
  elsewhere: "Wani wuri",
  not_applicable: "Bai shafa ba",
  under_2_weeks: "Kasa da makonni 2",
  "2_plus_weeks": "Makonni 2 ko fiye",
  other_not_listed: "Wata matsala da ba ta cikin jerin",
};

const QUESTION_HA_BY_ID: Record<string, string> = {
  A1: "Kwana nawa zazzabin ya yi?",
  A2: "Majiyyacin zai iya sunkuyar da haba ta taba kirji?",
  A3: "Akwai kuraje?",
  A4: "Ya riga ya sha maganin zazzabin cizon sauro amma bai samu sauki ba?",
  A5: "Cikin makonni 3 da suka wuce: akwai beraye a gida, ya kula da mai irin wannan rashin lafiya, ko ya halarci jana'izar wanda ya mutu da zazzabi?",
  A6: "Akwai matsanancin ciwon baya ko tsoka, kuma ya zauna a gona, daji ko karkara cikin makonni 2 da suka wuce?",
  A7: "Akwai gudawa ko amai kuma?",
  A8: "Akwai tari kuma?",
  B1: "Sau nawa aka yi bayan gida mai laushi ko ruwa cikin awanni 24 da suka wuce?",
  B2: "Akwai jini ko majina a bayan gida?",
  B3: "Bayan gidan yana kama da ruwan shinkafa—fari, gizagizai, ba wari sosai?",
  B4: "Wanne daga cikin wadannan kuke gani?",
  B5: "Ya yi fitsari cikin awanni 6 da suka wuce?",
  B6: "Akwai wani a gida da ya yi gudawa mai ruwa cikin kwanaki 7 da suka wuce?",
  B7: "Daga ina ake samun ruwan sha mafi yawa?",
  C1: "Akwai zazzabi tare da kurajen?",
  C2: "A ina kurajen suka fara?",
  C3: "Idanu ja masu ruwa, tari ko majina?",
  C4: "Akwai kumbura ko kuraje masu ruwa ko majina, dukkansu iri daya?",
  C5: "Ya hadu da mai zazzabi da kuraje cikin makonni 3 da suka wuce?",
  C6: "Akwai ruwa daga kunne, gyambon baki, ko rashin iya cin abinci?",
  C7: "An yi rigakafin kyanda?",
  D1: "Akwai zazzabi?",
  D2: "Majiyyacin zai iya sunkuyar da haba zuwa kirji?",
  D3: "Haske yana cutar da idanu?",
  D4: "Akwai tabo masu ruwan shunayya ko duhu da ba sa bacewa idan an matsa da gilashi?",
  D5: "Jariri kasa da shekara 1: wurin laushin kansa ya kumbura?",
  D6: "Akwai wanda aka tabbatar yana da sankarau a kusa cikin makonni 2 da suka wuce?",
  "cough E1": "Tarin ya yi tsawon nawa?",
  "cough E2": "Akwai zazzabi?",
  "cough E3": "Akwai jini a majinar tari?",
  "cough E4": "Akwai ramewa ko gumin dare?",
  "cough E5": "Akwai toka a makogwaro ko kumburin wuya?",
  "cough E6": "Akwai kuraje?",
  F1: "Yaro kasa da shekara 15 ya samu raunin hannu ko kafa kwatsam?",
  F2: "Dabba ta cije ko ta karce shi cikin watanni 3 da suka wuce?",
  F3: "Jariri kasa da kwana 28: yana da wahalar shan nono, taurin jiki, ko karkarwa?",
  F4: "Akwai zazzabi?",
  F5: "Idan ba daya daga cikin wadannan ba—menene babbar matsalar?",
  "A2a": "Haske yana cutar da idanun majiyyacin?",
  "A2b": "Akwai tabo masu ruwan shunayya ko duhu da ba sa bacewa idan an matsa?",
  "A2c": "Ga jariri kasa da shekara 1: wurin laushin kansa ya kumbura?",
  "A3a": "Kurajen sun fara a fuska ko bayan kunne sannan suka bazu kasa?",
  "A3b": "Akwai jajayen idanu masu ruwa, tari ko majina?",
  "A3c": "An yi rigakafin kyanda?",
  "A4a": "Akwai ciwon makogwaro?",
  "A4b": "Akwai kumburin fuska?",
  "A4c": "Akwai ciwon kirji ko baya?",
};

const option = (value: string, label: string, label_ha = OPTION_HA_BY_VALUE[value] ?? label): ComplaintOption => ({ value, label, label_ha });
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
): ComplaintQuestion => ({ id, answerKey, prompt_en, prompt_ha: QUESTION_HA_BY_ID[id] ?? prompt_en, options, ...config });

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
    question("C5", "RASH_CONTACT", "Contact with someone with fever and rash in last 3 weeks?", YES_NO_UNKNOWN),
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
    question("F5", "OTHER_MAIN_PROBLEM", "None of these — main problem", [
      option("eye_or_ear_problem", "Eye or ear problem", "Matsalar ido ko kunne"),
      option("stomach_or_body_pain", "Stomach or body pain", "Ciwon ciki ko jiki"),
      option("injury_or_wound", "Injury or wound", "Rauni ko ciwo"),
      option("other_not_listed", "Another problem", "Wata matsala da ba ta cikin jerin"),
    ]),
  ],
};

const A2_FOLLOW_UPS: ComplaintQuestion[] = [
  question("A2a", "PHOTOPHOBIA", "Does light hurt the eyes?", YES_NO),
  question("A2b", "NON_BLANCHING_SPOTS", "Purple or dark spots that stay when pressed?", YES_NO),
  question("A2c", "BULGING_FONTANELLE", "Infant under 1: is the soft spot bulging?", YES_NO, { visibleForAgeBands: UNDER_1_BANDS }),
];

const A3_FOLLOW_UPS: ComplaintQuestion[] = [
  question("A3a", "RASH_START_LOCATION", "Did the rash start on the face or behind the ears and spread down?", [
    option("face_or_behind_ears", "Yes"),
    option("elsewhere", "No"),
  ]),
  question("A3b", "MEASLES_EYE_COUGH_SIGNS", "Red watery eyes, cough or runny nose?", YES_NO),
  question("A3c", "MEASLES_VACCINE", "Measles vaccine?", YES_NO_UNKNOWN, { visibleForAgeBands: UNDER_15_BANDS }),
];

const A4_A5_FOLLOW_UPS: ComplaintQuestion[] = [
  question("A4a", "LASSA_SORE_THROAT", "Is there a sore throat?", YES_NO),
  question("A4b", "LASSA_FACIAL_SWELLING", "Is there facial swelling?", YES_NO),
  question("A4c", "LASSA_CHEST_BACK_PAIN", "Is there chest or back pain?", YES_NO),
];

export interface DisplayQuestion extends ComplaintQuestion {
  bridgeFrom?: "A7" | "A8" | "F4";
}

function appliesToAge(question: ComplaintQuestion, ageBand: string): boolean {
  return !question.visibleForAgeBands || question.visibleForAgeBands.includes(ageBand);
}

export function visibleComplaintQuestions(area: ComplaintAreaCode, answers: Record<string, ComplaintAnswer>, ageBand = "18_to_49"): DisplayQuestion[] {
  const result: DisplayQuestion[] = [];
  for (const item of COMPLAINT_QUESTION_SETS[area].filter((questionItem) => appliesToAge(questionItem, ageBand))) {
    result.push(item);
    if (area === "A" && item.id === "A2" && answers.NECK_FLEXION === "no_stiff") {
      result.push(...A2_FOLLOW_UPS.filter((followUp) => appliesToAge(followUp, ageBand)));
    }
    if (area === "A" && item.id === "A3" && answers.RASH_PRESENT === "yes") {
      result.push(...A3_FOLLOW_UPS.filter((followUp) => appliesToAge(followUp, ageBand)));
    }
    if (
      area === "A" &&
      item.id === "A5" &&
      (answers.MALARIA_MEDICINE_NO_IMPROVEMENT === "yes" || answers.LASSA_EXPOSURE === "yes")
    ) {
      result.push(...A4_A5_FOLLOW_UPS);
    }
  }

  if (area === "A" && answers.DIARRHOEA_OR_VOMITING === "yes") {
    result.push(...COMPLAINT_QUESTION_SETS.B.slice(0, 4).map((item) => ({ ...item, bridgeFrom: "A7" as const })));
  }
  if (area === "A" && answers.COUGH_PRESENT === "yes") {
    const coughBridge = [COMPLAINT_QUESTION_SETS.E[0], COMPLAINT_QUESTION_SETS.E[2], COMPLAINT_QUESTION_SETS.E[3]];
    result.push(...coughBridge.map((item) => ({ ...item, bridgeFrom: "A8" as const })));
  }

  if (area === "F" && answers.FEVER_PRESENT === "yes") {
    result.push(
      ...visibleComplaintQuestions("A", answers, ageBand).map((item) => ({
        ...item,
        bridgeFrom: "F4" as const,
      })),
    );
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
