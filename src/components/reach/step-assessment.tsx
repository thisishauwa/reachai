"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useLabCatalogue } from "@/lib/queries/reference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ReachLabResultDraft,
  ReachPrescriptionDraft,
} from "@/lib/reach/types";

const GENERIC_SELECT_OPTIONS = ["positive", "negative", "indeterminate"];

export function StepAssessment({
  initial,
  onContinue,
}: {
  initial: {
    requiresPrescription: boolean;
    labs: ReachLabResultDraft[];
    diagnosisLabel: string;
    treatmentPlan: string;
    prescriptions: ReachPrescriptionDraft[];
  };
  onContinue: (values: typeof initial) => void;
}) {
  const { data: catalogue } = useLabCatalogue();
  const [requiresPrescription, setRequiresPrescription] = useState(
    initial.requiresPrescription,
  );
  const [labs, setLabs] = useState<ReachLabResultDraft[]>(initial.labs);
  const [diagnosisLabel, setDiagnosisLabel] = useState(initial.diagnosisLabel);
  const [treatmentPlan, setTreatmentPlan] = useState(initial.treatmentPlan);
  const [prescriptions, setPrescriptions] = useState<ReachPrescriptionDraft[]>(
    initial.prescriptions,
  );

  function addLab(defId: string) {
    const def = catalogue?.definitions.find((d) => d.id === defId);
    if (!def) return;
    setLabs((prev) => [
      ...prev,
      {
        labTestDefinitionId: def.id,
        labTestId: crypto.randomUUID(),
        code: def.code,
        nameEn: def.name_en,
        resultType: def.result_type,
        results: {},
      },
    ]);
  }

  function updateLabResult(labTestId: string, key: string, value: unknown) {
    setLabs((prev) =>
      prev.map((l) =>
        l.labTestId === labTestId
          ? { ...l, results: { ...l.results, [key]: value } }
          : l,
      ),
    );
  }

  function removeLab(labTestId: string) {
    setLabs((prev) => prev.filter((l) => l.labTestId !== labTestId));
  }

  function addPrescription() {
    setPrescriptions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        medicationName: "",
        dose: "",
        route: "",
        frequency: "",
        duration: "",
        instructions: "",
      },
    ]);
  }

  function updatePrescription(
    id: string,
    patch: Partial<ReachPrescriptionDraft>,
  ) {
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function removePrescription(id: string) {
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Assessment & plan</h1>

      <div className="flex items-center justify-between rounded-md border p-3">
        <Label htmlFor="requires-rx">Requires prescription?</Label>
        <Switch
          id="requires-rx"
          checked={requiresPrescription}
          onCheckedChange={setRequiresPrescription}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lab tests</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select onValueChange={(value) => value && addLab(value as string)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Add a lab test" />
            </SelectTrigger>
            <SelectContent>
              {catalogue?.definitions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {labs.map((lab) => (
            <Card key={lab.labTestId}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{lab.nameEn}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLab(lab.labTestId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <LabResultInputs
                  lab={lab}
                  components={
                    catalogue?.components.filter(
                      (c) =>
                        c.lab_test_definition_id === lab.labTestDefinitionId,
                    ) ?? []
                  }
                  onChange={(key, value) =>
                    updateLabResult(lab.labTestId, key, value)
                  }
                />
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1.5">
        <Label>Final diagnosis</Label>
        <Input
          value={diagnosisLabel}
          onChange={(e) => setDiagnosisLabel(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Treatment plan</Label>
        <Textarea
          rows={4}
          value={treatmentPlan}
          onChange={(e) => setTreatmentPlan(e.target.value)}
        />
      </div>

      {requiresPrescription && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Prescriptions</CardTitle>
            <Button size="sm" variant="outline" onClick={addPrescription}>
              <Plus className="size-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {prescriptions.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-2 p-3">
                  <div className="flex items-center justify-between">
                    <Input
                      placeholder="Medication name"
                      value={p.medicationName}
                      onChange={(e) =>
                        updatePrescription(p.id, {
                          medicationName: e.target.value,
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrescription(p.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Dose"
                      value={p.dose}
                      onChange={(e) =>
                        updatePrescription(p.id, { dose: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Route"
                      value={p.route}
                      onChange={(e) =>
                        updatePrescription(p.id, { route: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Frequency"
                      value={p.frequency}
                      onChange={(e) =>
                        updatePrescription(p.id, { frequency: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Duration"
                      value={p.duration}
                      onChange={(e) =>
                        updatePrescription(p.id, { duration: e.target.value })
                      }
                    />
                  </div>
                  <Textarea
                    placeholder="Instructions"
                    value={p.instructions}
                    onChange={(e) =>
                      updatePrescription(p.id, { instructions: e.target.value })
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        disabled={!diagnosisLabel.trim()}
        onClick={() =>
          onContinue({
            requiresPrescription,
            labs,
            diagnosisLabel: diagnosisLabel.trim(),
            treatmentPlan: treatmentPlan.trim(),
            prescriptions,
          })
        }
      >
        Continue to review
      </Button>
    </div>
  );
}

function LabResultInputs({
  lab,
  components,
  onChange,
}: {
  lab: ReachLabResultDraft;
  components: {
    id: string;
    code: string;
    label_en: string;
    result_type: string;
    unit: string | null;
    options: unknown;
  }[];
  onChange: (key: string, value: unknown) => void;
}) {
  if (lab.resultType === "multi_component") {
    return (
      <div className="flex flex-col gap-2">
        {components.map((c) => (
          <div key={c.id} className="flex flex-col gap-1">
            <Label className="text-xs">
              {c.label_en}
              {c.unit ? ` (${c.unit})` : ""}
            </Label>
            <ComponentInput
              resultType={c.result_type}
              options={Array.isArray(c.options) ? (c.options as string[]) : []}
              value={lab.results[c.code]}
              onChange={(v) => onChange(c.code, v)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ComponentInput
      resultType={lab.resultType}
      options={GENERIC_SELECT_OPTIONS}
      value={lab.results["value"]}
      onChange={(v) => onChange("value", v)}
    />
  );
}

function ComponentInput({
  resultType,
  options,
  value,
  onChange,
}: {
  resultType: string;
  options: string[];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (resultType === "binary") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={value === "positive" ? "default" : "outline"}
          onClick={() => onChange("positive")}
        >
          Positive
        </Button>
        <Button
          size="sm"
          variant={value === "negative" ? "default" : "outline"}
          onClick={() => onChange("negative")}
        >
          Negative
        </Button>
      </div>
    );
  }
  if (resultType === "numeric") {
    return (
      <Input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : parseFloat(e.target.value))
        }
      />
    );
  }
  return (
    <Select
      value={typeof value === "string" ? value : undefined}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select result" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o.replaceAll("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
