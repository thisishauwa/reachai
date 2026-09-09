"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Stethoscope } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session/session-context";
import type { WorkflowMode } from "@/lib/supabase/database.types";

const OPTIONS: { mode: WorkflowMode; title: string; description: string; icon: typeof Stethoscope }[] = [
  {
    mode: "reach",
    title: "REACH Encounter",
    description: "Standard clinical documentation for a visiting patient.",
    icon: ClipboardList,
  },
  {
    mode: "echo",
    title: "ECHO Encounter",
    description: "Assisted syndromic surveillance and triage, identified or anonymous.",
    icon: Stethoscope,
  },
];

export default function WorkflowChooserPage() {
  const router = useRouter();
  const { setWorkflowMode } = useSession();
  const [selected, setSelected] = useState<WorkflowMode | null>(null);
  const [remember, setRemember] = useState(true);

  async function handleContinue() {
    if (!selected) return;
    await setWorkflowMode(selected, remember);
    router.push("/home");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Choose a workflow</h1>
        <p className="text-sm text-muted-foreground">
          You can switch modes any time from the header without logging out.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ mode, title, description, icon: Icon }) => (
          <Card
            key={mode}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(mode)}
            onKeyDown={(e) => e.key === "Enter" && setSelected(mode)}
            className={cn(
              "cursor-pointer transition-colors",
              selected === mode && "border-primary ring-2 ring-primary/30"
            )}
          >
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Icon className="size-6 text-primary" aria-hidden />
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="sr-only">
              Select {title}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
        <Label htmlFor="remember" className="font-normal">Remember my choice</Label>
      </div>

      <Button disabled={!selected} onClick={handleContinue}>Continue</Button>
    </div>
  );
}
