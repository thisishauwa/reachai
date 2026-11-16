"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatientPresence } from "@/lib/reference/request-options";
import {
  dangerSignsFromCaregiverAnswers,
  highestPrioritySign,
  labelForLookCheckSign,
  syndromeForLookCheckSign,
  visibleCaregiverQuestions,
  visibleLookCheckSigns,
  type LookCheckAnswer,
} from "@/lib/reference/look-check";

export interface LookCheckResult {
  selectedSignCodes: string[];
  primarySignCode: string | null;
  syndromeId: string | null;
  syndromeLabel: string | null;
  caregiverReported: boolean;
  hasUnknown: boolean;
  answers: Record<string, LookCheckAnswer>;
}

interface StepLookCheckProps {
  presence: PatientPresence;
  ageBand: string;
  onContinue: (result: LookCheckResult) => void;
  onPrevious?: () => void;
}

const ANSWER_OPTIONS: { value: LookCheckAnswer; label: string; ha: string }[] = [
  { value: "yes", label: "Yes", ha: "I" },
  { value: "no", label: "No", ha: "A'a" },
  { value: "unknown", label: "Don't know", ha: "Ban sani ba" },
];

export function StepLookCheck({ presence, ageBand, onContinue, onPrevious }: StepLookCheckProps) {
  const isPresent = presence === "with_me";
  const signs = useMemo(() => visibleLookCheckSigns(ageBand), [ageBand]);
  const questions = useMemo(() => visibleCaregiverQuestions(ageBand), [ageBand]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, LookCheckAnswer>>({});
  const hasStarted = Object.keys(answers).length > 0;

  const unanswered = !isPresent && questions.some((question) => !answers[question.code]);
  const dangerCodes = isPresent ? [...checked] : dangerSignsFromCaregiverAnswers(answers);
  const primarySignCode = highestPrioritySign(dangerCodes);
  const hasUnknown = Object.values(answers).includes("unknown");

  const routeToAcute = (selectedSignCodes: string[], nextAnswers = answers) => {
    const nextPrimarySignCode = highestPrioritySign(selectedSignCodes);
    if (!nextPrimarySignCode) return;

    onContinue({
      selectedSignCodes,
      primarySignCode: nextPrimarySignCode,
      syndromeId: syndromeForLookCheckSign(nextPrimarySignCode),
      syndromeLabel: labelForLookCheckSign(nextPrimarySignCode),
      caregiverReported: !isPresent,
      hasUnknown: Object.values(nextAnswers).includes("unknown"),
      answers: nextAnswers,
    });
  };

  const selectPresentDangerSign = (code: string) => {
    // The walkthrough requires the refer-now screen to replace the look-check
    // as soon as a visible sign is ticked. There is deliberately no second
    // "Continue — acute" tap on this path.
    setChecked(new Set([code]));
    routeToAcute([code]);
  };

  const answerCaregiverQuestion = (code: string, value: LookCheckAnswer) => {
    const nextAnswers = { ...answers, [code]: value };
    setAnswers(nextAnswers);
    const nextDangerCodes = dangerSignsFromCaregiverAnswers(nextAnswers);
    if (nextDangerCodes.length > 0) routeToAcute(nextDangerCodes, nextAnswers);
  };

  const handleContinue = () => {
    if (unanswered) return;
    onContinue({
      selectedSignCodes: dangerCodes,
      primarySignCode,
      syndromeId: primarySignCode ? syndromeForLookCheckSign(primarySignCode) : null,
      syndromeLabel: primarySignCode ? labelForLookCheckSign(primarySignCode) : null,
      caregiverReported: !isPresent,
      hasUnknown,
      answers,
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-28">
      <div className="relative w-full">
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />
        <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-10 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">Step 3 of 6 · Look-check</span>
            <h2 className="text-xl sm:text-2xl font-medium text-[#001f3e] leading-snug">
              {isPresent ? "Look at the patient. Do you see any of these?" : "Ask the person in front of you"}
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              {isPresent
                ? "Tick all that apply. Ask only about the fit. The patient is here, so the rest you can see."
                : "You cannot see the patient, so ask. Don't know is a real answer — do not guess."}
            </p>
            <p className="text-xs text-[#8a99a8]">
              {isPresent
                ? "Dubi majiyyacin. Idan ka ga daya daga cikin wadannan, zabe shi."
                : "Majiyyacin ba ya nan. Yi tambayoyin, kuma kada ka yi zato idan ba a sani ba."}
            </p>
          </div>

          {isPresent ? (
            <div className="bg-white rounded-[16px] p-4 sm:p-6 border border-[#e4e8ec] flex flex-col gap-2.5">
              {signs.map((sign) => {
                const selected = checked.has(sign.code);
                return (
                  <button
                    key={sign.code}
                    type="button"
                    id={`look-check-${sign.code.toLowerCase()}`}
                    aria-pressed={selected}
                    onClick={() => selectPresentDangerSign(sign.code)}
                    className={cn(
                      "min-h-11 w-full rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left border transition-all",
                      selected
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#005bbf] ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]",
                    )}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm sm:text-base font-medium flex items-start gap-2"><span className="rounded-full bg-[#eef5fc] px-2 py-0.5 text-[10px] font-semibold text-[#4c6f91] shrink-0">{sign.code}</span><span>{sign.label_en}</span></span>
                      <span className="text-xs text-[#6e8298]">{sign.label_ha}</span>
                    </span>
                    <span className={cn("size-6 rounded-[6px] border flex items-center justify-center shrink-0", selected ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]") }>
                      {selected && <Check className="size-4 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-[#d5e7fa] bg-[#f0f7ff] px-4 py-3 text-sm text-[#0051a8]">
                Caregiver-reported · the patient is not here. <span className="block text-xs mt-0.5">Wani ne yake bayar da rahoton · majiyyacin ba ya nan.</span>
              </div>
              {questions.map((question, index) => {
                const missing = hasStarted && !answers[question.code];
                return (
                  <fieldset key={question.code} className={cn("bg-white rounded-[16px] p-4 sm:p-5 border flex flex-col gap-3", missing ? "border-[#d44424]" : "border-[#e4e8ec]") }>
                    <legend className="sr-only">{question.prompt_en}</legend>
                    <div>
                      <p className="text-sm sm:text-base font-medium text-[#242b33]">{index + 1}. {question.prompt_en}</p>
                      <p className="text-xs text-[#6e8298] mt-1">{question.prompt_ha}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {ANSWER_OPTIONS.map((option) => {
                        const selected = answers[question.code] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => answerCaregiverQuestion(question.code, option.value)}
                            className={cn(
                              "min-h-11 rounded-[12px] border px-2 py-2 text-xs sm:text-sm font-medium flex flex-col items-center justify-center",
                              selected ? "bg-[#0073f3] border-[#0073f3] text-white" : "bg-white border-[#d8e0e7] text-[#242b33]",
                            )}
                          >
                            {option.label}<span className="text-[10px] opacity-75">{option.ha}</span>
                          </button>
                        );
                      })}
                    </div>
                    {missing && <p className="text-xs font-medium text-[#d44424]">Choose Yes, No, or Don&apos;t know.</p>}
                  </fieldset>
                );
              })}
            </div>
          )}

          {!isPresent && hasUnknown && (
            <div role="note" className="rounded-[14px] border border-[#cfd8e1] bg-[#f5f7f9] p-4 text-sm text-[#3f4e5d]">
              <p className="font-semibold">This case cannot end as routine.</p>
              <p className="mt-1">Ask the caregiver to bring the patient in for urgent review.</p>
              <p className="text-xs mt-1">A nemi mai kula da shi ya kawo majiyyacin a duba shi cikin gaggawa.</p>
            </div>
          )}
        </div>
      </div>

      <div className="encounter-action-bar">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button
          type="button"
          id="look-check-continue-btn"
          onClick={handleContinue}
          disabled={unanswered}
          aria-disabled={unanswered}
          className={cn("min-h-11 rounded-[12px] bg-[#0073f3] px-5 sm:px-8 text-sm sm:text-base font-medium text-white shadow-sm", unanswered && "opacity-50 cursor-not-allowed")}
        >
          {isPresent ? "None of these — continue" : primarySignCode ? "Continue — acute" : "Continue"}
        </button>
      </div>
    </div>
  );
}
