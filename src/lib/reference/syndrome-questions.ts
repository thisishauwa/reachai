export interface FollowUpQuestion {
  id: string;
  code: string;
  prompt_en: string;
  prompt_ha: string;
  options: Array<{
    value: string;
    label_en: string;
    label_ha: string;
  }>;
}

export const SYNDROME_FOLLOW_UP_QUESTIONS: Record<string, FollowUpQuestion[]> = {
  // 1. Acute Watery Diarrhoea (Figma 0:3639 & 0:3684)
  ACUTE_WATERY_DIARRHOEA: [
    {
      id: "awd_q1",
      code: "AWD_DEHYDRATION",
      prompt_en: "Is the patient very thirsty or dehydrated?",
      prompt_ha: "Shin majiyyacin yana jin kishirwa sosai ko rashin ruwa a jiki?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "awd_q2",
      code: "AWD_EPISODES",
      prompt_en: "Has the patient had many diarrhoea episodes today?",
      prompt_ha: "Shin majiyyacin ya yi gudawa sau da yawa a yau?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 2. Cough > 2 weeks (Figma 0:3331 & 0:3504)
  COUGH_OVER_TWO_WEEKS: [
    {
      id: "cough_q1",
      code: "COUGH_PRESENT",
      prompt_en: "Does the patient have a cough?",
      prompt_ha: "Shin majiyyacin yana tari?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "cough_q2",
      code: "COUGH_RUNNY_NOSE",
      prompt_en: "Does the patient have a runny nose?",
      prompt_ha: "Shin majiyyacin yana majina?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "cough_q3",
      code: "COUGH_HEMOPTYSIS",
      prompt_en: "Is the patient coughing up blood or thick phlegm?",
      prompt_ha: "Shin majiyyacin yana tofar da jini ko majina mai kauri?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "cough_q4",
      code: "COUGH_WEIGHT_LOSS",
      prompt_en: "Has the patient experienced noticeable weight loss or night sweats?",
      prompt_ha: "Shin majiyyacin ya rame sosai ko yana gumi da daddare?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 3. Fever with Rash
  FEVER_RASH: [
    {
      id: "fr_q1",
      code: "FR_HIGH_FEVER",
      prompt_en: "Does the patient have high body temperature (fever)?",
      prompt_ha: "Shin majiyyacin yana da zazzabi mai zafi?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fr_q2",
      code: "FR_RASH_SPREAD",
      prompt_en: "Has the rash spread across the face or body?",
      prompt_ha: "Shin kurjin ya bazu a fuska ko a jiki?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fr_q3",
      code: "FR_RED_EYES",
      prompt_en: "Are the patient's eyes red, watery, or sensitive to light?",
      prompt_ha: "Shin idanuwan majiyyacin sun yi ja ko suna zubar da ruwa?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 4. Fever with Bleeding
  FEVER_BLEEDING: [
    {
      id: "fb_q1",
      code: "FB_SPONTANEOUS_BLEEDING",
      prompt_en: "Is there visible bleeding from the nose, gums, or skin?",
      prompt_ha: "Akwai zubar jini daga hanci, dasashi, ko fata?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fb_q2",
      code: "FB_BLACK_STOOL",
      prompt_en: "Has the patient passed black stool or vomited blood?",
      prompt_ha: "Shin majiyyacin ya yi kashi mai baki ko ya yi amai da jini?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fb_q3",
      code: "FB_CONTACT_HISTORY",
      prompt_en: "Did the patient have contact with anyone suffering from haemorrhagic fever?",
      prompt_ha: "Shin majiyyacin ya yi mu'amala da wani mai cutar zubar da jini?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 5. Fever with Neck Stiffness
  FEVER_NECK_STIFFNESS: [
    {
      id: "fns_q1",
      code: "FNS_NECK_RIGIDITY",
      prompt_en: "Is it difficult or painful for the patient to bend their neck forward?",
      prompt_ha: "Shin akwai wahala ko ciwo wajen karkata wuya gaba?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fns_q2",
      code: "FNS_ALTERED_CONSCIOUSNESS",
      prompt_en: "Is the patient unusually drowsy, confused, or unresponsive?",
      prompt_ha: "Shin majiyyacin yana cikin maye, ruɗewa, ko rashin amsawa?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "fns_q3",
      code: "FNS_PHOTOPHOBIA",
      prompt_en: "Does bright light cause pain or distress to the eyes?",
      prompt_ha: "Shin haske mai karfi yana sa ciwo a idanuwa?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 6. Acute Flaccid Paralysis
  ACUTE_FLACCID_PARALYSIS: [
    {
      id: "afp_q1",
      code: "AFP_SUDDEN_WEAKNESS",
      prompt_en: "Did sudden weakness or floppiness start in a leg or arm?",
      prompt_ha: "Shin an sami raunin kafa ko hannu kwatsam ba tare da sanarwa ba?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "afp_q2",
      code: "AFP_PROGRESSION",
      prompt_en: "Has the muscle weakness worsened over the last 1 to 4 days?",
      prompt_ha: "Shin raunin tsoka ya karu cikin kwanaki 1 zuwa 4 da suka wuce?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 7. Acute Respiratory Illness
  ACUTE_RESPIRATORY_ILLNESS: [
    {
      id: "ari_q1",
      code: "ARI_FAST_BREATHING",
      prompt_en: "Is the patient breathing faster than usual for their age?",
      prompt_ha: "Shin majiyyacin yana numfashi da sauri fiye da al'ada?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "ari_q2",
      code: "ARI_CHEST_INDRAWING",
      prompt_en: "Are the lower chest walls sucking in when the patient breathes in?",
      prompt_ha: "Shin kasan kirji yana shiga ciki sosai yayin shakar iska?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "ari_q3",
      code: "ARI_STRIDOR",
      prompt_en: "Is there a harsh or wheezing sound when breathing at rest?",
      prompt_ha: "Akwai wani sauti mai firgitarwa yayin numfashi a lokacin hutu?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 8. Jaundice
  JAUNDICE: [
    {
      id: "jaundice_q1",
      code: "JAUNDICE_YELLOW_EYES",
      prompt_en: "Are the whites of the eyes visibly yellowish in bright light?",
      prompt_ha: "Shin kwayar idon ta koma kalar rawaya sosai a cikin haske?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "jaundice_q2",
      code: "JAUNDICE_DARK_URINE",
      prompt_en: "Is the patient's urine dark tea-colored or coca-cola colored?",
      prompt_ha: "Shin fitsarin majiyyacin yana da duhu kamar kalar shayi?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "jaundice_q3",
      code: "JAUNDICE_PALE_STOOL",
      prompt_en: "Has the stool been unusually pale or clay-colored?",
      prompt_ha: "Shin kashin yana da fari ko kalar yumbu maras al'ada?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 9. Neonatal Danger Signs
  NEONATAL_DANGER_SIGNS: [
    {
      id: "nds_q1",
      code: "NDS_FEEDING_DIFFICULTY",
      prompt_en: "Is the newborn unable to breastfeed or suckle at all?",
      prompt_ha: "Shin jaririn ya kasa shan nono ko kadan?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "nds_q2",
      code: "NDS_CONVULSIONS",
      prompt_en: "Has the newborn had any fits, jerking movements, or convulsions?",
      prompt_ha: "Shin jaririn ya yi wata farfadiya ko jijjigar jiki?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "nds_q3",
      code: "NDS_HYPOTHERMIA_FEVER",
      prompt_en: "Does the newborn feel unusually cold to the touch or have severe fever?",
      prompt_ha: "Shin jikin jaririn yana da sanyi sosai ko kuma zafi mai tsanani?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "nds_q4",
      code: "NDS_UMBILICAL_INFECTION",
      prompt_en: "Is there redness, pus, or foul odor around the umbilical cord stump?",
      prompt_ha: "Akwai ja, ruwan kwaya, ko wari a kusa da cibiyar jaririn?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],

  // 10. Other Priority Syndrome
  OTHER_PRIORITY: [
    {
      id: "op_q1",
      code: "OP_DURATION",
      prompt_en: "Has this illness lasted for more than 3 days without improvement?",
      prompt_ha: "Shin wannan ciwon ya wuce kwanaki uku ba tare da sauki ba?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
    {
      id: "op_q2",
      code: "OP_SEVERE_PAIN",
      prompt_en: "Is the patient experiencing severe pain or complete inability to walk?",
      prompt_ha: "Shin majiyyacin yana jin zafi mai tsanani ko ya kasa tafiya?",
      options: [
        { value: "yes", label_en: "Yes", label_ha: "I" },
        { value: "no", label_en: "No", label_ha: "A'a" },
      ],
    },
  ],
};

export function getFollowUpQuestions(syndromeCodeOrId: string): FollowUpQuestion[] {
  // Normalize code
  const upper = syndromeCodeOrId.toUpperCase();
  for (const [key, questions] of Object.entries(SYNDROME_FOLLOW_UP_QUESTIONS)) {
    if (upper.includes(key) || key.includes(upper)) {
      return questions;
    }
  }
  // Default to Acute Watery Diarrhoea questions if not found
  return SYNDROME_FOLLOW_UP_QUESTIONS.ACUTE_WATERY_DIARRHOEA;
}
