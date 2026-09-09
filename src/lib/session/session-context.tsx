"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { WorkflowMode } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/client";
import type { SessionData } from "./types";

const WORKFLOW_STORAGE_KEY = "echo-reach:workflow-mode";

interface SessionContextValue extends SessionData {
  activeFacility: SessionData["memberships"][number];
  workflowMode: WorkflowMode | null;
  setWorkflowMode: (mode: WorkflowMode, remember: boolean) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readCachedWorkflow(): WorkflowMode | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
  return value === "reach" || value === "echo" ? value : null;
}

export function SessionProvider({
  session,
  children,
}: {
  session: SessionData;
  children: React.ReactNode;
}) {
  const [workflowMode, setWorkflowModeState] = useState<WorkflowMode | null>(
    () => session.preferredWorkflow ?? readCachedWorkflow()
  );

  const setWorkflowMode = useCallback(
    async (mode: WorkflowMode, remember: boolean) => {
      setWorkflowModeState(mode);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(WORKFLOW_STORAGE_KEY, mode);
      }
      if (remember) {
        const supabase = createClient();
        await supabase
          .from("profiles")
          .update({ preferred_workflow: mode })
          .eq("id", session.userId);
      }
    },
    [session.userId]
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      ...session,
      activeFacility: session.memberships[0],
      workflowMode,
      setWorkflowMode,
    }),
    [session, workflowMode, setWorkflowMode]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
