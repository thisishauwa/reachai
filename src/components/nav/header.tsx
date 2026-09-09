"use client";

import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session/session-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SyncIndicator } from "@/components/offline/sync-indicator";

export function Header() {
  const { displayName, activeFacility, workflowMode, userId } = useSession();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{activeFacility?.facilityName}</p>
        <p className="truncate text-xs text-muted-foreground">{displayName}</p>
      </div>
      <div className="flex items-center gap-2">
        <SyncIndicator />
        {workflowMode && (
          <Badge variant={workflowMode === "echo" ? "default" : "secondary"}>
            {workflowMode === "echo" ? "ECHO" : "REACH"}
          </Badge>
        )}
        <NotificationBell userId={userId} />
      </div>
    </header>
  );
}
