"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export function StepPrivacyMode({
  onSelect,
}: {
  onSelect: (mode: PrivacyMode) => void;
}) {
  const [selected, setSelected] = useState<PrivacyMode | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">ECHO privacy mode</h1>
        <p className="text-sm text-muted-foreground">
          Choose one. This cannot be changed once screening begins.
        </p>
      </div>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => setSelected("identified")}
        className={cn(
          "cursor-pointer",
          selected === "identified" && "border-primary ring-2 ring-primary/30",
        )}
      >
        <CardHeader>
          <CardTitle className="text-base">Identified mode</CardTitle>
          <CardDescription>
            Collects patient identifiers to coordinate care with the referral
            clinic. Requires explicit data-sharing consent and a signature.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card
        role="button"
        tabIndex={0}
        onClick={() => setSelected("anonymous")}
        className={cn(
          "cursor-pointer",
          selected === "anonymous" && "border-primary ring-2 ring-primary/30",
        )}
      >
        <CardHeader>
          <CardTitle className="text-base">Anonymous syndromic mode</CardTitle>
          <CardDescription>
            Collects only age band, sex, pregnancy status and occupation. No
            name, phone or signature is ever stored.
          </CardDescription>
        </CardHeader>
      </Card>

      <Button
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
      >
        Continue
      </Button>
    </div>
  );
}
