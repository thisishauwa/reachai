"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { patientFormSchema, type PatientFormValues } from "@/lib/validation/patient";
import { useSession } from "@/lib/session/session-context";
import { usePatients } from "@/lib/queries/patients";
import { syncController } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AGE_BANDS, OCCUPATION_TYPES, PREGNANCY_RELEVANT_AGE_BANDS } from "@/lib/reference/demographics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function StepPatient({
  onSelect,
}: {
  onSelect: (patientId: string, fullName: string) => void;
}) {
  const { activeFacility, userId } = useSession();
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: patients = [] } = usePatients(activeFacility.facilityId, search);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: { patient_code: `PT-${Math.random().toString(36).slice(2, 6).toUpperCase()}` },
  });
  const sex = watch("sex");
  const ageBand = watch("age_band");
  const showPregnancy = sex === "female" && PREGNANCY_RELEVANT_AGE_BANDS.includes(ageBand);

  async function createPatient(values: PatientFormValues) {
    setSubmitting(true);
    const id = crypto.randomUUID();
    try {
      await syncController.enqueueAndSync("patient", id, "insert", {
        id,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        patient_code: values.patient_code,
        full_name: values.full_name,
        phone_e164: values.phone_number ? `${values.phone_country_code ?? "+234"}${values.phone_number}` : null,
        age_band: values.age_band,
        sex: values.sex,
        pregnancy_status: showPregnancy ? values.pregnancy_status : null,
        occupation_type: values.occupation_type,
        created_by: userId,
      });
      onSelect(id, values.full_name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save patient");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Select patient</h1>
      <Tabs defaultValue="existing">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Existing patient</TabsTrigger>
          <TabsTrigger value="new">New patient</TabsTrigger>
        </TabsList>
        <TabsContent value="existing" className="flex flex-col gap-2 pt-3">
          <Input placeholder="Search by name or code" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="flex flex-col gap-2">
            {patients.map((p) => (
              <Card key={p.id} role="button" onClick={() => onSelect(p.id, p.full_name)}>
                <CardContent className="p-3 text-sm">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.patient_code}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="new" className="pt-3">
          <form onSubmit={handleSubmit(createPatient)} className="flex flex-col gap-3">
            <Input placeholder="Full name" {...register("full_name")} />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            <Input placeholder="Patient code" {...register("patient_code")} />
            <Select onValueChange={(v) => setValue("age_band", v as PatientFormValues["age_band"])}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Age band" /></SelectTrigger>
              <SelectContent>
                {AGE_BANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => setValue("sex", v as PatientFormValues["sex"])}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sex" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="intersex">Intersex</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            {showPregnancy && (
              <Select onValueChange={(v) => setValue("pregnancy_status", v as PatientFormValues["pregnancy_status"])}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pregnancy status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pregnant">Pregnant</SelectItem>
                  <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select onValueChange={(v) => setValue("occupation_type", v as PatientFormValues["occupation_type"])}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Occupation" /></SelectTrigger>
              <SelectContent>
                {OCCUPATION_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving\u2026" : "Save & continue"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
