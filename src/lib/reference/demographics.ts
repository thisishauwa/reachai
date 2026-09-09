export const AGE_BANDS = [
  { value: "0_28_days", label: "0\u201328 days" },
  { value: "1_11_months", label: "1\u201311 months" },
  { value: "1_4_years", label: "1\u20134 years" },
  { value: "5_14_years", label: "5\u201314 years" },
  { value: "15_17_years", label: "15\u201317 years" },
  { value: "18_49_years", label: "18\u201349 years" },
  { value: "50_plus_years", label: "50+ years" },
] as const;

export const PREGNANCY_RELEVANT_AGE_BANDS: readonly string[] = ["15_17_years", "18_49_years"];

export const OCCUPATION_TYPES = [
  { value: "farmer", label: "Farmer" },
  { value: "trader", label: "Trader" },
  { value: "student", label: "Student" },
  { value: "civil_servant", label: "Civil servant" },
  { value: "health_worker", label: "Health worker" },
  { value: "unemployed", label: "Unemployed" },
  { value: "other", label: "Other" },
] as const;
