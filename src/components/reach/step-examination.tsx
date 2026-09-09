"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StepExamination({
  initialHistory,
  initialExam,
  onContinue,
}: {
  initialHistory: string;
  initialExam: string;
  onContinue: (pastMedicalHistory: string, physicalExamination: string) => void;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [exam, setExam] = useState(initialExam);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Past history & physical examination</h1>
      <div className="flex flex-col gap-1.5">
        <Label>Past medical history</Label>
        <Textarea rows={4} value={history} onChange={(e) => setHistory(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Physical examination</Label>
        <Textarea rows={5} value={exam} onChange={(e) => setExam(e.target.value)} />
      </div>
      <Button onClick={() => onContinue(history.trim(), exam.trim())}>Continue</Button>
    </div>
  );
}
