"use client";

import { use } from "react";
import { usePatient } from "@/lib/queries/patients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientDetailPage(props: PageProps<"/patients/[id]">) {
  const { id } = use(props.params);
  const { data: patient, isLoading } = usePatient(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!patient) {
    return <p className="text-sm text-muted-foreground">Patient not found.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{patient.full_name}</h1>
        <Badge variant="outline">{patient.patient_code}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demographics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Age band" value={patient.age_band} />
          <Detail label="Sex" value={patient.sex} />
          <Detail label="Pregnancy" value={patient.pregnancy_status ?? "N/A"} />
          <Detail label="Occupation" value={patient.occupation_type} />
          <Detail label="Phone" value={patient.phone_e164 ?? "Not provided"} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton
          variant="outline"
          href={`/encounters/reach/new?patientId=${patient.id}`}
        >
          New REACH encounter
        </LinkButton>
        <LinkButton
          variant="outline"
          href={`/encounters/echo/new?patientId=${patient.id}`}
        >
          New ECHO encounter
        </LinkButton>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value.replaceAll("_", " ")}</p>
    </div>
  );
}
