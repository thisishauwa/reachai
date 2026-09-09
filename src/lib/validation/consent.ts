import { z } from "zod";

export const consentMethodSchema = z.enum(["verbal_attestation", "typed_signature", "drawn_signature"]);

export const identifiedConsentSchema = z.object({
  text_version_id: z.string().uuid(),
  method: z.enum(["typed_signature", "drawn_signature"]),
  typed_signer_name: z.string().trim().min(2).optional(),
  signature_data_url: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.method === "typed_signature" && !data.typed_signer_name) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A typed full name is required",
      path: ["typed_signer_name"],
    });
  }
  if (data.method === "drawn_signature" && !data.signature_data_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A drawn signature is required",
      path: ["signature_data_url"],
    });
  }
});

export type IdentifiedConsentValues = z.infer<typeof identifiedConsentSchema>;

export const anonymousAttestationSchema = z.object({
  text_version_id: z.string().uuid(),
  attested: z.literal(true, {
    errorMap: () => ({ message: "Clinician must attest verbal consent was received" }),
  }),
});

export type AnonymousAttestationValues = z.infer<typeof anonymousAttestationSchema>;
