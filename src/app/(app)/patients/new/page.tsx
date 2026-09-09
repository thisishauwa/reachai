"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { patientFormSchema, type PatientFormValues } from "@/lib/validation/patient";
import { useSession } from "@/lib/session/session-context";
import { syncController } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGE_BANDS, OCCUPATION_TYPES, PREGNANCY_RELEVANT_AGE_BANDS } from "@/lib/reference/demographics";

export default function NewPatientPage() {
  const router = useRouter();
  const { activeFacility, userId } = useSession();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { patient_code: generatePatientCode() },
  });

  const sex = watch("sex");
  const ageBand = watch("age_band");
  const showPregnancy = sex === "female" && PREGNANCY_RELEVANT_AGE_BANDS.includes(ageBand);

  async function onSubmit(values: PatientFormValues) {
    setSubmitting(true);
    const id = crypto.randomUUID();
    const phone = values.phone_number
      ? `${values.phone_country_code ?? "+234"}${values.phone_number}`
      : null;

    try {
      const { synced } = await syncController.enqueueAndSync("patient", id, "insert", {
        id,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        patient_code: values.patient_code,
        full_name: values.full_name,
        phone_e164: phone,
        age_band: values.age_band,
        sex: values.sex,
        pregnancy_status: showPregnancy ? values.pregnancy_status : null,
        occupation_type: values.occupation_type,
        created_by: userId,
      });
      toast.success(synced ? "Patient created" : "Saved offline \u2014 will sync automatically");
      router.push(synced ? `/patients/${id}` : "/patients");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save patient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">New patient</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demographics</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field label="Full name" error={errors.full_name?.message}>
              <Input {...register("full_name")} />
            </Field>

            <div className="grid grid-cols-3 gap-2">
              <Field label="Country code" error={errors.phone_country_code?.message}>
                <Input placeholder="+234" {...register("phone_country_code")} />
              </Field>
              <div className="col-span-2">
                <Field label="Phone (optional)" error={errors.phone_number?.message}>
                  <Input {...register("phone_number")} />
                </Field>
              </div>
            </div>

            <Field label="Patient code" error={errors.patient_code?.message}>
              <Input {...register("patient_code")} />
            </Field>

            <Field label="Age band" error={errors.age_band?.message}>
              <Select onValueChange={(v) => setValue("age_band", v as PatientFormValues["age_band"])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select age band" /></SelectTrigger>
                <SelectContent>
                  {AGE_BANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Sex" error={errors.sex?.message}>
              <Select onValueChange={(v) => setValue("sex", v as PatientFormValues["sex"])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select sex" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="intersex">Intersex</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {showPregnancy && (
              <Field label="Pregnancy status" error={errors.pregnancy_status?.message}>
                <Select onValueChange={(v) => setValue("pregnancy_status", v as PatientFormValues["pregnancy_status"])}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pregnant">Pregnant</SelectItem>
                    <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Occupation" error={errors.occupation_type?.message}>
              <Select onValueChange={(v) => setValue("occupation_type", v as PatientFormValues["occupation_type"])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select occupation" /></SelectTrigger>
                <SelectContent>
                  {OCCUPATION_TYPES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving\u2026" : "Save patient"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function generatePatientCode() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PT-${rand}`;
}
