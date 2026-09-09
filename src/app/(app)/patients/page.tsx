"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useSession } from "@/lib/session/session-context";
import { usePatients } from "@/lib/queries/patients";
import { Input } from "@/components/ui/input";
import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PatientsPage() {
  const { activeFacility } = useSession();
  const [search, setSearch] = useState("");
  const { data: patients = [], isLoading } = usePatients(
    activeFacility?.facilityId,
    search,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Patients</h1>
        <LinkButton size="sm" href="/patients/new">
          <Plus className="size-4" /> New
        </LinkButton>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or patient code"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading\u2026</p>
      )}
      {!isLoading && patients.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            No patients found
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-2">
        {patients.map((p) => (
          <Link key={p.id} href={`/patients/${p.id}`}>
            <Card>
              <CardContent className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.patient_code}
                  </p>
                </div>
                <Badge variant="outline">{p.age_band}</Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
