"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session/session-context";
import type { WorkflowMode } from "@/lib/supabase/database.types";
import {
  EchoReachLogo,
  ReachEncounterIcon,
  EchoEncounterIcon,
} from "@/components/brand/echo-logo";
import { MobileSubpageHeader } from "@/components/nav/mobile-subpage-header";

export default function WorkflowChooserPage() {
  const router = useRouter();
  const { setWorkflowMode, workflowMode } = useSession();
  const [selected, setSelected] = useState<WorkflowMode | null>(
    workflowMode === "reach" ? "echo" : (workflowMode ?? "echo")
  );
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    if (!selected || selected === "reach" || submitting) return;
    setSubmitting(true);
    try {
      await setWorkflowMode("echo", remember);
      router.push("/home");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[620px] bg-white dark:bg-card border border-[#e4e8ec] dark:border-border rounded-[12px] shadow-sm p-5 flex flex-col animate-in fade-in-50 duration-200">
      {/* Mobile Top Navigation Bar */}
      <MobileSubpageHeader backHref="/home" backLabel="Home" title="Workflow Mode" className="mb-4" />

      {/* Brand Logo */}
      <div className="mb-3">
        <EchoReachLogo className="w-[46px] h-[38px]" />
      </div>

      {/* Heading */}
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-[#001f3e] dark:text-foreground tracking-tight">
          Welcome back!
        </h1>
        <p className="text-sm text-[#6e8298] dark:text-muted-foreground mt-1">
          Please select your preferred workflow mode to continue.
        </p>
      </div>

      {/* Option Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* REACH Encounter Card (Disabled) */}
        <div
          role="button"
          aria-disabled="true"
          title="REACH Encounter is currently disabled"
          className="group relative flex flex-col justify-between min-h-[145px] p-4 rounded-[8px] bg-[#fbfbfc] dark:bg-card border border-[#e4e8ec] dark:border-border opacity-50 cursor-not-allowed text-left select-none"
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-full bg-[#f2f3f5] dark:bg-muted flex items-center justify-center shrink-0">
              <ReachEncounterIcon className="size-5 text-[#141B34] dark:text-foreground" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-wider bg-[#f0f2f5] text-[#6e8298] px-2 py-0.5 rounded-full">
              Disabled
            </span>
          </div>

          <div className="mt-3">
            <h2 className="text-base font-semibold text-[#242b33] dark:text-foreground tracking-tight">
              REACH Encounter
            </h2>
            <p className="text-xs text-[#6e8298] dark:text-muted-foreground mt-0.5 leading-snug">
              Standard clinical documentation system
            </p>
          </div>
        </div>

        {/* ECHO Encounter Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelected("echo")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelected("echo");
            }
          }}
          aria-pressed={selected === "echo"}
          className={cn(
            "group relative flex flex-col justify-between min-h-[145px] p-4 rounded-[8px] bg-[#fbfbfc] dark:bg-card cursor-pointer transition-all duration-150 outline-none text-left select-none",
            selected === "echo"
              ? "border-2 border-[#b593d1] ring-2 ring-[#b593d1]/20 shadow-xs"
              : "border border-[#e4e8ec] dark:border-border hover:border-border/80 hover:shadow-xs"
          )}
        >
          <div className="size-10 rounded-full bg-[#f2f3f5] dark:bg-muted flex items-center justify-center shrink-0">
            <EchoEncounterIcon className="size-5 text-[#141B34] dark:text-foreground" />
          </div>

          <div className="mt-3">
            <h2 className="text-base font-semibold text-[#242b33] dark:text-foreground tracking-tight">
              ECHO Encounter
            </h2>
            <p className="text-xs text-[#6e8298] dark:text-muted-foreground mt-0.5 leading-snug">
              AI-assisted surveillance and triage system.
            </p>
          </div>
        </div>
      </div>

      {/* Remember my choice */}
      <div className="flex items-center gap-2.5 mb-4">
        <Checkbox
          id="remember-choice"
          checked={remember}
          onCheckedChange={(val) => setRemember(!!val)}
          className="size-4 rounded-[4px] border-[#6e8298] data-[state=checked]:bg-[#0073f3] data-[state=checked]:border-[#0073f3]"
        />
        <Label
          htmlFor="remember-choice"
          className="text-xs font-normal text-[#6e8298] dark:text-muted-foreground cursor-pointer select-none"
        >
          Remember my choice
        </Label>
      </div>

      {/* Continue Button */}
      <Button
        type="button"
        disabled={!selected || submitting}
        onClick={handleContinue}
        className="w-full h-11 rounded-[12px] text-sm font-medium cursor-pointer"
      >
        {submitting ? "Continuing..." : "Continue"}
      </Button>
    </div>
  );
}
