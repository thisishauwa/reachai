"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPLAINT_AREAS, type ComplaintAreaCode } from "@/lib/reference/complaint-questions";

export function StepComplaintArea({ initialArea, onContinue, onPrevious }: { initialArea?: ComplaintAreaCode | null; onContinue: (area: ComplaintAreaCode) => void; onPrevious?: () => void }) {
  const [selected, setSelected] = useState<ComplaintAreaCode | null>(initialArea ?? null);
  return (
    <div className="w-full flex flex-col gap-6 pb-28 sm:pb-0">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />
        <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-10 flex flex-col gap-6">
          <div><p className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">Step 4 of 6 · Complaint area</p><h2 className="text-xl sm:text-2xl font-semibold text-[#001f3e] mt-1">What is the main problem?</h2><p className="text-sm text-[#6e8298] mt-1">Choose one area · [Hausa pending]</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Main complaint area">
            {COMPLAINT_AREAS.map((area) => {
              const active = selected === area.code;
              return (
                <button key={area.code} type="button" role="radio" aria-checked={active} onClick={() => setSelected(area.code)} className={cn("min-h-11 rounded-[14px] border p-4 text-left flex items-center justify-between gap-3", active ? "border-[#0073f3] bg-[#f0f7ff] text-[#005bbf] ring-1 ring-[#0073f3]" : "border-[#dfe5eb] bg-white text-[#242b33]") }>
                  <span><span className="block text-sm sm:text-base font-medium"><span className="text-[#6e8298] mr-2">{area.code}</span>{area.label_en}</span><span className="block text-xs text-[#6e8298] mt-0.5">{area.label_ha}</span></span>
                  <span className={cn("size-5 rounded-full border flex items-center justify-center shrink-0", active ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]") }>{active && <Check className="size-3 stroke-[3]" />}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="w-full flex items-center justify-between gap-3 pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button type="button" disabled={!selected} onClick={() => selected && onContinue(selected)} className="min-h-11 rounded-[12px] bg-[#0073f3] px-6 sm:px-8 text-sm sm:text-base font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
      </div>
    </div>
  );
}
