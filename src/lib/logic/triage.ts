import { evaluateConditions, type AnswerMap, type Condition } from "./conditions";
import type { TriageSeverity } from "@/lib/supabase/database.types";

/**
 * Client-side mirror of the rule-selection logic inside the
 * `evaluate_triage` Postgres function. Used for optimistic/offline preview
 * and unit-tested directly; the database function remains the sole
 * authority for the persisted `triage_outcomes` row.
 */

export interface TriageRuleLike {
  id: string;
  severity: TriageSeverity;
  priority: number;
  condition_code: string;
  conditions: Condition[];
  referral_required: boolean;
}

const SEVERITY_RANK: Record<TriageSeverity, number> = {
  emergency: 3,
  urgent: 2,
  routine: 1,
  none: 0,
};

/**
 * Selects the highest-priority matching rule. Priority order is
 * severity (Emergency > Urgent > Routine) first, then the rule's own
 * `priority` field, matching `private.severity_rank` + `order by priority
 * desc` in the SQL function.
 */
export function selectTriageOutcome<T extends TriageRuleLike>(
  rules: T[],
  inputs: AnswerMap
): T | null {
  const sorted = [...rules].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.priority - a.priority;
  });

  for (const rule of sorted) {
    if (evaluateConditions(rule.conditions, inputs)) {
      return rule;
    }
  }
  return null;
}

export interface ClinicalTriageOutcome {
  severity: TriageSeverity;
  referralRequired: boolean;
  conditionCode: string;
  conditionLabelEn: string;
  conditionLabelHa: string;
  guidanceEn: string;
  guidanceHa: string;
  ipcGuidanceEn: string | null;
  ipcGuidanceHa: string | null;
}

function isAffirmative(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    return lower === "yes" || lower === "true" || lower === "1" || lower === "i";
  }
  if (typeof val === "number") return val === 1;
  // Handle wrapped { answer: "yes" } objects from legacy outbox format
  if (val && typeof val === "object" && "answer" in val) {
    return isAffirmative((val as Record<string, unknown>).answer);
  }
  return false;
}

/**
 * Returns true if ANY `<code>_severity` key in the answers map is "severe" or "moderate".
 * Used to escalate triage outcomes when the PPMV rates the symptom as worse than mild.
 */
function hasSevereSeverity(answers: Record<string, unknown>): boolean {
  return Object.entries(answers).some(
    ([key, val]) =>
      key.endsWith("_severity") &&
      typeof val === "string" &&
      (val === "severe" || val === "moderate")
  );
}

function isRatedSevere(answers: Record<string, unknown>): boolean {
  return Object.entries(answers).some(
    ([key, val]) => key.endsWith("_severity") && typeof val === "string" && val === "severe"
  );
}

/**
 * Clinical assessment engine for ECHO follow-up syndrome questions.
 * Handles dire presentations (such as severe cholera dehydration when answers are "yes" and "yes"),
 * viral haemorrhagic fever bleeding, meningitis neck stiffness, and neonatal danger signs.
 */
/**
 * Evaluates triage for multiple syndromes and returns the worst (highest-severity) outcome.
 * Used when a patient has more than one chief complaint selected.
 */
/**
 * Clinical assessment for general / normal symptoms when no IDSR danger signs are present.
 * Provides clear advice for PPMVs and Community Pharmacists (rest, hydration, OTC meds, warning signs).
 * Never triggers a referral.
 */
export function evaluateGeneralSymptomsTriage(
  generalCodes: string[] = []
): ClinicalTriageOutcome {
  const codes = generalCodes.map((c) => c.toUpperCase());

  if (codes.includes("FEVER")) {
    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "UNCOMPLICATED_FEVER",
      conditionLabelEn: "Uncomplicated Febrile Illness",
      conditionLabelHa: "Zazzabi Mara Tsanani",
      guidanceEn:
        "Routine Outpatient Care: No IDSR danger signs detected. Advise patient/caregiver on adequate rest and plenty of oral fluids. Dispense antipyretic/analgesic (e.g. Paracetamol) as appropriate for age. Conduct mRDT malaria test if indicated. Red Flag Counseling: Return immediately if danger signs appear (such as stiff neck, abnormal bleeding, yellow eyes, convulsions, or inability to drink).",
      guidanceHa:
        "Kula ta Yau da Kullum a Gida: Babu alamomin hatsari. A ba da shawarar hutu da shan ruwa sosai. A ba da maganin zazzabi (Paracetamol) da ya dace. A yi gwajin zazzabin sauro (RDT) idan akwai. A gargadi majiyyaci ya dawo nan take idan wuya ta kafe, jini ya fita, ko ya kasa shan ruwa.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  if (codes.includes("COUGH")) {
    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "MILD_COUGH_URI",
      conditionLabelEn: "Upper Respiratory Tract Illness / Mild Cough",
      conditionLabelHa: "Tari da Murfi Mara Tsanani",
      guidanceEn:
        "Supportive Care: Mild cough and respiratory symptoms without fast breathing or chest indrawing. Soothe throat with warm fluids. Advise resting in well-ventilated space. Avoid unnecessary antibiotics. Return if cough persists beyond 2 weeks or if difficulty breathing develops.",
      guidanceHa:
        "Kula a Gida: Tari da murfi mara tsanani. A sha ruwan dumi da hutu. A dawo asibiti idan tari ya wuce makonni biyu ko numfashi ya yi wuya.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  if (codes.includes("HEADACHE") || codes.includes("BODY_ACHE")) {
    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "MILD_BODY_ACHE_HEADACHE",
      conditionLabelEn: "Tension Headache / Musculoskeletal Aches",
      conditionLabelHa: "Ciwon Kai da Jiki Mara Tsanani",
      guidanceEn:
        "Supportive Care: Mild headache or body aches without danger signs. Advise rest, stress relief, and hydration. Dispense Paracetamol or mild analgesic as needed. Return if fever or neck stiffness develops.",
      guidanceHa:
        "Kula a Gida: Ciwon kai da jiki mara tsanani. A ba da shawarar hutu da shan ruwa tare da Paracetamol. A dawo idan zazzabi ko wuya ta kafe.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  if (codes.includes("STOMACHACHE") || codes.includes("MILD_DIARRHEA")) {
    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "MILD_GI_SYMPTOMS",
      conditionLabelEn: "Mild Gastrointestinal Discomfort",
      conditionLabelHa: "Ciwon Ciki Mara Tsanani",
      guidanceEn:
        "Supportive Care: Mild abdominal discomfort without dehydration. Maintain fluid intake with ORS and clean water. Continue normal light feeding. Return immediately if blood in stool, persistent vomiting, or high fever occurs.",
      guidanceHa:
        "Kula a Gida: Ciwon ciki mara tsanani. A sha ruwan ORS da ruwa mai tsabta. A koma asibiti idan aka ga jini a kashi ko amai ya ki tsayawa.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  return {
    severity: "routine",
    referralRequired: false,
    conditionCode: "ROUTINE_CARE",
    conditionLabelEn: "Routine Care / Home Management",
    conditionLabelHa: "Kula ta Yau da Kullum a Gida",
    guidanceEn:
      "Standard PPMV / CP Advice: No IDSR epidemic danger signs identified. Advise adequate rest, nutritious diet, and good hydration. Provide symptomatic relief medications as indicated. Counsel caregiver to return immediately if danger signs (high fever, stiff neck, yellow eyes, bleeding, convulsions) emerge.",
    guidanceHa:
      "Shawarar PPMV / Masanin Magani: Babu alamomin hatsari. A ba da shawarar hutu, abinci mai kyau, da shan ruwa. A gargadi mai kula idan cutar ta karu.",
    ipcGuidanceEn: null,
    ipcGuidanceHa: null,
  };
}

