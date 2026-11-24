import type { TriageSeverity } from "@/lib/supabase/database.types";

export interface CareGuidance {
  severityLabel: string;
  severityReason: string;
  give: string[];
  doNotGive: string[];
  ipc: string[];
  patientScript: string;
  plainReason: string;
  surveillanceNotice?: string;
}

/** Keeps the result language non-diagnostic while rendering multi-category matches separately. */
export function resultCategoryLabels(conditionLabel: string): string[] {
  const labels = conditionLabel
    .split(/;\s*also\s*/i)
    .map((label) => label.replace(/^signs consistent with\s+/i, "").trim())
    .filter(Boolean);

  if (labels.length === 0 || labels.every((label) => label === "No specific category identified")) {
    return ["a routine illness without a priority disease pattern"];
  }
  return labels;
}

export function protectHeadingFor(conditionCode: string): string {
  const code = conditionCode.toUpperCase();
  if (includesAny(code, ["CHOLERA", "DYSENTERY", "TYPHOID", "DEHYDRATION"])) {
    return "Protect everyone at home";
  }
  if (includesAny(code, ["TB", "MEASLES", "MPOX", "MENINGITIS", "DIPHTHERIA"])) {
    return "Protect others";
  }
  return "Protect yourself and others";
}

export function resultRecommendation(
  conditionCode: string,
  severity: TriageSeverity,
  referralRequired: boolean,
): string {
  if (!referralRequired) return "Routine care — return or go to a clinic if warning signs appear.";
  if (conditionCode.toUpperCase().includes("TB")) return "Refer for testing within the week.";
  if (severity === "emergency") return "Refer now — do not delay.";
  return "Refer today.";
}

function includesAny(code: string, values: string[]): boolean {
  return values.some((value) => code.includes(value));
}

