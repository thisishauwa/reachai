"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session/session-context";
import { useSyncStatus } from "@/lib/offline/use-sync-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

const STATUS_LABEL: Record<string, string> = {
  offline: "Offline",
  syncing: "Syncing\u2026",
  synced: "Online & synced",
  failed: "Sync failed \u2014 tap Retry",
};

export default function SettingsPage() {
  const router = useRouter();
  const { displayName, staffId, activeFacility } = useSession();
  const { status, lastSuccessfulSyncAt, pendingCount, retry } = useSyncStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function doLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleLogoutClick() {
    if (pendingCount > 0) {
      setConfirmOpen(true);
    } else {
      void doLogout();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label="Name" value={displayName} />
          <Row label="Role" value={activeFacility?.role.replace("_", " ") ?? "-"} />
          <Row label="Facility" value={`${activeFacility?.facilityName} (${activeFacility?.facilityCode})`} />
          <Row label="Staff ID" value={staffId ?? "Not set"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connectivity</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Badge variant={status === "failed" ? "destructive" : "outline"}>
              {STATUS_LABEL[status]}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Pending changes</span>
            <span className="tabular-nums">{pendingCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last successful sync</span>
            <span>
              {lastSuccessfulSyncAt
                ? formatDistanceToNow(lastSuccessfulSyncAt, { addSuffix: true })
                : "Never"}
            </span>
          </div>
          <Separator />
          <Button variant="outline" onClick={retry}>
            Retry sync
          </Button>
        </CardContent>
      </Card>

      <Button variant="destructive" onClick={handleLogoutClick}>
        Log out
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsynced changes</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingCount} change{pendingCount === 1 ? "" : "s"} have not synced yet. They will
              stay saved on this device and sync automatically when you sign back in on it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={doLogout}>Log out anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