interface ComplaintCategoryMatch {
  code: string;
  label: string;
  severity: TriageSeverity;
  priorityDisease?: boolean;
  guidance: string;
  ipc?: string | null;
}

function answerEquals(answers: Record<string, unknown>, key: string, value: string): boolean {
  return answers[key] === value;
}

function durationIsThreeOrMore(answers: Record<string, unknown>): boolean {
  return answers.FEVER_DURATION === "3_6_days" || answers.FEVER_DURATION === "7_plus_days";
}

function selectedCount(value: unknown): number {
  return Array.isArray(value) ? value.filter((item) => item !== "none").length : 0;
}

function complaintRoutineOutcome(area: string): ClinicalTriageOutcome {
  const fever = area === "A";
  return {
    severity: "routine",
    referralRequired: false,
    conditionCode: fever ? "BASELINE_FEBRILE_ILLNESS" : "NO_CATEGORY_MATCH",
    conditionLabelEn: fever ? "Baseline febrile illness" : "No specific category identified",
    conditionLabelHa: "[Hausa pending]",
    guidanceEn: fever
      ? "No danger sign or priority pattern matched. Advise fluids and rest, and explain the danger signs that require an immediate clinic review."
      : "No danger sign or priority pattern matched. Give routine within-scope advice and explain when to return or go to a clinic.",
    guidanceHa: "[Hausa pending]",
    ipcGuidanceEn: null,
    ipcGuidanceHa: null,
  };
}

