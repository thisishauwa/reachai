"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { useReferral, useTransitionReferral } from "@/lib/queries/referrals";
import { useSession } from "@/lib/session/session-context";
import { canTransitionReferral } from "@/lib/logic/referral-state-machine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow, format } from "date-fns";
import type { ReferralStatus } from "@/lib/supabase/database.types";

export default function ReferralDetailPage(props: PageProps<"/referrals/[id]">) {
  const { id } = use(props.params);
  const { activeFacility } = useSession();
  const { data: referral, isLoading } = useReferral(id);
  const transition = useTransitionReferral();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  if (isLoading || !referral) {
    return <Skeleton className="h-64 w-full" />;
  }

  const actor = {
    isSourceMember: referral.source_facility_id === activeFacility.facilityId,
    isDestinationMember: referral.destination_facility_id === activeFacility.facilityId,
  };

  async function doTransition(toStatus: ReferralStatus, reason?: string) {
    const check = canTransitionReferral(referral!.status, toStatus, actor, reason);
    if (!check.allowed) {
      toast.error(check.reason);
      return;
    }
    try {
      await transition.mutateAsync({ referralId: referral!.id, toStatus, reason });
      toast.success(`Referral marked ${toStatus}`);
      setShowCancel(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transition failed");
    }
  }

  const events = [...(referral.referral_events ?? [])].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  );
  const incentive = Array.isArray(referral.incentive_evaluations) ? referral.incentive_evaluations[0] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg font-semibold">{referral.referral_code}</h1>
        <Badge>{referral.status}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-2 text-sm">
              {e.to_status === "cancelled" ? (
                <XCircle className="mt-0.5 size-4 text-destructive" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
              )}
              <div>
                <p className="font-medium capitalize">{e.to_status}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(e.occurred_at), "PPpp")}</p>
                {e.reason && <p className="text-xs text-muted-foreground">Reason: {e.reason}</p>}
              </div>
            </div>
          ))}
          {["arrived", "closed"]
            .filter((s) => !events.some((e) => e.to_status === s) && referral.status !== "cancelled")
            .map((s) => (
              <div key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Circle className="mt-0.5 size-4" />
                <p className="capitalize">{s} (pending)</p>
              </div>
            ))}
        </CardContent>
      </Card>

      {incentive && (
        <Card>
          <CardContent className="p-3 text-sm">
            <Badge variant={incentive.eligible ? "default" : "outline"}>
              {incentive.eligible ? "Incentive eligible" : "Not incentive eligible"}
            </Badge>
            {incentive.closure_seconds != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Closed {formatDistanceToNow(0)} after {Math.round(incentive.closure_seconds / 3600)}h
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {referral.status === "created" && (
          <Button disabled={transition.isPending} onClick={() => doTransition("arrived")}>
            Mark arrived
          </Button>
        )}
        {referral.status === "arrived" && (
          <Button disabled={transition.isPending} onClick={() => doTransition("closed")}>
            Mark closed
          </Button>
        )}
        {(referral.status === "created" || referral.status === "arrived") && (
          <>
            {!showCancel ? (
              <Button variant="outline" onClick={() => setShowCancel(true)}>Cancel referral</Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Textarea
                  placeholder="Reason for cancellation"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={!cancelReason.trim() || transition.isPending}
                  onClick={() => doTransition("cancelled", cancelReason.trim())}
                >
                  Confirm cancellation
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