export function careGuidanceFor(
  conditionCode: string,
  severity: TriageSeverity,
): CareGuidance {
  const code = conditionCode.toUpperCase();
  const severityLabel = severity === "emergency" ? "Acute - refer now" : "Urgent - refer today";
  const defaultGuidance: CareGuidance = {
    severityLabel,
    severityReason: severity === "emergency"
      ? "A danger sign means the patient needs an immediate clinic assessment."
      : "The recorded signs need a clinic assessment today.",
    give: ["Give only simple supportive care that does not delay transport."],
    doNotGive: ["Do not give an injection.", "Do not give antibiotics or an antimalarial in place of referral."],
    ipc: ["Wear gloves if you have them and avoid contact with body fluids.", "Stay an arm's length away, open the windows and wash your hands with soap."],
    plainReason: "These signs need a clinic check.",
    patientScript: "Medicine alone may not be enough. Go to the recommended clinic today, show this code and they will see the information recorded here.",
  };

  if (includesAny(code, ["CHOLERA", "DYSENTERY", "TYPHOID", "DEHYDRATION"])) {
    return {
      ...defaultGuidance,
      severityReason: severity === "emergency" ? "The patient is losing water too fast." : "The bowel symptoms need treatment at a clinic today.",
      give: ["Give ORS immediately in small, frequent sips.", "Give zinc for a child under 5 if it is within your registered scope."],
      doNotGive: ["Do not give loperamide or another anti-motility medicine.", "Do not give empirical antibiotics or an antiemetic in place of referral."],
      ipc: ["Wash your hands with soap after touching the patient.", "Put stool and vomit in the latrine, clean surfaces with bleach and do not share the patient's cup or plate."],
      plainReason: "The patient is losing water and needs clinical treatment.",
      patientScript: `Medicine alone will not be enough. ${severity === "emergency" ? "You are losing water too fast. Go to this clinic now" : "Go to this clinic today"}, show this code and they will see you quickly.`,
    };
  }

  if (code.includes("MENINGITIS") || code.includes("NEUROLOGIC")) {
    return {
      ...defaultGuidance,
      severityReason: "A stiff neck, fit or reduced consciousness can become dangerous quickly.",
      give: ["Paracetamol only, if appropriate for the patient's age and within scope."],
      doNotGive: ["Do not give oral antibiotics before referral.", "Do not give an injection or delay transport."],
      ipc: ["Stay an arm's length away when possible and wear a mask if available.", "Ask the patient to cover their mouth and open the windows and door."],
      plainReason: "These signs need an urgent examination at a clinic.",
      patientScript: "These signs can become serious quickly. Go to this clinic now, show this code and do not stop elsewhere for medicine.",
    };
  }

  if (includesAny(code, ["MEASLES", "MPOX"])) {
    return {
      ...defaultGuidance,
      severityReason: "Fever and rash signs need a clinic assessment and separation from vulnerable people.",
      give: ["Give paracetamol and fluids if appropriate."],
      doNotGive: ["Do not give routine antibiotics or steroids.", "Do not give aspirin to a child."],
      ipc: ["Keep the patient away from babies and pregnant women and open the windows and door.", "Do not share clothes or bedding."],
      plainReason: "The fever and rash need a clinic check.",
      patientScript: "The rash and fever need a clinic check. Go today, show this code, and keep away from babies and pregnant women on the way.",
    };
  }

  if (includesAny(code, ["LASSA", "VHF", "BLEEDING"])) {
    return {
      ...defaultGuidance,
      severityReason: "Bleeding or possible body-fluid exposure is an immediate danger sign.",
      give: ["Paracetamol only, if appropriate and the patient can take it safely."],
      doNotGive: ["Do not give aspirin, ibuprofen or another NSAID.", "Do not give an injection, ACT or any medicine in place of referral."],
      ipc: ["Wear gloves. Do not touch blood, vomit or urine with bare hands.", "Clean surfaces with bleach and wash your hands with soap before and after contact."],
      plainReason: "The bleeding signs need immediate assessment.",
      patientScript: "Do not wait for medicine here. Go to this clinic now, show this code and avoid contact with blood or vomit on the way.",
    };
  }

  if (includesAny(code, ["YELLOW_FEVER", "JAUNDICE"])) {
    return {
      ...defaultGuidance,
      severityReason: "Yellow eyes or skin can be a serious warning sign.",
      give: ["Paracetamol only, if appropriate and within scope."],
      doNotGive: ["Do not give aspirin, ibuprofen or another NSAID.", "Do not give an injection."],
      ipc: ["Wash your hands with soap and use standard precautions.", "Tell the patient to sleep under a mosquito net so others do not get sick."],
      plainReason: "The yellow eyes or skin need an urgent clinic check.",
      patientScript: "Yellow eyes or skin can be serious. Go to this clinic now, show this code and do not take aspirin or ibuprofen.",
    };
  }

  if (code.includes("TB")) {
    return {
      ...defaultGuidance,
      severityLabel: "Routine - refer for testing",
      severityReason: "The cough pattern needs a TB test within the week.",
      give: ["Give nothing for the suspected condition; explain that testing is the useful next step."],
      doNotGive: ["Do not give cough syrup or antibiotics that could delay testing."],
      ipc: ["Ask the patient to cover their mouth when coughing.", "Open the windows and the door."],
      plainReason: "The cough needs a test, not a diagnosis at the outlet.",
      patientScript: "This does not mean you have TB. Go to this clinic within the week for a test and show this code.",
    };
  }

  if (code.includes("DIPHTHERIA")) {
    return {
      ...defaultGuidance,
      give: ["Give nothing for the suspected condition; arrange transport now."],
      doNotGive: ["Do not give anything that delays referral; antitoxin is time-critical."],
      ipc: ["Stay an arm's length away and wear a mask if available.", "Ask the patient to cover their mouth and open the windows and door."],
      plainReason: "The throat and neck signs need urgent facility treatment.",
      patientScript: "Do not delay for medicine here. Go to this clinic now and show this code.",
    };
  }

  if (includesAny(code, ["NEONATAL", "NEWBORN"])) {
    return {
      ...defaultGuidance,
      severityReason: "A sick newborn needs immediate facility care.",
      give: ["Keep the baby warm while transport is arranged."],
      doNotGive: ["Do not give any oral medicine or injection. Do not delay."],
      ipc: ["Wash your hands with soap before touching the baby.", "Tell the family to use a new clean blade for cord cutting in future births."],
      plainReason: "The newborn signs need immediate care.",
      patientScript: "The baby needs care now. Keep the baby warm, go straight to this clinic and show this code.",
    };
  }

  if (code.includes("AFP")) {
    return {
      ...defaultGuidance,
      severityReason: "Sudden limb weakness must be assessed and reported today.",
      give: ["Give nothing that delays assessment."],
      doNotGive: ["Do not massage, inject or treat the weakness at the outlet."],
      ipc: ["Wash hands carefully after contact with stool or nappies.", "Keep the patient comfortable while transport is arranged."],
      plainReason: "Sudden weakness needs an urgent examination.",
      patientScript: "The sudden weakness needs a clinic check today. Go to this clinic, show this code and they will assess the limb.",
      surveillanceNotice: "Notify the surveillance contact immediately.",
    };
  }

  if (code.includes("RABIES")) {
    return {
      ...defaultGuidance,
      severityReason: "An animal bite or scratch needs rabies assessment today.",
      give: ["Wash the wound thoroughly with soap and running water for 15 minutes."],
      doNotGive: ["Do not close the wound tightly or delay rabies assessment."],
      ipc: ["Wear gloves if available when cleaning the wound.", "Wash your hands with soap after wound care."],
      plainReason: "The bite or scratch needs rabies prevention assessment.",
      patientScript: "Go to this clinic today for rabies assessment, even if the wound looks small. Show this code.",
    };
  }

  return defaultGuidance;
}

export const ROUTINE_RETURN_SIGNS = [
  "The fever lasts more than three days.",
  "There is any bleeding, or the eyes or skin turn yellow.",
  "The neck becomes stiff, or there is a fit.",
  "The patient becomes too weak to drink.",
  "Breathing becomes very fast or the chest pulls in.",
];