/** Client-side prototype mirror of the v0.3 complaint rule table. */
export function evaluateComplaintTriage(
  answers: Record<string, unknown>,
): ClinicalTriageOutcome {
  const area = typeof answers.COMPLAINT_AREA === "string" ? answers.COMPLAINT_AREA : "";
  const matches: ComplaintCategoryMatch[] = [];
  const add = (match: ComplaintCategoryMatch) => {
    if (!matches.some((item) => item.code === match.code)) matches.push(match);
  };

  const bloodInStool = answerEquals(answers, "BLOOD_OR_MUCUS_STOOL", "yes");
  const riceWater = answerEquals(answers, "RICE_WATER_STOOL", "yes");
  const diarrhoeaBridge = answerEquals(answers, "DIARRHOEA_OR_VOMITING", "yes");
  const hasStoolCount = typeof answers.WATERY_STOOL_COUNT === "string";

  if ((hasStoolCount && riceWater && !bloodInStool) || (diarrhoeaBridge && riceWater)) {
    const acute = selectedCount(answers.DEHYDRATION_SIGNS) >= 2 || answerEquals(answers, "URINE_LAST_6_HOURS", "no");
    add({
      code: "CHOLERA_PATTERN",
      label: acute ? "Signs consistent with cholera, with severe dehydration" : "Signs consistent with cholera",
      severity: acute ? "emergency" : "urgent",
      priorityDisease: true,
      guidance: "Give ORS now, do not give an anti-diarrhoeal, and arrange the indicated referral. This is not a diagnosis.",
      ipc: "Wash hands with soap. Put stool and vomit in the latrine and clean contaminated surfaces with bleach.",
    });
  }

  if (bloodInStool) {
    add({
      code: "DYSENTERY_PATTERN",
      label: "Signs consistent with dysentery",
      severity: "urgent",
      guidance: "Give ORS as appropriate and refer today for clinical assessment. This is not a diagnosis.",
      ipc: "Wash hands with soap and clean contaminated surfaces carefully.",
    });
  }

  if (durationIsThreeOrMore(answers) && diarrhoeaBridge && answerEquals(answers, "BLOOD_OR_MUCUS_STOOL", "no")) {
    add({
      code: "TYPHOID_PATTERN",
      label: "Signs consistent with typhoid",
      severity: "urgent",
      guidance: "Refer today for clinical assessment and avoid empirical antibiotics that could delay correct testing. This is not a diagnosis.",
      ipc: "Use careful hand hygiene and safe food and water precautions.",
    });
  }

  const stiffNeck = answerEquals(answers, "NECK_FLEXION", "no_stiff");
  const meningitisPattern =
    (typeof answers.FEVER_DURATION === "string" && stiffNeck) ||
    (answerEquals(answers, "FEVER_PRESENT", "yes") && stiffNeck) ||
    answerEquals(answers, "BULGING_FONTANELLE", "yes");
  if (meningitisPattern) {
    const acute = answerEquals(answers, "NON_BLANCHING_SPOTS", "yes") || (stiffNeck && typeof answers.FEVER_DURATION === "string");
    add({
      code: "MENINGITIS_PATTERN",
      label: answerEquals(answers, "NON_BLANCHING_SPOTS", "yes")
        ? "Signs consistent with meningitis, with septicaemia warning signs"
        : "Signs consistent with meningitis",
      severity: acute ? "emergency" : "urgent",
      priorityDisease: true,
      guidance: "Arrange an immediate clinical assessment. Do not delay the referral. This is not a diagnosis.",
      ipc: "Keep some distance, use a mask if available, encourage cough covering, and ventilate the room.",
    });
  }

  const measlesPattern =
    answerEquals(answers, "FEVER_PRESENT", "yes") &&
    answerEquals(answers, "RASH_START_LOCATION", "face_or_behind_ears") &&
    answerEquals(answers, "MEASLES_EYE_COUGH_SIGNS", "yes");
  if (measlesPattern) {
    add({
      code: "MEASLES_PATTERN",
      label: "Signs consistent with measles",
      severity: answerEquals(answers, "COUGH_PRESENT", "yes") ? "emergency" : "urgent",
      priorityDisease: true,
      guidance: "Give supportive care within scope and arrange the indicated referral. Do not give routine antibiotics or steroids. This is not a diagnosis.",
      ipc: "Keep the patient away from babies and pregnant women, ventilate the room, and do not share clothes or bedding.",
    });
  }

  const lassaIndicators = ["MALARIA_MEDICINE_NO_IMPROVEMENT", "LASSA_EXPOSURE"].filter((key) => answerEquals(answers, key, "yes")).length;
  if (durationIsThreeOrMore(answers) && lassaIndicators >= 2) {
    add({
      code: "LASSA_VHF_PATTERN",
      label: "Signs consistent with Lassa fever or another viral haemorrhagic fever",
      severity: "urgent",
      priorityDisease: true,
      guidance: "Refer today, avoid aspirin, NSAIDs and injections, and keep the patient separated while transport is arranged. This is not a diagnosis.",
      ipc: "Wear gloves, avoid direct contact with body fluids, and wash hands before and after contact.",
    });
  }

  if (durationIsThreeOrMore(answers) && answerEquals(answers, "YELLOW_FEVER_EXPOSURE", "yes")) {
    add({
      code: "YELLOW_FEVER_PATTERN",
      label: "Signs consistent with yellow fever",
      severity: "urgent",
      priorityDisease: true,
      guidance: "Refer today and avoid aspirin or NSAIDs. This is not a diagnosis.",
      ipc: "Use standard precautions and advise sleeping under a mosquito net.",
    });
  }

  if (answerEquals(answers, "COUGH_DURATION", "2_plus_weeks") &&
      (answerEquals(answers, "BLOOD_IN_SPUTUM", "yes") || answerEquals(answers, "WEIGHT_LOSS_OR_NIGHT_SWEATS", "yes"))) {
    add({
      code: "TB_SCREENING_PATTERN",
      label: "Signs consistent with TB screening criteria",
      severity: "routine",
      guidance: "Refer for testing within the week. Avoid cough medicines or antibiotics that could delay assessment. This is not a diagnosis.",
      ipc: "Encourage cough covering and keep the area well ventilated.",
    });
  }

  if (answerEquals(answers, "DIPHTHERIA_SIGNS", "yes")) {
    add({
      code: "DIPHTHERIA_PATTERN",
      label: "Signs consistent with diphtheria",
      severity: "urgent",
      guidance: "Refer today and do not delay for treatment at the outlet. This is not a diagnosis.",
      ipc: "Use a mask if available, keep some distance, and ventilate the room.",
    });
  }

  if (answerEquals(answers, "RASH_START_LOCATION", "hands_face_genitals") && answerEquals(answers, "BLISTERS_SAME_STAGE", "yes")) {
    add({
      code: "MPOX_PATTERN",
      label: "Signs consistent with mpox",
      severity: "urgent",
      guidance: "Refer today and avoid direct contact with the rash. This is not a diagnosis.",
      ipc: "Do not share clothes or bedding; use gloves if available and wash hands carefully.",
    });
  }

  if (answerEquals(answers, "WEAK_LIMB", "yes")) {
    add({
      code: "AFP_PATTERN",
      label: "Signs consistent with acute flaccid paralysis",
      severity: "urgent",
      guidance: "Refer today and notify the surveillance contact immediately. Give nothing that delays assessment. This is not a diagnosis.",
    });
  }

  if (answerEquals(answers, "ANIMAL_BITE", "yes")) {
    add({
      code: "RABIES_EXPOSURE_PATTERN",
      label: "Rabies exposure requiring assessment",
      severity: "urgent",
      guidance: "Wash the wound thoroughly and refer today for rabies post-exposure assessment. This is not a diagnosis.",
    });
  }

  if (answerEquals(answers, "SICK_NEWBORN_SIGNS", "yes")) {
    add({
      code: "NEONATAL_TETANUS_PATTERN",
      label: "Newborn danger signs, including neonatal tetanus pattern",
      severity: "emergency",
      guidance: "Refer now. Keep the baby warm and do not dispense medicine at the outlet. This is not a diagnosis.",
    });
  }

  if (matches.length === 0) return complaintRoutineOutcome(area);

  const pregnant = answers.PREGNANCY_STATUS === "pregnant";
  const ranked = matches
    .map((match) => pregnant && match.priorityDisease && match.severity === "urgent" ? { ...match, severity: "emergency" as const } : match)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const top = ranked[0];
  const labels = ranked.map((match) => match.label);

  return {
    severity: top.severity,
    referralRequired: true,
    conditionCode: ranked.map((match) => match.code).join("+"),
    conditionLabelEn: labels.join("; also "),
    conditionLabelHa: "[Hausa pending]",
    guidanceEn: top.guidance,
    guidanceHa: "[Hausa pending]",
    ipcGuidanceEn: top.ipc ?? null,
    ipcGuidanceHa: top.ipc ? "[Hausa pending]" : null,
  };
}

/**
 * Evaluates triage for multiple syndromes and returns the worst (highest-severity) outcome.
 * Used when a patient has more than one chief complaint selected.
 * When no danger signs are present (syndromeIds is empty), evaluates routine care for general symptoms.
 */
