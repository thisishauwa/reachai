"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { syncController } from "@/lib/offline/sync";
import { createIdempotencyKey } from "@/lib/logic/idempotency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@/lib/supabase/database.types";

interface TriageOutcomeRow {
  id: string;
  severity: TriageSeverity;
  condition_label_en: string | null;
  guidance_en: string | null;
  ipc_guidance_en: string | null;
  referral_required: boolean;
  acknowledged_at: string | null;
}

const SEVERITY_STYLE: Record<
  TriageSeverity,
  { className: string; icon: typeof Info; label: string }
> = {
  emergency: {
    className: "border-destructive bg-destructive/10",
    icon: ShieldAlert,
    label: "Emergency",
  },
  urgent: {
    className: "border-amber-500 bg-amber-500/10",
    icon: AlertTriangle,
    label: "Urgent",
  },
  routine: {
    className: "border-blue-500 bg-blue-500/10",
    icon: Info,
    label: "Routine",
  },
  none: {
    className: "border-muted bg-muted/40",
    icon: Info,
    label: "No concern identified",
  },
};

export function StepTriage({
  encounterId,
  syndromeId,
  questionSetId,
  onDone,
}: {
  encounterId: string;
  syndromeId: string;
  questionSetId: string;
  onDone: (outcome: {
    id: string;
    severity: TriageSeverity;
    referralRequired: boolean;
    guidanceEn: string | null;
    ipcGuidanceEn: string | null;
  }) => void;
}) {
  const [outcome, setOutcome] = useState<TriageOutcomeRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      await syncController.enqueueAndSync(
        "encounter_syndrome",
        encounterId,
        "insert",
        {
          encounter_id: encounterId,
          syndrome_id: syndromeId,
          question_set_id: questionSetId,
        },
      );

      const supabase = createClient();
      const { data, error } = await supabase.rpc("evaluate_triage", {
        p_encounter_id: encounterId,
        p_idempotency_key: createIdempotencyKey(),
      });
      if (!cancelled) {
        if (error) {
          setLoading(false);
          return;
        }
        setOutcome(data as unknown as TriageOutcomeRow);
        setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, syndromeId, questionSetId]);

  if (loading || !outcome) {
    return <Skeleton className="h-56 w-full" />;
  }

  const style = SEVERITY_STYLE[outcome.severity];
  const Icon = style.icon;
  const needsAcknowledgement =
    outcome.severity === "emergency" && !outcome.acknowledged_at;
  const outcomeId = outcome.id;

  async function acknowledge(reason?: string) {
    setBusy(true);
    try {
      const supabase = createClient();
      await supabase
        .from("triage_outcomes")
        .update({
          acknowledged_by: (await supabase.auth.getUser()).data.user?.id,
          acknowledged_at: new Date().toISOString(),
          override_reason: reason ?? null,
        })
        .eq("id", outcomeId);
      proceed();
    } finally {
      setBusy(false);
    }
  }

  function proceed() {
    onDone({
      id: outcome!.id,
      severity: outcome!.severity,
      referralRequired: outcome!.referral_required,
      guidanceEn: outcome!.guidance_en,
      ipcGuidanceEn: outcome!.ipc_guidance_en,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className={cn("border-2", style.className)}>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Icon className="size-5" aria-hidden />
          <CardTitle className="text-base">{style.label}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {outcome.condition_label_en && (
            <p className="font-medium">{outcome.condition_label_en}</p>
          )}
          {outcome.guidance_en && <p>{outcome.guidance_en}</p>}
          {outcome.ipc_guidance_en && (
            <Alert>
              <AlertTitle>Infection prevention & control</AlertTitle>
              <AlertDescription>{outcome.ipc_guidance_en}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {needsAcknowledgement ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Emergency guidance must be acknowledged, or an override reason
            recorded, before you can continue.
          </p>
          <Button disabled={busy} onClick={() => acknowledge()}>
            I acknowledge this guidance
          </Button>
          <Textarea
            placeholder="Override reason (only if you cannot follow this guidance)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={busy || !overrideReason.trim()}
            onClick={() => acknowledge(overrideReason.trim())}
          >
            Record override reason & continue
          </Button>
        </div>
      ) : (
        <Button onClick={proceed}>Continue</Button>
      )}
    </div>
  );
}
