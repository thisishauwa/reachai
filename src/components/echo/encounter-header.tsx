"use client";

import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

interface EncounterHeaderProps {
  title?: string;
  onBack?: () => void;
}

/** Returns colour class based on elapsed encounter seconds */
function timerColor(seconds: number) {
  if (seconds >= 300) return "text-[#d44424] bg-[#fff5f2]"; // ≥5 min — red
  if (seconds >= 180) return "text-[#b45309] bg-[#fffbeb]"; // ≥3 min — amber
  return "text-[#495766] bg-[#fbfbfc]"; // < 3 min — neutral
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function EncounterHeader({
  title = "Create new encounter",
  onBack,
}: EncounterHeaderProps) {
  const router = useRouter();

  // Counting-up encounter timer (seconds)
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // Update elapsed every second
    const timerInterval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const colorClass = timerColor(elapsed);

  return (
    <div className="w-full flex items-center justify-between py-3 sm:py-6">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back"
          className="size-10 sm:size-14 rounded-full bg-[#f7f7f7] hover:bg-[#eaeaea] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          <ArrowLeft className="size-5 sm:size-6 text-[#495766]" />
        </button>
        <h1 className="text-lg sm:text-2xl font-normal text-[#495766] tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* Right side: actual encounter timer only */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm sm:text-base font-medium tabular-nums transition-colors duration-500 shadow-sm ${colorClass}`}
          title="Encounter duration"
        >
          <Clock className="size-4 shrink-0" />
          {elapsed >= 300 ? (
            <span className="text-[10px] font-bold uppercase tracking-wider mr-0.5">!</span>
          ) : null}
          <span>{formatElapsed(elapsed)}</span>
        </div>
      </div>
    </div>
  );
}