export function evaluateMultiSyndromeTriage(
  syndromeIds: string[],
  answers: Record<string, unknown> = {},
  generalSymptomCodes: string[] = []
): ClinicalTriageOutcome {
  if (syndromeIds.length === 0) {
    if (generalSymptomCodes.some((code) => code.startsWith("COMPLAINT_")) || typeof answers.COMPLAINT_AREA === "string") {
      return evaluateComplaintTriage(answers);
    }
    return evaluateGeneralSymptomsTriage(generalSymptomCodes);
  }
  if (syndromeIds.length === 1) {
    return evaluateClinicalTriage(syndromeIds[0], answers);
  }

  const outcomes = syndromeIds.map((id) => evaluateClinicalTriage(id, answers));

  // Pick the most severe outcome; in case of tie, keep the one requiring referral
  return outcomes.reduce((worst, current) => {
    const cRank = SEVERITY_RANK[current.severity];
    const wRank = SEVERITY_RANK[worst.severity];
    if (cRank > wRank) return current;
    if (cRank === wRank && current.referralRequired && !worst.referralRequired) return current;
    return worst;
  });
}


export function evaluateClinicalTriage(
  syndromeCodeOrId: string,
  answers: Record<string, unknown> = {}
): ClinicalTriageOutcome {
  const code = (syndromeCodeOrId || "").toUpperCase();
  const yesAnswers = Object.keys(answers).filter((k) => isAffirmative(answers[k]));
  const yesCount = yesAnswers.length;

  // Step 3 look-check signs are explicit acute observations. They trigger an
  // immediate referral before classification and must never be downgraded by
  // later answers. Keep the wording non-diagnostic: the clinic classifies it.
  if (code.startsWith("LOOK_CHECK_")) {
    let conditionCode = "ACUTE_LOOK_CHECK_DANGER_SIGN";
    let conditionLabelEn = "Acute danger sign — immediate referral";
    let ipcGuidanceEn: string | null = null;

    if (code.includes("JAUNDICE")) {
      conditionCode = answerEquals(answers, "E1", "yes") ? "YELLOW_FEVER_EMERGENCY_PATTERN" : "JAUNDICE_UNCLASSIFIED";
      conditionLabelEn = answerEquals(answers, "E1", "yes")
        ? answerEquals(answers, "E3", "yes")
          ? "Signs consistent with yellow fever, with a severe warning sign"
          : "Signs consistent with yellow fever"
        : "Jaundice danger sign requiring immediate assessment";
      ipcGuidanceEn = "Wear gloves now. Do not give an injection. Do not touch blood or vomit with bare hands.";
    } else if (code.includes("BLEEDING")) {
      const lassaPattern = answerEquals(answers, "E5", "yes") && ["E6", "E7", "E8"].some((key) => answerEquals(answers, key, "yes"));
      conditionCode = lassaPattern ? "LASSA_VHF_EMERGENCY_PATTERN" : "BLEEDING_UNCLASSIFIED";
      conditionLabelEn = lassaPattern
        ? "Signs consistent with Lassa fever or another viral haemorrhagic fever"
        : "Bleeding danger sign requiring immediate assessment";
      ipcGuidanceEn = "Wear gloves now. Do not give an injection. Do not touch blood, vomit or urine with bare hands.";
    } else if (code.includes("FIT") || code.includes("CONFUSION")) {
      const meningitis = answerEquals(answers, "E11", "yes") ||
        (answerEquals(answers, "E9", "yes") && (answerEquals(answers, "E10", "yes") || answerEquals(answers, "E12", "yes")));
      conditionCode = meningitis ? "MENINGITIS_EMERGENCY_PATTERN" : "SEVERE_NEUROLOGIC_DANGER_SIGN";
      conditionLabelEn = meningitis
        ? answerEquals(answers, "E11", "yes")
          ? "Signs consistent with meningitis, with septicaemia warning signs"
          : "Signs consistent with meningitis"
        : "Fit or reduced consciousness requiring immediate assessment";
    } else if (code.includes("COLLAPSE")) {
      const cholera = answerEquals(answers, "E13", "yes") && answerEquals(answers, "E14", "yes");
      conditionCode = cholera ? "CHOLERA_SEVERE_EMERGENCY_PATTERN" : answerEquals(answers, "E13", "yes") ? "SEVERE_DEHYDRATION" : "COLLAPSE_DANGER_SIGN";
      conditionLabelEn = cholera
        ? "Signs consistent with cholera, with severe dehydration"
        : answerEquals(answers, "E13", "yes")
          ? "Severe dehydration danger signs"
          : "Collapse or inability to drink requiring immediate assessment";
      if (answerEquals(answers, "E13", "yes")) {
        ipcGuidanceEn = "Wash your hands with soap. Put stool and vomit in the latrine and clean contaminated surfaces with bleach.";
      }
    } else if (code.includes("BREATHING")) {
      const measles = answerEquals(answers, "E17", "yes") && answerEquals(answers, "E18", "yes");
      const diphtheria = answerEquals(answers, "E20", "yes");
      const tb = answerEquals(answers, "E19", "yes");
      conditionCode = measles ? "MEASLES_COMPLICATION_EMERGENCY_PATTERN" : diphtheria ? "DIPHTHERIA_EMERGENCY_PATTERN" : tb ? "TB_EMERGENCY_SCREENING_PATTERN" : "BREATHING_DANGER_SIGN";
      conditionLabelEn = measles
        ? "Signs consistent with measles with a breathing complication"
        : diphtheria
          ? "Signs consistent with diphtheria"
          : tb
            ? "Signs meeting TB screening criteria, with an acute breathing danger sign"
            : "Breathing danger sign requiring immediate assessment";
      ipcGuidanceEn = "Keep some distance, use a mask if available, encourage cough covering, and ventilate the room.";
    } else if (code.includes("NEWBORN")) {
      const tetanus = answerEquals(answers, "E22", "yes");
      conditionCode = tetanus ? "NEONATAL_TETANUS_EMERGENCY_PATTERN" : "NEWBORN_SEPSIS_PATTERN";
      conditionLabelEn = tetanus ? "Signs consistent with neonatal tetanus" : "Newborn danger signs requiring immediate assessment";
    } else if (code.includes("UNWELL")) {
      const complaint = evaluateComplaintTriage(answers);
      if (complaint.referralRequired) {
        conditionCode = complaint.conditionCode;
        conditionLabelEn = complaint.conditionLabelEn;
        ipcGuidanceEn = complaint.ipcGuidanceEn;
      } else {
        conditionCode = "ACUTE_UNCLASSIFIED_VENDOR_JUDGEMENT";
        conditionLabelEn = "Signs that need an immediate clinic check";
        ipcGuidanceEn = "Use standard precautions, keep some distance, ventilate the room, and avoid contact with body fluids.";
      }
    }

    return {
      severity: "emergency",
      referralRequired: true,
      conditionCode,
      conditionLabelEn,
      conditionLabelHa: "[Hausa pending]",
      guidanceEn:
        "A visible or caregiver-reported danger sign was recorded. Keep transport moving and refer to the clinic immediately. The app does not diagnose the patient.",
      guidanceHa: "[Hausa pending]",
      ipcGuidanceEn,
      ipcGuidanceHa: ipcGuidanceEn ? "[Hausa pending]" : null,
    };
  }

  if (code === "OTHER_PRIORITY" && isAffirmative(answers.LOOK_CHECK_UNKNOWN)) {
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "CAREGIVER_REPORTED_UNCERTAINTY",
      conditionLabelEn: "Signs that need a clinic check",
      conditionLabelHa: "[Hausa pending]",
      guidanceEn: "The patient was not present and at least one danger-sign answer was unknown. Bring the patient here or go to a clinic today. This is not a diagnosis.",
      guidanceHa: "[Hausa pending]",
      ipcGuidanceEn: "Use gloves if available, avoid injections, keep some distance, ventilate the room, and wash hands carefully.",
      ipcGuidanceHa: "[Hausa pending]",
    };
  }

  // 1. Acute Watery Diarrhoea (AWD)
  if (code.includes("DIARRHOEA") || code.includes("AWD")) {
    const isDehydrated = isAffirmative(answers.AWD_DEHYDRATION);
    const hasManyEpisodes = isAffirmative(answers.AWD_EPISODES);

    // Severe rating OR both dehydration + many episodes → emergency (suspected Cholera)
    if ((isDehydrated && hasManyEpisodes) || isRatedSevere(answers)) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "AWD_CHOLERA_SEVERE",
        conditionLabelEn: "Suspected Cholera (Severe Dehydration)",
        conditionLabelHa: "Zaton Kwalara (Tsananin Rashin Ruwa)",
        guidanceEn:
          "Severe dehydration danger signs present. Immediate isolation required. Begin oral rehydration therapy (ORS) or IV fluids immediately. Refer immediately to nearest Cholera Treatment Centre.",
        guidanceHa:
          "Alamomin rashin ruwa mai tsanani sun bayyana. Ana bukatar killace majiyyaci nan take. Fara ba da ruwan gishiri da sukari (ORS) nan da nan. A tura zuwa cibiyar kula da kwalara mafi kusa ba tare da bata lokaci ba.",
        ipcGuidanceEn:
          "Use strict PPE (gloves, waterproof apron/gown, mask). Disinfect all vomitus and stool spillages with 0.5% chlorine solution. Restrict visitors.",
        ipcGuidanceHa:
          "Sanya safar hannu, rigar kariya, da takunkumi. A wanke duk wani abu da majiyyaci ya bata da ruwan chlorine na 0.5%.",
      };
    }

    if (isDehydrated || hasManyEpisodes || hasSevereSeverity(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "AWD_DEHYDRATION_MODERATE",
        conditionLabelEn: "Acute Watery Diarrhoea (Some Dehydration)",
        conditionLabelHa: "Gudawa Mai Ruwa (Matsakaicin Rashin Ruwa)",
        guidanceEn:
          "Administer Oral Rehydration Salts (ORS) and Zinc dispersible tablets. Closely monitor dehydration signs. Refer to health facility if vomiting or weakness worsens.",
        guidanceHa:
          "A ba da ruwan ORS da kwayar zinc. A kula da ruwan jiki sosai. A tura asibiti idan amai ko rauni ya karu.",
        ipcGuidanceEn: "Practice strict hand hygiene with soap and running water before and after patient contact.",
        ipcGuidanceHa: "A wanke hannaye da sabulu da ruwa mai gudu kafin da bayan taba majiyyaci.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "MILD_DIARRHOEA",
      conditionLabelEn: "Mild Acute Diarrhoea",
      conditionLabelHa: "Gudawa Mara Tsanani",
      guidanceEn:
        "Home management with Oral Rehydration Solution (ORS) and zinc tablets for 10-14 days. Continue normal feeding and fluid intake. Counsel caregiver to return if danger signs emerge.",
      guidanceHa:
        "Kula da gida tare da ruwan gishiri da sukari (ORS) da kwayoyin zinc na tsawon kwanaki 10-14. Ci gaba da ba da abinci da ruwa. A gargadi mai kula idan cutar ta karu.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 2. Fever with Bleeding
  if (code.includes("BLEEDING")) {
    const hasBleeding =
      isAffirmative(answers.FB_SPONTANEOUS_BLEEDING) ||
      isAffirmative(answers.FB_BLACK_STOOL) ||
      isAffirmative(answers.FB_CONTACT_HISTORY);

    // Any confirmed bleeding sign or severe rating → always emergency (VHF)
    if (hasBleeding || yesCount >= 1 || isRatedSevere(answers)) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "SUSPECTED_VHF",
        conditionLabelEn: "Suspected Viral Haemorrhagic Fever (Lassa / VHF)",
        conditionLabelHa: "Zaton Cutar Zazzabin Zubar Jini (Lassa)",
        guidanceEn:
          "HIGH PRIORITY EMERGENCY: Immediate strict isolation in designated holding area. Avoid contact with body fluids. Do NOT give aspirin or NSAIDs. Call national/state surveillance desk and arrange emergency referral transport.",
        guidanceHa:
          "GAGGawa MAI MUHIMMANCI: A killace majiyyaci nan take. Guji taba ruwan jiki. Kada a ba da aspirin ko ibuprofen. A kira jami'an kula da annoba a shirya motar asibiti nan take.",
        ipcGuidanceEn:
          "FULL PPE REQUIRED: Double gloves, fluid-resistant gown, eye protection/face shield, surgical mask, and boot covers. Safe disposal of sharps. 0.5% chlorine disinfection for contaminated surfaces.",
        ipcGuidanceHa:
          "KARIYA MAI CIKAKKE: Safar hannu biyu, rigar kariya, tabarau/kariya ta fuska, takunkumi, da takalman kariya. Wanke wuraren da aka bata da ruwan chlorine 0.5%.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "UNCOMPLICATED_FEVER",
      conditionLabelEn: "Uncomplicated Febrile Illness",
      conditionLabelHa: "Zazzabi Mara Tsanani",
      guidanceEn:
        "Evaluate for uncomplicated malaria via rapid diagnostic test (RDT). Treat with ACT if positive. Advise on bed net use and return if bleeding develops.",
      guidanceHa: "A duba zazzabin cizon sauro da RDT. A ba da ACT idan yana da shi. A kwana a karkashin gidan sauro.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 3. Fever with Neck Stiffness
  if (code.includes("NECK") || code.includes("STIFFNESS") || code.includes("MENINGITIS")) {
    const hasMeningitisSigns =
      isAffirmative(answers.FNS_NECK_RIGIDITY) ||
      isAffirmative(answers.FNS_ALTERED_CONSCIOUSNESS) ||
      isAffirmative(answers.FNS_PHOTOPHOBIA);

    // Altered consciousness alone or severe rating or multiple positive signs → emergency escalation
    if (
      isAffirmative(answers.FNS_ALTERED_CONSCIOUSNESS) ||
      isRatedSevere(answers) ||
      (hasMeningitisSigns && yesCount >= 2)
    ) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "SUSPECTED_MENINGITIS",
        conditionLabelEn: "Suspected Acute Bacterial Meningitis",
        conditionLabelHa: "Zaton Cutar Sankarau",
        guidanceEn:
          "MEDICAL EMERGENCY: Signs of acute central nervous system infection. Administer first dose of pre-referral intramuscular ceftriaxone if certified. Refer immediately to secondary health facility.",
        guidanceHa:
          "GAGGAWA: Alamomin cutar sankarau. A ba da allurar farko ta ceftriaxone idan an sami izini. A tura asibiti nan da nan.",
        ipcGuidanceEn:
          "Droplet precautions: wear surgical mask when within 1 meter of patient. Ensure well-ventilated examination room.",
        ipcGuidanceHa: "Kariyar numfashi: Sanya takunkumi yayin da kake kusa da majiyyaci. Bude tagogi don samun iska.",
      };
    }

    // Under IDSR case definition, acute neck stiffness IS the cardinal danger sign for suspected meningitis.
    // It must ALWAYS trigger referral for lumbar puncture and cerebrospinal fluid analysis.
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "SUSPECTED_MENINGITIS",
      conditionLabelEn: "Suspected Acute Bacterial Meningitis",
      conditionLabelHa: "Zaton Cutar Sankarau",
      guidanceEn:
        "Suspected Acute Bacterial Meningitis: Neck stiffness detected. Urgent referral to secondary health facility for lumbar puncture and antibiotic therapy. Isolate with droplet precautions.",
      guidanceHa:
        "Zaton cutar sankarau: An gano wuya ta kafe. A tura asibiti cikin gaggawa domin gwajin ruwan kashin baya da maganin rigakafi. A sanya takunkumi.",
      ipcGuidanceEn:
        "Droplet precautions: wear surgical mask when within 1 meter of patient. Ensure well-ventilated examination room.",
      ipcGuidanceHa: "Kariyar numfashi: Sanya takunkumi yayin da kake kusa da majiyyaci. Bude tagogi don samun iska.",
    };
  }

  // 4. Neonatal Danger Signs
  if (code.includes("NEONATAL") || code.includes("NEWBORN") || code.includes("NDS")) {
    const isCritical =
      isAffirmative(answers.NDS_FEEDING_DIFFICULTY) ||
      isAffirmative(answers.NDS_CONVULSIONS) ||
      isAffirmative(answers.NDS_HYPOTHERMIA_FEVER);
    const hasInfection = isAffirmative(answers.NDS_UMBILICAL_INFECTION);

    // Convulsions or severe severity → always emergency
    if (isAffirmative(answers.NDS_CONVULSIONS) || isRatedSevere(answers) || (isCritical && yesCount >= 2)) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "NEONATAL_SEPSIS_CRITICAL",
        conditionLabelEn: "Severe Neonatal Danger Signs / Sepsis",
        conditionLabelHa: "Alamomin Hatsari Ga Jariri / Sepsis",
        guidanceEn:
          "CRITICAL NEWBORN DANGER: Keep baby warm (skin-to-skin / kangaroo mother care). Do NOT allow infant to become cold. Expedite emergency referral transport to special baby care unit.",
        guidanceHa:
          "HATSARI GA JARIRI: Rike jariri da dumi a kirji (Kangaroo care). Kada a bar shi ya yi sanyi. A tura zuwa asibiti cikin gaggawa.",
        ipcGuidanceEn: "Strict neonatal hygiene: wash hands before touching infant. Use clean blankets.",
        ipcGuidanceHa: "Tsabtar jarirai: Wanke hannu sosai kafin taba jariri. Yi amfani da kyallen da ke da tsabta.",
      };
    }

    if (isCritical || hasInfection || hasSevereSeverity(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "NEONATAL_INFECTION_MODERATE",
        conditionLabelEn: "Local Umbilical / Neonatal Infection",
        conditionLabelHa: "Ciwon Cibiya / Cutar Jarirai",
        guidanceEn:
          "Apply 7.1% chlorhexidine digluconate to cord stump if available. Refer to health facility for neonatal evaluation.",
        guidanceHa: "A shafa maganin chlorhexidine a cibiya. A kai jariri asibiti domin duba lafiyarsa.",
        ipcGuidanceEn: "Clean hands with soap and water before umbilical care.",
        ipcGuidanceHa: "Wanke hannu da sabulu da ruwa kafin kula da cibiya.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "NEONATE_STABLE",
      conditionLabelEn: "Stable Newborn Care",
      conditionLabelHa: "Kula da Jariri Mai Lafiya",
      guidanceEn: "Encourage exclusive breastfeeding and warmth. Return immediately if unable to suckle or feels hot/cold.",
      guidanceHa: "Karfafa shayar da nono kawai da dumi. Dawo asibiti nan da nan idan ya kasa shan nono.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 5. Acute Respiratory Illness
  if (code.includes("RESPIRATORY") || code.includes("ARI")) {
    const isSevere = isAffirmative(answers.ARI_STRIDOR) || isAffirmative(answers.ARI_CHEST_INDRAWING);
    const isModerate = isAffirmative(answers.ARI_FAST_BREATHING);

    // Stridor, chest indrawing, or severe rating → emergency
    if (isSevere || isRatedSevere(answers) || yesCount >= 2) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "SEVERE_PNEUMONIA",
        conditionLabelEn: "Severe Pneumonia / Respiratory Distress",
        conditionLabelHa: "Cutar Numfashi Mai Tsanani",
        guidanceEn:
          "Signs of respiratory distress. Administer oxygen if available. Give pre-referral dose of ampicillin/gentamicin or amoxicillin. Refer immediately to secondary hospital.",
        guidanceHa:
          "Alamomin wahalar numfashi. A ba da iskar oxygen idan akwai. A ba da maganin rigakafi na farko. A tura asibiti nan take.",
        ipcGuidanceEn: "Respiratory hygiene and cough etiquette. Wear surgical mask during patient contact.",
        ipcGuidanceHa: "Kariyar numfashi: Sanya takunkumi yayin kula da majiyyaci.",
      };
    }

    if (isModerate || hasSevereSeverity(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "PNEUMONIA_MODERATE",
        conditionLabelEn: "Acute Pneumonia (Fast Breathing)",
        conditionLabelHa: "Ciwon Nimoniya (Numfashi da Sauri)",
        guidanceEn:
          "Fast breathing for age. Prescribe oral Amoxicillin dispersible tablets as per IMCI guidelines. Refer to health facility for chest examination.",
        guidanceHa: "Numfashi da sauri fiye da kima. A ba da kwayar amoxicillin kamar yadda ka'ida ta tanada. A tura asibiti.",
        ipcGuidanceEn: null,
        ipcGuidanceHa: null,
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "UPPER_RESPIRATORY_INFECTION",
      conditionLabelEn: "Mild Upper Respiratory Tract Infection",
      conditionLabelHa: "Murfi / Majina Mara Tsanani",
      guidanceEn: "Soothe throat with warm fluids. Continue feeding. Return immediately if breathing becomes fast or difficult.",
      guidanceHa: "A ba da ruwan dumi. Ci gaba da abinci. Dawo asibiti idan numfashi ya yi wuya.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 6. Cough > 2 weeks
  if (code.includes("COUGH")) {
    const hasHemoptysis = isAffirmative(answers.COUGH_HEMOPTYSIS);
    const hasWeightLoss = isAffirmative(answers.COUGH_WEIGHT_LOSS);

    // Hemoptysis, weight loss, or severe severity → TB referral
    if (hasHemoptysis || hasWeightLoss || isRatedSevere(answers) || yesCount >= 2) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "SUSPECTED_TB",
        conditionLabelEn: "Presumptive Pulmonary Tuberculosis",
        conditionLabelHa: "Zaton Ciwon Tarin Fuka (TB)",
        guidanceEn:
          "Persistent cough with constitutional signs. Collect two sputum specimens for GeneXpert MTB/RIF testing. Refer to designated DOTS clinic.",
        guidanceHa:
          "Tari mai tsawo tare da ramewa ko tofar da jini. A debi majina domin gwajin GeneXpert. A tura zuwa asibitin kula da tarin fuka (DOTS).",
        ipcGuidanceEn:
          "Airborne precautions: patient must wear surgical mask. Ensure open cross-ventilation in consultation room.",
        ipcGuidanceHa: "Kariyar iska: Majiyyaci ya sanya takunkumi. A bude tagogi don samun iska.",
      };
    }

    if (hasSevereSeverity(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "PROTRACTED_COUGH",
        conditionLabelEn: "Protracted Cough Evaluation",
        conditionLabelHa: "Binciken Tari Mai Tsawo",
        guidanceEn: "Cough lasting over two weeks requires clinical chest evaluation and sputum examination.",
        guidanceHa: "Tari da ya wuce makonni biyu yana bukatar binciken asibiti.",
        ipcGuidanceEn: "Encourage cough etiquette and mask wearing.",
        ipcGuidanceHa: "Karfafa rufe baki yayin tari da sanya takunkumi.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "RESOLVING_COUGH",
      conditionLabelEn: "Resolving Cough",
      conditionLabelHa: "Tari Mai Sauki",
      guidanceEn: "Continue supportive care. Counsel caregiver on signs of tuberculosis.",
      guidanceHa: "Ci gaba da kula a gida. A duba idan cutar ba ta warke ba.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 7. Acute Flaccid Paralysis
  if (code.includes("PARALYSIS") || code.includes("AFP") || code.includes("FLACCID")) {
    const hasParalysis = isAffirmative(answers.AFP_SUDDEN_WEAKNESS) || isAffirmative(answers.AFP_PROGRESSION);

    if (hasParalysis || isRatedSevere(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "SUSPECTED_AFP",
        conditionLabelEn: "Suspected Acute Flaccid Paralysis (Polio Surveillance)",
        conditionLabelHa: "Zaton Cutar Shan Inna (Polio)",
        guidanceEn:
          "MANDATORY SURVEILLANCE EVENT: Collect two stool specimens 24-48 hours apart within 14 days of paralysis onset. Maintain reverse cold chain. Refer to secondary hospital for neurological assessment.",
        guidanceHa:
          "SANARWA GA HUKUMA: A debi kashi sau biyu a cikin kwanaki 14 da fara ciwo. A ajiye a cikin sanyi. A tura asibiti nan take.",
        ipcGuidanceEn: "Contact and enteric precautions: thorough hand hygiene after handling diapers or bedpans.",
        ipcGuidanceHa: "Wanke hannu da sabulu sosai bayan taba kashi ko fitsari.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "TRANSIENT_WEAKNESS",
      conditionLabelEn: "Transient Weakness",
      conditionLabelHa: "Rauni Na Dan Lokaci",
      guidanceEn: "Monitor limb mobility. Refer if weakness progresses or asymmetry is noted.",
      guidanceHa: "Kula da motsin gaba. A koma asibiti idan rauni ya karu.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 8. Jaundice
  if (code.includes("JAUNDICE")) {
    const hasYellowEyes = isAffirmative(answers.JAUNDICE_YELLOW_EYES);
    const hasDarkUrineOrPaleStool =
      isAffirmative(answers.JAUNDICE_DARK_URINE) || isAffirmative(answers.JAUNDICE_PALE_STOOL);

    // All three positive signs or severe severity → escalate to emergency
    if (
      (hasYellowEyes && hasDarkUrineOrPaleStool) ||
      isRatedSevere(answers) ||
      yesCount >= 3
    ) {
      return {
        severity: "emergency",
        referralRequired: true,
        conditionCode: "ACUTE_JAUNDICE_SEVERE",
        conditionLabelEn: "Acute Jaundice Syndrome — Severe (Suspected Hepatic Failure)",
        conditionLabelHa: "Zazzabin Shawara Mai Tsanani Sosai",
        guidanceEn:
          "Multiple jaundice danger signs detected. Avoid all hepatotoxic medications. Refer urgently to secondary facility for liver function tests and viral hepatitis markers.",
        guidanceHa:
          "Alamomin shawara masu tsanani da yawa. Guji duk magungunan da ke cutarwa ga hanta. A tura asibiti nan take domin gwajin hanta.",
        ipcGuidanceEn: "Enteric hygiene precautions. Clean sanitary facilities with chlorine.",
        ipcGuidanceHa: "Kula da tsabtar bayan gida da wanke hannu da sabulu.",
      };
    }

    if (hasYellowEyes || hasDarkUrineOrPaleStool || hasSevereSeverity(answers) || yesCount >= 1) {
      return {
        severity: "urgent",
        referralRequired: true,
        conditionCode: "ACUTE_JAUNDICE_SYNDROME",
        conditionLabelEn: "Acute Jaundice Syndrome (Suspected Hepatitis)",
        conditionLabelHa: "Zazzabin Shawara Mai Tsanani",
        guidanceEn:
          "Acute onset of jaundice. Avoid hepatotoxic medications (including paracetamol overuse). Refer for liver function tests and viral hepatitis markers.",
        guidanceHa:
          "Kwayar ido ta yi rawaya kwatsam. Guji magunguna masu cutar da hanta. A tura asibiti don gwajin hanta da ciwon shawara.",
        ipcGuidanceEn: "Enteric hygiene precautions. Clean sanitary facilities with chlorine.",
        ipcGuidanceHa: "Kula da tsabtar bayan gida da wanke hannu da sabulu.",
      };
    }

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "MILD_JAUNDICE_OBSERVATION",
      conditionLabelEn: "Mild Jaundice Observation",
      conditionLabelHa: "Kula da Shawara Mara Tsanani",
      guidanceEn: "Hydrate adequately. Refer if yellowing of eyes deepens or abdominal swelling occurs.",
      guidanceHa: "Sha ruwa sosai. A tura asibiti idan idanu suka kara rawaya ko ciki ya kumbura.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 9. Other Priority / Unusual Symptoms (IDSR Category 4)
  if (
    code === "OTHER_PRIORITY" ||
    code === "CATEGORY_4" ||
    code.startsWith("UNUSUAL") ||
    code.includes("UNUSUAL") ||
    code === "IDSR_CATEGORY_4"
  ) {
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "IDSR_CATEGORY_4_UNUSUAL",
      conditionLabelEn: "IDSR Category 4: Unusual Health Event / Priority Surveillance",
      conditionLabelHa: "IDSR Rukuni na 4: Alamomin da ba a saba gani ba",
      guidanceEn:
        "Unusual symptom presentation or potential public health event detected. Document observations, notify local surveillance officer, and refer patient for secondary diagnostic evaluation.",
      guidanceHa:
        "An gano alamomin cuta da ba a saba gani ba. A rubuta bayanan, a sanar da jami'in sa ido kan cututtuka, kuma a tura majiyyaci asibiti domin bincike.",
      ipcGuidanceEn: "Maintain strict infection prevention and control (IPC) precautions until etiology is determined.",
      ipcGuidanceHa: "Kiyaye matakan kariya daga yaduwar cuta har sai an tabbatar da asalin ciwon.",
    };
  }


  // General rule: If PPMV rates any symptom as severe → always refer
  if (isRatedSevere(answers)) {
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "SEVERITY_ESCALATION",
      conditionLabelEn: "Symptom Severity Escalation",
      conditionLabelHa: "Tsananin Alamomin Ya Karu",
      guidanceEn:
        "Severe symptom rating recorded. Refer patient to primary/secondary health facility for physician review.",
      guidanceHa: "An yi rikodin tsananin alamomin cuta. A tura majiyyaci asibiti domin likita ya duba shi.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // General rule: If user answers 2 or more affirmative ("yes" and "yes"), it is dire and requires referral!
  if (yesCount >= 2) {
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "DIRE_MULTIPLE_SYMPTOMS",
      conditionLabelEn: "Priority Clinical Presentation",
      conditionLabelHa: "Ziyarar Asibiti Mai Muhimmanci",
      guidanceEn:
        "Multiple positive clinical danger indicators detected. Patient condition meets criteria for referral to secondary health facility for diagnostic evaluation.",
      guidanceHa:
        "An gano alamomin cuta masu yawa. Halin majiyyaci yana bukatar tura shi zuwa asibiti mafi girma domin cikakken bincike.",
      ipcGuidanceEn: "Maintain standard precautions and appropriate PPE during patient care.",
      ipcGuidanceHa: "Yi amfani da kariya da wanke hannaye yayin kula da majiyyaci.",
    };
  }

  if (yesCount === 1) {
    return {
      severity: "urgent",
      referralRequired: true,
      conditionCode: "CLINICAL_SYMPTOM_EVALUATION",
      conditionLabelEn: "Symptom Evaluation / Health Referral",
      conditionLabelHa: "Duba Alamomin Cuta / Tura Asibiti",
      guidanceEn:
        "Affirmative clinical indicator noted. Refer patient to primary/secondary health facility for physician review.",
      guidanceHa: "An gano alamar cuta. A tura majiyyaci asibiti domin likita ya duba shi.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // All "no"
  return {
    severity: "routine",
    referralRequired: false,
    conditionCode: "ROUTINE_CARE",
    conditionLabelEn: "Routine Care / Home Management",
    conditionLabelHa: "Kula ta Yau da Kullum a Gida",
    guidanceEn:
      "No danger signs identified. Continue supportive home care and normal feeding. Counsel caregiver on danger signs to return immediately if symptoms worsen.",
    guidanceHa:
      "Babu alamomin hatsari da aka gano. Ci gaba da kula a gida tare da ba da abinci. A gargadi mai kula idan cutar ta karu.",
    ipcGuidanceEn: null,
    ipcGuidanceHa: null,
  };
}
