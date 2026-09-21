"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  patientFormSchema,
  type PatientFormValues,
} from "@/lib/validation/patient";
import { useSession } from "@/lib/session/session-context";
import { usePatients } from "@/lib/queries/patients";
import { useActiveConsentText } from "@/lib/queries/reference";
import { syncController } from "@/lib/offline/sync";
import { generatePatientCode } from "@/lib/reference/codes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AGE_BANDS,
  OCCUPATION_TYPES,
  PREGNANCY_RELEVANT_AGE_BANDS,
} from "@/lib/reference/demographics";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface IdentifiedSetupResult {
  patientId: string;
  fullName: string;
  phone: string | null;
  patientCode: string;
  ageBand: string;
  sex: string;
  pregnancyStatus: string | null;
  occupationType: string;
  consentId: string;
  encounterId: string;
}

export function StepIdentifiedSetup({
  onCreateEncounter,
  onComplete,
}: {
  /** Creates the `encounters` row once the patient is known and returns its id. */
  onCreateEncounter: (patientId: string) => Promise<string>;
  onComplete: (result: IdentifiedSetupResult) => void;
}) {
  const { activeFacility, userId } = useSession();
  const [phase, setPhase] = useState<"patient" | "consent">("patient");
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    full_name: string;
    patient_code: string;
    phone_e164: string | null;
    age_band: string;
    sex: string;
    pregnancy_status: string | null;
    occupation_type: string;
  } | null>(null);
  const [consentMethod, setConsentMethod] = useState<
    "typed_signature" | "drawn_signature"
  >("typed_signature");
  const [typedName, setTypedName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: patients = [] } = usePatients(
    activeFacility.facilityId,
    search,
  );
  const { data: consentText } = useActiveConsentText("identified_screening");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      patient_code: generatePatientCode(),
    },
  });
  const sex = watch("sex");
  const ageBand = watch("age_band");
  const showPregnancy =
    sex === "female" && PREGNANCY_RELEVANT_AGE_BANDS.includes(ageBand);

  async function createPatientAndContinue(values: PatientFormValues) {
    setSubmitting(true);
    const id = crypto.randomUUID();
    try {
      await syncController.enqueueAndSync("patient", id, "insert", {
        id,
        organization_id: activeFacility.organizationId,
        facility_id: activeFacility.facilityId,
        patient_code: values.patient_code,
        full_name: values.full_name,
        phone_e164: values.phone_number
          ? `${values.phone_country_code ?? "+234"}${values.phone_number}`
          : null,
        age_band: values.age_band,
        sex: values.sex,
        pregnancy_status: showPregnancy ? values.pregnancy_status : null,
        occupation_type: values.occupation_type,
        created_by: userId,
      });
      setSelectedPatient({
        id,
        full_name: values.full_name,
        patient_code: values.patient_code,
        phone_e164: values.phone_number ?? null,
        age_band: values.age_band,
        sex: values.sex,
        pregnancy_status: showPregnancy
          ? (values.pregnancy_status ?? null)
          : null,
        occupation_type: values.occupation_type,
      });
      await goToConsent(id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save patient",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function goToConsent(patientId: string) {
    setSubmitting(true);
    try {
      const newEncounterId = await onCreateEncounter(patientId);
      setEncounterId(newEncounterId);
      setPhase("consent");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not start the encounter",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitConsent() {
    if (!selectedPatient || !consentText || !encounterId) return;
    if (consentMethod === "typed_signature" && typedName.trim().length < 2) {
      toast.error("Type the patient's full name to confirm consent");
      return;
    }
    setSubmitting(true);
    const consentId = crypto.randomUUID();
    try {
      await syncController.enqueueAndSync("consent", consentId, "insert", {
        id: consentId,
        encounter_id: encounterId,
        text_version_id: consentText.id,
        kind: "identified_screening",
        method: consentMethod,
        typed_signer_name:
          consentMethod === "typed_signature" ? typedName.trim() : null,
        signature_storage_path: null,
      });
      onComplete({
        patientId: selectedPatient.id,
        fullName: selectedPatient.full_name,
        phone: selectedPatient.phone_e164,
        patientCode: selectedPatient.patient_code,
        ageBand: selectedPatient.age_band,
        sex: selectedPatient.sex,
        pregnancyStatus: selectedPatient.pregnancy_status,
        occupationType: selectedPatient.occupation_type,
        consentId,
        encounterId,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "consent") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Data-sharing consent</h1>
        <Card>
          <CardContent className="max-h-56 overflow-y-auto p-3 text-sm text-muted-foreground whitespace-pre-wrap">
            {consentText?.text_en ??
              "Consent text is not yet published for this facility."}
          </CardContent>
        </Card>

        <RadioGroup
          value={consentMethod}
          onValueChange={(v) => setConsentMethod(v as typeof consentMethod)}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="typed_signature" id="typed" />
            <Label htmlFor="typed">Typed full name</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="drawn_signature" id="drawn" />
            <Label htmlFor="drawn">
              Drawn signature (not available on this device)
            </Label>
          </div>
        </RadioGroup>

        {consentMethod === "typed_signature" && (
          <div className="flex flex-col gap-1.5">
            <Label>Type full name to confirm</Label>
            <Input
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
          </div>
        )}

        <Button disabled={submitting || !consentText} onClick={submitConsent}>
          {submitting ? "Saving\u2026" : "I confirm consent"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Identified patient</h1>
      <Tabs defaultValue="existing">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Existing patient</TabsTrigger>
          <TabsTrigger value="new">New patient</TabsTrigger>
        </TabsList>
        <TabsContent value="existing" className="flex flex-col gap-2 pt-3">
          <Input
            placeholder="Search by name or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            {patients.map((p) => (
              <Card
                key={p.id}
                role="button"
                onClick={() =>
                  setSelectedPatient({
                    id: p.id,
                    full_name: p.full_name,
                    patient_code: p.patient_code,
                    phone_e164: null,
                    age_band: p.age_band,
                    sex: p.sex,
                    pregnancy_status: null,
                    occupation_type: "",
                  })
                }
                className={
                  selectedPatient?.id === p.id
                    ? "border-primary ring-2 ring-primary/30"
                    : ""
                }
              >
                <CardContent className="p-3 text-sm">
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.patient_code}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button
            disabled={!selectedPatient || submitting}
            onClick={() => selectedPatient && goToConsent(selectedPatient.id)}
          >
            Continue with selected patient
          </Button>
        </TabsContent>
        <TabsContent value="new" className="pt-3">
          <form
            onSubmit={handleSubmit(createPatientAndContinue)}
            className="flex flex-col gap-3"
          >
            <Alert>
              <AlertDescription>
                Identifiers are collected only to coordinate care with the
                referral clinic.
              </AlertDescription>
            </Alert>
            <Input placeholder="Full name" {...register("full_name")} />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
            <Input placeholder="Patient code" {...register("patient_code")} />
            <Select
              onValueChange={(v) =>
                setValue("age_band", v as PatientFormValues["age_band"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Age band" />
              </SelectTrigger>
              <SelectContent>
                {AGE_BANDS.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(v) =>
                setValue("sex", v as PatientFormValues["sex"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sex" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="intersex">Intersex</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            {showPregnancy && (
              <Select
                onValueChange={(v) =>
                  setValue(
                    "pregnancy_status",
                    v as PatientFormValues["pregnancy_status"],
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pregnancy status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pregnant">Pregnant</SelectItem>
                  <SelectItem value="not_pregnant">Not pregnant</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select
              onValueChange={(v) =>
                setValue(
                  "occupation_type",
                  v as PatientFormValues["occupation_type"],
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Occupation" />
              </SelectTrigger>
              <SelectContent>
                {OCCUPATION_TYPES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
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
