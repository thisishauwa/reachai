"use client";

import { useEffect } from "react";
import { registerOutboxHandlers } from "@/lib/offline/register-handlers";
import { syncController } from "@/lib/offline/sync";

/** Registers outbox handlers once and kicks an initial flush attempt. */
export function OfflineBootstrap() {
  useEffect(() => {
    registerOutboxHandlers();
    void syncController.flush();
  }, []);
  return null;
}
