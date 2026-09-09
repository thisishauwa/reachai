import { z } from "zod";

export const sexSchema = z.enum(["female", "male", "intersex", "unknown"]);
export const ageBandSchema = z.enum([
  "0_28_days",
  "1_11_months",
  "1_4_years",
  "5_14_years",
  "15_17_years",
  "18_49_years",
  "50_plus_years",
]);
export const occupationTypeSchema = z.enum([
  "farmer",
  "trader",
  "student",
  "civil_servant",
  "health_worker",
  "unemployed",
  "other",
]);
export const pregnancyStatusSchema = z.enum(["pregnant", "not_pregnant", "unknown"]);

export const patientFormSchema = z
  .object({
    full_name: z.string().trim().min(2, "Full name is required"),
    phone_country_code: z.string().trim().optional(),
    phone_number: z.string().trim().optional(),
    age_band: ageBandSchema,
    sex: sexSchema,
    pregnancy_status: pregnancyStatusSchema.optional(),
    occupation_type: occupationTypeSchema,
    patient_code: z.string().trim().min(1, "Patient code is required"),
  })
  .superRefine((data, ctx) => {
    const isPregnancyRelevantAge = ["15_17_years", "18_49_years"].includes(data.age_band);
    if (data.sex === "female" && isPregnancyRelevantAge && !data.pregnancy_status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pregnancy status is required",
        path: ["pregnancy_status"],
      });
    }
  });

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export const anonymousDemographicsSchema = z
  .object({
    age_band: ageBandSchema,
    sex: sexSchema,
    pregnancy_status: pregnancyStatusSchema.optional(),
    occupation_type: occupationTypeSchema,
  })
  .superRefine((data, ctx) => {
    const isPregnancyRelevantAge = ["15_17_years", "18_49_years"].includes(data.age_band);
    if (data.sex === "female" && isPregnancyRelevantAge && !data.pregnancy_status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pregnancy status is required",
        path: ["pregnancy_status"],
      });
    }
  });

export type AnonymousDemographicsValues = z.infer<typeof anonymousDemographicsSchema>;
