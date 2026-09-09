"use client";

import { useEffect, useState } from "react";
import { syncController, type SyncState } from "./sync";

export interface SyncStatusSnapshot {
  status: SyncState;
  lastSuccessfulSyncAt: number | null;
  pendingCount: number;
}

export function useSyncStatus(): SyncStatusSnapshot & { retry: () => void } {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>({
    status: "synced",
    lastSuccessfulSyncAt: null,
    pendingCount: 0,
  });

  useEffect(() => syncController.subscribe(setSnapshot), []);

  return { ...snapshot, retry: () => void syncController.flush() };
}
