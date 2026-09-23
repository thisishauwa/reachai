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
  return false;
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
export function evaluateMultiSyndromeTriage(
  syndromeIds: string[],
  answers: Record<string, unknown> = {}
): ClinicalTriageOutcome {
  if (syndromeIds.length === 0) {
    return evaluateClinicalTriage("OTHER", answers);
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

  // 1. Acute Watery Diarrhoea (AWD)
  if (code.includes("DIARRHOEA") || code.includes("AWD")) {
    const isDehydrated = isAffirmative(answers.AWD_DEHYDRATION);
    const hasManyEpisodes = isAffirmative(answers.AWD_EPISODES);

    // Dire situation: Both "yes" and "yes" -> Suspected Cholera with Severe Dehydration
    if (isDehydrated && hasManyEpisodes) {
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

    if (isDehydrated || hasManyEpisodes || yesCount >= 1) {
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

    if (hasBleeding || yesCount >= 1) {
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

    if (hasMeningitisSigns || yesCount >= 1) {
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

    return {
      severity: "routine",
      referralRequired: false,
      conditionCode: "FEBRILE_ILLNESS",
      conditionLabelEn: "Acute Febrile Illness",
      conditionLabelHa: "Zazzabi",
      guidanceEn:
        "Perform malaria RDT. Treat according to clinical protocol. Re-evaluate if headache or neck pain worsens.",
      guidanceHa: "A duba zazzabin cizon sauro. A kula idan ciwon kai ko wuya ya karu.",
      ipcGuidanceEn: null,
      ipcGuidanceHa: null,
    };
  }

  // 4. Neonatal Danger Signs
  if (code.includes("NEONATAL") || code.includes("NEWBORN") || code.includes("NDS")) {
    const isCritical =
      isAffirmative(answers.NDS_FEEDING_DIFFICULTY) ||
      isAffirmative(answers.NDS_CONVULSIONS) ||
      isAffirmative(answers.NDS_HYPOTHERMIA_FEVER);
    const hasInfection = isAffirmative(answers.NDS_UMBILICAL_INFECTION);

    if (isCritical || yesCount >= 2) {
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

    if (hasInfection || yesCount >= 1) {
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

    if (isSevere || yesCount >= 2) {
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

    if (isModerate || yesCount >= 1) {
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

    if (hasHemoptysis || hasWeightLoss || yesCount >= 2) {
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

    if (yesCount >= 1) {
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

    if (hasParalysis || yesCount >= 1) {
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

    if (hasYellowEyes || hasDarkUrineOrPaleStool || yesCount >= 1) {
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
