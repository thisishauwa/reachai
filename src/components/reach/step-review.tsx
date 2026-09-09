"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReachEncounterState, ReachStep } from "@/lib/reach/types";

export function StepReview({
  state,
  onEdit,
  onSubmit,
}: {
  state: ReachEncounterState;
  onEdit: (step: ReachStep) => void;
  onSubmit: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Review & complete</h1>

      <ReviewGroup title="Chief complaint / history" onEdit={() => onEdit("history")}>
        <p className="whitespace-pre-wrap">{state.chiefComplaint || "\u2014"}</p>
      </ReviewGroup>

      <ReviewGroup title="Past history & examination" onEdit={() => onEdit("examination")}>
        <p className="text-xs text-muted-foreground">Past medical history</p>
        <p className="whitespace-pre-wrap">{state.pastMedicalHistory || "\u2014"}</p>
        <p className="mt-2 text-xs text-muted-foreground">Physical examination</p>
        <p className="whitespace-pre-wrap">{state.physicalExamination || "\u2014"}</p>
      </ReviewGroup>

      <ReviewGroup title="Lab results" onEdit={() => onEdit("assessment")}>
        {state.labs.length === 0 && <p className="text-muted-foreground">No lab tests ordered</p>}
        {state.labs.map((lab) => (
          <div key={lab.labTestId} className="mb-2">
            <p className="font-medium">{lab.nameEn}</p>
            {Object.entries(lab.results).length === 0 && (
              <p className="text-xs text-muted-foreground">No result</p>
            )}
            {Object.entries(lab.results).map(([k, v]) => (
              <p key={k} className="text-xs text-muted-foreground">
                {k}: {v === null || v === undefined || v === "" ? "No result" : String(v)}
              </p>
            ))}
          </div>
        ))}
      </ReviewGroup>

      <ReviewGroup title="Treatment plan" onEdit={() => onEdit("assessment")}>
        <p><Badge variant="outline">{state.diagnosisLabel || "No diagnosis"}</Badge></p>
        <p className="mt-2 whitespace-pre-wrap">{state.treatmentPlan || "\u2014"}</p>
        {state.requiresPrescription && state.prescriptions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {state.prescriptions.map((p) => (
              <p key={p.id} className="text-xs">
                {p.medicationName} {p.dose} {p.route} {p.frequency} {p.duration}
              </p>
            ))}
          </div>
        )}
      </ReviewGroup>

      <Button disabled={submitting} onClick={handleSubmit}>
        {submitting ? "Completing\u2026" : "Complete encounter"}
      </Button>
    </div>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}
