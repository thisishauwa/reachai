import { describe, expect, it } from "vitest";
import {
  selectTriageOutcome,
  evaluateClinicalTriage,
  evaluateMultiSyndromeTriage,
  type TriageRuleLike,
} from "../triage";
import { getFollowUpQuestions } from "../../reference/syndrome-questions";

const emergencyCholera: TriageRuleLike = {
  id: "rule-emergency",
  severity: "emergency",
  priority: 10,
  condition_code: "SUSPECTED_CHOLERA_DEMO",
  referral_required: true,
  conditions: [
    { question_code: "IS_DEHYDRATED", op: "is_true" },
    { question_code: "MANY_EPISODES", op: "is_true" },
  ],
};

const routineDiarrhoea: TriageRuleLike = {
  id: "rule-routine",
  severity: "routine",
  priority: 0,
  condition_code: "MILD_DIARRHOEA_DEMO",
  referral_required: false,
  conditions: [{ question_code: "MANY_EPISODES", op: "answered" }],
};

describe("selectTriageOutcome", () => {
  it("returns null when no rule matches", () => {
    expect(selectTriageOutcome([emergencyCholera, routineDiarrhoea], {})).toBeNull();
  });

  it("prefers a higher-severity match even if a lower-priority rule also matches", () => {
    const inputs = { IS_DEHYDRATED: true, MANY_EPISODES: true };
    const outcome = selectTriageOutcome([routineDiarrhoea, emergencyCholera], inputs);
    expect(outcome?.id).toBe("rule-emergency");
  });

  it("falls back to a routine match when the emergency condition is not met", () => {
    const inputs = { MANY_EPISODES: true };
    const outcome = selectTriageOutcome([emergencyCholera, routineDiarrhoea], inputs);
    expect(outcome?.id).toBe("rule-routine");
  });

  it("orders same-severity rules by priority descending", () => {
    const low: TriageRuleLike = { ...routineDiarrhoea, id: "low", priority: 0 };
    const high: TriageRuleLike = { ...routineDiarrhoea, id: "high", priority: 5 };
    const outcome = selectTriageOutcome([low, high], { MANY_EPISODES: true });
    expect(outcome?.id).toBe("high");
  });
});

