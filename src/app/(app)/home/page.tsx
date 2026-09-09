"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  UserPlus,
  ClipboardList,
  Send,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/lib/session/session-context";
import { useRecentPatients } from "@/lib/queries/patients";
import { useRecentEncounters } from "@/lib/queries/encounters";
import { usePendingReferralAlert } from "@/lib/queries/referrals";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const router = useRouter();
  const { displayName, activeFacility, workflowMode } = useSession();
  const facilityId = activeFacility?.facilityId;

  useEffect(() => {
    if (!workflowMode) router.replace("/workflow");
  }, [workflowMode, router]);

  const { data: patients = [] } = useRecentPatients(facilityId, 2);
  const { data: encounters = [] } = useRecentEncounters(facilityId, 2);
  const { data: pendingReferral } = usePendingReferralAlert(facilityId);

  if (!workflowMode) return null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">
          {greeting()}, {displayName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeFacility?.facilityName}
        </p>
      </div>

      {pendingReferral && (
        <Alert>
          <AlertTitle>Referral needs attention</AlertTitle>
          <AlertDescription>
            <Link
              href={`/referrals/${pendingReferral.id}`}
              className="underline"
            >
              {pendingReferral.referral_code}
            </Link>{" "}
            is currently {pendingReferral.status}.
          </AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-1 gap-2">
        {workflowMode === "reach" ? (
          <>
            <QuickAction
              href="/encounters/reach/new"
              icon={ClipboardList}
              label="Start Manual Encounter"
            />
            <QuickAction
              href="/encounters/reach/new?guided=1"
              icon={ClipboardList}
              label="Start Guided Workflow"
            />
            <QuickAction
              href="/patients/new"
              icon={UserPlus}
              label="Create New Patient"
            />
          </>
        ) : (
          <>
            <QuickAction
              href="/encounters/echo/new"
              icon={Plus}
              label="Start ECHO Encounter"
            />
            <QuickAction
              href="/patients/new"
              icon={UserPlus}
              label="Create New Patient"
            />
            <QuickAction href="/referrals" icon={Send} label="View Referrals" />
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent patients</h2>
          <Link href="/patients" className="text-xs text-primary">
            View all
          </Link>
        </div>
        {patients.length === 0 && <EmptyRow text="No patients yet" />}
        {patients.map((p) => (
          <Card key={p.id}>
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
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent encounters</h2>
          <Link href="/encounters" className="text-xs text-primary">
            View all
          </Link>
        </div>
        {encounters.length === 0 && <EmptyRow text="No encounters yet" />}
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
                  {e.encounter_code}
                </p>
              </div>
              <Badge variant="outline">{e.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Plus;
  label: string;
}) {
  return (
    <LinkButton
      href={href}
      variant="outline"
      className="h-auto justify-between py-3"
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4" /> {label}
      </span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </LinkButton>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center text-sm text-muted-foreground">
        {text}
      </CardContent>
    </Card>
  );
}
