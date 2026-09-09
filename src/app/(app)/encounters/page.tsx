"use client";

import { Plus } from "lucide-react";
import { useSession } from "@/lib/session/session-context";
import { useEncounters } from "@/lib/queries/encounters";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function EncountersPage() {
  const { activeFacility, workflowMode } = useSession();
  const { data: encounters = [], isLoading } = useEncounters(
    activeFacility.facilityId,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Encounters</h1>
        <LinkButton
          size="sm"
          href={
            workflowMode === "echo"
              ? "/encounters/echo/new"
              : "/encounters/reach/new"
          }
        >
          <Plus className="size-4" /> New
        </LinkButton>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading\u2026</p>
      )}
      {!isLoading && encounters.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            No encounters yet
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {encounters.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium">
                  {e.patient_id
                    ? (e.patients as unknown as { full_name: string } | null)
                        ?.full_name
                    : `Anonymous \u00b7 ${e.session_code}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.encounter_code} \u00b7 {e.workflow_mode.toUpperCase()}
                </p>
              </div>
              <Badge variant={e.status === "completed" ? "default" : "outline"}>
                {e.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