describe("evaluateClinicalTriage", () => {
  it("never downgrades an explicit Step 3 look-check danger sign", () => {
    const outcome = evaluateClinicalTriage("LOOK_CHECK_UNWELL", {
      E25: "no",
      E26: "no",
      E27: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionLabelEn).not.toContain("Suspected");
  });

  it("matches Journey 1: L5 plus E1 classifies the already-referred case as a yellow-fever pattern", () => {
    const outcome = evaluateClinicalTriage("LOOK_CHECK_JAUNDICE", {
      E1: "yes",
      E2: "yes",
      E3: "no",
      E4: "unknown",
    });
    expect(outcome.severity).toBe("emergency");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toBe("YELLOW_FEVER_EMERGENCY_PATTERN");
  });

  it("matches Journey 2: L3 with E5, E6 and E7 classifies the already-referred case as a Lassa/VHF pattern", () => {
    const outcome = evaluateClinicalTriage("LOOK_CHECK_BLEEDING", {
      E5: "yes",
      E6: "yes",
      E7: "yes",
      E8: "unknown",
    });
    expect(outcome.severity).toBe("emergency");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toBe("LASSA_VHF_EMERGENCY_PATTERN");
  });

  it("triggers emergency referral when AWD symptoms are yes and yes (dire dehydration)", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_EPISODES: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionCode).toBe("AWD_CHOLERA_SEVERE");
    expect(outcome.ipcGuidanceEn).not.toBeNull();
  });

  it("triggers urgent referral when at least one AWD symptom is yes", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("does NOT trigger referral when all symptoms are no (routine)", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "no",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.severity).toBe("routine");
  });

  it("triggers emergency referral for fever with spontaneous bleeding", () => {
    const outcome = evaluateClinicalTriage("FEVER_BLEEDING", {
      FB_SPONTANEOUS_BLEEDING: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.ipcGuidanceEn).toContain("FULL PPE REQUIRED");
  });

  it("triggers urgent referral when two generic affirmative answers are present", () => {
    const outcome = evaluateClinicalTriage("OTHER_PRIORITY", {
      OP_DURATION: "yes",
      OP_SEVERE_PAIN: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("matches Journey 6: caregiver uncertainty is Urgent and unclassified", () => {
    const outcome = evaluateClinicalTriage("OTHER_PRIORITY", {
      LOOK_CHECK_UNKNOWN: "yes",
      CAREGIVER_REPORTED: true,
      FEVER_DURATION: "3_6_days",
      NECK_FLEXION: "unknown",
    });
    expect(outcome.severity).toBe("urgent");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toBe("CAREGIVER_REPORTED_UNCERTAINTY");
  });

  it("escalates to emergency when symptom severity is rated severe", () => {
    const outcome = evaluateClinicalTriage("ACUTE_WATERY_DIARRHOEA", {
      AWD_DEHYDRATION: "yes",
      AWD_DEHYDRATION_severity: "severe",
      AWD_EPISODES: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
  });

  it("escalates to urgent referral when symptom severity is rated moderate", () => {
    const outcome = evaluateClinicalTriage("ACUTE_RESPIRATORY", {
      ARI_FAST_BREATHING: "yes",
      ARI_FAST_BREATHING_severity: "moderate",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
  });

  it("diagnoses Suspected Acute Bacterial Meningitis when neck stiffness syndrome is selected even with no extra sub-symptoms", () => {
    const outcome = evaluateClinicalTriage("FEVER_NECK_STIFFNESS", {
      FNS_NECK_RIGIDITY: "no",
      FNS_ALTERED_CONSCIOUSNESS: "no",
      FNS_PHOTOPHOBIA: "no",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("urgent");
    expect(outcome.conditionCode).toBe("SUSPECTED_MENINGITIS");
    expect(outcome.conditionLabelEn).toBe("Suspected Acute Bacterial Meningitis");
  });

  it("escalates to emergency meningitis when altered consciousness or severe rating is present", () => {
    const outcome = evaluateClinicalTriage("FEVER_NECK_STIFFNESS", {
      FNS_NECK_RIGIDITY: "yes",
      FNS_ALTERED_CONSCIOUSNESS: "yes",
    });
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionCode).toBe("SUSPECTED_MENINGITIS");
  });
});

describe("evaluateMultiSyndromeTriage", () => {
  it("selects the most severe outcome when multiple syndromes are selected", () => {
    // Syndrome 1: Routine AWD
    // Syndrome 2: Emergency Fever with bleeding
    const outcome = evaluateMultiSyndromeTriage(
      ["ACUTE_WATERY_DIARRHOEA", "FEVER_BLEEDING"],
      {
        AWD_DEHYDRATION: "no",
        AWD_EPISODES: "no",
        FB_SPONTANEOUS_BLEEDING: "yes",
      }
    );
    expect(outcome.severity).toBe("emergency");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toBe("SUSPECTED_VHF");
  });

  it("returns routine care with no referral when only normal symptoms (fever) are present", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, ["FEVER"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("UNCOMPLICATED_FEVER");
    expect(outcome.conditionLabelEn).toContain("Uncomplicated Febrile Illness");
  });

  it("returns routine care with no referral when normal cough is present", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, ["COUGH"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("MILD_COUGH_URI");
  });

  it("returns routine care when no danger signs and empty general symptoms are submitted", () => {
    const outcome = evaluateMultiSyndromeTriage([], {}, []);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
    expect(outcome.conditionCode).toBe("ROUTINE_CARE");
  });

  it("matches Journey 3: uncomplicated short fever is Routine and not referred", () => {
    const outcome = evaluateMultiSyndromeTriage([], {
      COMPLAINT_AREA: "A",
      FEVER_DURATION: "1_2_days",
      NECK_FLEXION: "yes_easily",
      RASH_PRESENT: "no",
      MALARIA_MEDICINE_NO_IMPROVEMENT: "no",
      LASSA_EXPOSURE: "no",
      YELLOW_FEVER_EXPOSURE: "no",
      DIARRHOEA_OR_VOMITING: "no",
      COUGH_PRESENT: "no",
    }, ["COMPLAINT_A"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(false);
  });

  it("matches Journeys 4 and 5: the same measles pattern is Urgent, then Acute in pregnancy", () => {
    const answers = {
      COMPLAINT_AREA: "C",
      FEVER_PRESENT: "yes",
      RASH_START_LOCATION: "face_or_behind_ears",
      MEASLES_EYE_COUGH_SIGNS: "yes",
      BLISTERS_SAME_STAGE: "no",
      RASH_CONTACT: "unknown",
      RASH_COMPLICATION_SIGNS: "no",
    };
    const urgent = evaluateMultiSyndromeTriage([], { ...answers, PREGNANCY_STATUS: "not_pregnant" }, ["COMPLAINT_C"]);
    const acute = evaluateMultiSyndromeTriage([], { ...answers, PREGNANCY_STATUS: "pregnant" }, ["COMPLAINT_C"]);
    expect(urgent.severity).toBe("urgent");
    expect(acute.severity).toBe("emergency");
    expect(urgent.referralRequired).toBe(true);
    expect(acute.referralRequired).toBe(true);
  });

  it("matches Journey 7: the fever-to-diarrhoea bridge produces an Urgent cholera referral", () => {
    const outcome = evaluateMultiSyndromeTriage([], {
      COMPLAINT_AREA: "A",
      FEVER_DURATION: "1_2_days",
      DIARRHOEA_OR_VOMITING: "yes",
      WATERY_STOOL_COUNT: "6_10",
      BLOOD_OR_MUCUS_STOOL: "no",
      RICE_WATER_STOOL: "yes",
      DEHYDRATION_SIGNS: ["very_thirsty"],
    }, ["COMPLAINT_A"]);
    expect(outcome.severity).toBe("urgent");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toContain("CHOLERA_PATTERN");
  });

  it("matches Journeys 8 and 12: a TB pattern stays Routine but still requires referral", () => {
    const outcome = evaluateMultiSyndromeTriage([], {
      COMPLAINT_AREA: "E",
      COUGH_DURATION: "2_plus_weeks",
      BLOOD_IN_SPUTUM: "no",
      WEIGHT_LOSS_OR_NIGHT_SWEATS: "yes",
      DIPHTHERIA_SIGNS: "no",
    }, ["COMPLAINT_E"]);
    expect(outcome.severity).toBe("routine");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toContain("TB_SCREENING_PATTERN");
  });

  it("matches Journey 9: sudden weak limb under 15 produces an Urgent AFP referral", () => {
    const outcome = evaluateMultiSyndromeTriage([], {
      COMPLAINT_AREA: "F",
      WEAK_LIMB: "yes",
      ANIMAL_BITE: "no",
      FEVER_PRESENT: "no",
    }, ["COMPLAINT_F"]);
    expect(outcome.severity).toBe("urgent");
    expect(outcome.referralRequired).toBe(true);
    expect(outcome.conditionCode).toContain("AFP_PATTERN");
  });

  it("matches Journey 10: severe cholera outranks typhoid while retaining both category tags", () => {
    const outcome = evaluateMultiSyndromeTriage([], {
      COMPLAINT_AREA: "A",
      FEVER_DURATION: "3_6_days",
      DIARRHOEA_OR_VOMITING: "yes",
      WATERY_STOOL_COUNT: "6_10",
      BLOOD_OR_MUCUS_STOOL: "no",
      RICE_WATER_STOOL: "yes",
      DEHYDRATION_SIGNS: ["sunken_eyes", "very_thirsty"],
    }, ["COMPLAINT_A"]);
    expect(outcome.severity).toBe("emergency");
    expect(outcome.conditionCode).toContain("CHOLERA_PATTERN");
    expect(outcome.conditionCode).toContain("TYPHOID_PATTERN");
  });
});

describe("getFollowUpQuestions (Hardcoded Symptom Questions)", () => {
  it("returns exact VHF questions for BLEEDING", () => {
    const questions = getFollowUpQuestions("BLEEDING");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "FB_SPONTANEOUS_BLEEDING")).toBe(true);
  });

  it("returns exact Meningitis questions for NECK_STIFFNESS", () => {
    const questions = getFollowUpQuestions("NECK_STIFFNESS");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "FNS_NECK_RIGIDITY")).toBe(true);
  });

  it("returns exact AWD questions for DIARRHEA", () => {
    const questions = getFollowUpQuestions("DIARRHEA");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((q) => q.code === "AWD_DEHYDRATION")).toBe(true);
  });

  it("returns EMPTY array for normal symptoms like FEVER (never defaults to AWD or bleeding)", () => {
    const questions = getFollowUpQuestions("FEVER");
    expect(questions).toEqual([]);
  });

  it("returns EMPTY array for empty string", () => {
    const questions = getFollowUpQuestions("");
    expect(questions).toEqual([]);
  });
});
