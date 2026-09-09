"use client";

import { CloudOff, RefreshCw, CloudCheck, TriangleAlert } from "lucide-react";
import { useSyncStatus } from "@/lib/offline/use-sync-status";
import { cn } from "@/lib/utils";

const CONFIG = {
  offline: { icon: CloudOff, label: "Offline", className: "text-muted-foreground" },
  syncing: { icon: RefreshCw, label: "Syncing", className: "text-blue-600 animate-spin" },
  synced: { icon: CloudCheck, label: "Synced", className: "text-emerald-600" },
  failed: { icon: TriangleAlert, label: "Sync failed", className: "text-amber-600" },
} as const;

export function SyncIndicator({ showLabel = false }: { showLabel?: boolean }) {
  const { status, pendingCount, retry } = useSyncStatus();
  const { icon: Icon, label, className } = CONFIG[status];

  return (
    <button
      type="button"
      onClick={retry}
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
      title={`${label}${pendingCount ? ` \u2014 ${pendingCount} pending` : ""}. Tap to retry.`}
    >
      <Icon className={cn("size-4", status === "syncing" ? className : className)} aria-hidden />
      {showLabel && <span>{label}</span>}
      {pendingCount > 0 && <span className="tabular-nums">{pendingCount}</span>}
    </button>
  );
}
