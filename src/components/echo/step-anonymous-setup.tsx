"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  anonymousDemographicsSchema,
  type AnonymousDemographicsValues,
} from "@/lib/validation/patient";
import { useActiveConsentText } from "@/lib/queries/reference";
import { syncController } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AGE_BANDS, OCCUPATION_TYPES, PREGNANCY_RELEVANT_AGE_BANDS } from "@/lib/reference/demographics";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateSessionCode } from "@/lib/reference/codes";

export interface AnonymousSetupResult {
  sessionCode: string;
  encounterId: string;
  consentId: string;
  demographics: AnonymousDemographicsValues;
}

export function StepAnonymousSetup({
  onCreateEncounter,
  onComplete,
}: {
  /** Creates the `encounters` row with a fresh session code and returns its id. */
  onCreateEncounter: (sessionCode: string) => Promise<string>;
  onComplete: (result: AnonymousSetupResult) => void;
}) {
  const [locale, setLocale] = useState<"en" | "ha">("en");
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { data: consentText } = useActiveConsentText("anonymous_screening");

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<AnonymousDemographicsValues>({
    resolver: zodResolver(anonymousDemographicsSchema),
  });
  const sex = watch("sex");
  const ageBand = watch("age_band");
  const occupationType = watch("occupation_type");
  const showPregnancy = sex === "female" && PREGNANCY_RELEVANT_AGE_BANDS.includes(ageBand);

  async function onSubmit(values: AnonymousDemographicsValues) {
    if (!attested) {
      toast.error("Attest that verbal consent was received before continuing");
      return;
    }
    if (!consentText) {
      toast.error("Consent text is not yet published for this facility");
      return;
    }
    setSubmitting(true);
    try {
      const sessionCode = generateSessionCode();
      const encounterId = await onCreateEncounter(sessionCode);

      const consentId = crypto.randomUUID();
      await syncController.enqueueAndSync("consent", consentId, "insert", {
        id: consentId,
        encounter_id: encounterId,
        text_version_id: consentText.id,
        kind: "anonymous_screening",
        method: "verbal_attestation",
      });

      await syncController.enqueueAndSync("encounter_demographics", encounterId, "insert", {
        encounter_id: encounterId,
        age_band: values.age_band,
        sex: values.sex,
        pregnancy_status: showPregnancy ? values.pregnancy_status ?? null : null,
        occupation_type: values.occupation_type,
      });

      onComplete({ sessionCode, encounterId, consentId, demographics: values });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the anonymous session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Anonymous session</h1>

      <Tabs value={locale} onValueChange={(v) => setLocale(v as "en" | "ha")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="en">English</TabsTrigger>
          <TabsTrigger value="ha">Hausa</TabsTrigger>
        </TabsList>
        <TabsContent value="en">
          <Card>
            <CardContent className="p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {consentText?.text_en ?? "Consent script is not yet published for this facility."}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ha">
          <Card>
            <CardContent className="p-3 text-sm text-muted-foreground whitespace-pre-wrap">
              {consentText?.text_ha ?? "Ba a buga rubutun yardar ba tukuna."}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2">
        <Checkbox id="attest" checked={attested} onCheckedChange={(v) => setAttested(!!v)} />
        <Label htmlFor="attest" className="font-normal">
          I attest that verbal consent was received from the patient
        </Label>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <Select onValueChange={(v) => setValue("age_band", v as AnonymousDemographicsValues["age_band"])}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Age band" /></SelectTrigger>
          <SelectContent>
            {AGE_BANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.age_band && <p className="text-xs text-destructive">{errors.age_band.message}</p>}

        {/* Sex Radio Group */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Sex</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ].map((opt) => {
              const isSelected = sex === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setValue("sex", opt.value as AnonymousDemographicsValues["sex"], { shouldValidate: true })}
                  className={cn(
                    "h-10 rounded-md px-3 font-medium text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer",
                    isSelected
                      ? "bg-[#0073f3] text-white border-[#0073f3] shadow-sm"
                      : "bg-white text-[#242b33] border-input hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-muted-foreground/50"
                    )}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {errors.sex && <p className="text-xs text-destructive">{errors.sex.message}</p>}
        </div>

        {showPregnancy && (
          <Select onValueChange={(v) => setValue("pregnancy_status", v as AnonymousDemographicsValues["pregnancy_status"])}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Pregnancy status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pregnant">Pregnant</SelectItem>
              <SelectItem value="not_pregnant">Not pregnant</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Occupation Searchable Select */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground font-normal">Occupation</Label>
          <SearchableSelect
            options={OCCUPATION_TYPES}
            value={occupationType ?? ""}
            onChange={(v) => setValue("occupation_type", v as AnonymousDemographicsValues["occupation_type"], { shouldValidate: true })}
            placeholder="Select occupation"
            searchPlaceholder="Search occupation..."
          />
          {errors.occupation_type && <p className="text-xs text-destructive">{errors.occupation_type.message}</p>}
        </div>

        <Button type="submit" disabled={submitting || !attested}>
          {submitting ? "Saving\u2026" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
