"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function StepHistory({
  initialValue,
  onContinue,
}: {
  initialValue: string;
  onContinue: (chiefComplaint: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Chief complaint / history</h1>
      <div className="flex flex-col gap-1.5">
        <Label>What brought the patient in today?</Label>
        <Textarea rows={6} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button disabled={!value.trim()} onClick={() => onContinue(value.trim())}>
        Continue
      </Button>
    </div>
  );
}
