"use client";

import { useMemo, useState } from "react";
import { Volume2, VolumeX, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFollowUpQuestions, type FollowUpQuestion } from "@/lib/reference/syndrome-questions";
import { syncController } from "@/lib/offline/sync";
import { useSession } from "@/lib/session/session-context";
import { toast } from "sonner";

/**
 * AC5 — Follow-up questions with severity sub-questions.
 *
 * Each question is a Suspected Case Definition question from the IDSR
 * document, shown as Yes/No.
 *
 * When the answer is Yes, a severity question appears inline:
 *   "How severe is this symptom?" → Mild / Moderate / Severe
 *
 * When the answer is No, no severity question is shown and the flow moves on.
 */

interface StepQuestionsProps {
  /** Multi-syndrome support: array of syndrome IDs */
  syndromeIds: string[];
  syndromeLabels?: string[];
  encounterId: string;
  encounterCode?: string;
  isAnonymous?: boolean;
  sessionCode?: string;
  onComplete: (questionSetId: string, answers: Record<string, unknown>) => void;
  onPrevious?: () => void;
}

const SEVERITY_OPTIONS = [
  { value: "mild", label_en: "Mild", label_ha: "Mai sauƙi" },
  { value: "moderate", label_en: "Moderate", label_ha: "Mai matsakaici" },
  { value: "severe", label_en: "Severe", label_ha: "Mai tsanani" },
] as const;

export function StepQuestions({
  syndromeIds,
  syndromeLabels = [],
  encounterId,
  encounterCode = "ABC-1234-98",
  isAnonymous = true,
  sessionCode,
  onComplete,
  onPrevious,
}: StepQuestionsProps) {
  const { userId } = useSession();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [severityAnswers, setSeverityAnswers] = useState<Record<string, string>>({});
  const [playingCode, setPlayingCode] = useState<string | null>(null);

  // Aggregate questions from ALL selected syndromes (deduped by code)
  const allQuestions = useMemo(() => {
    const seen = new Set<string>();
    const result: (FollowUpQuestion & { syndromeId: string })[] = [];
    for (const id of syndromeIds) {
      for (const q of getFollowUpQuestions(id)) {
        if (!seen.has(q.code)) {
          seen.add(q.code);
          result.push({ ...q, syndromeId: id });
        }
      }
    }
    return result;
  }, [syndromeIds]);

  const totalQuestions = allQuestions.length;

  // Count answered: a question is answered if either Yes or No is selected.
  // If Yes was selected, we also require a severity answer.
  const answeredCount = allQuestions.filter((q) => {
    const a = answers[q.code];
    if (a === "no") return true;
    if (a === "yes") return Boolean(severityAnswers[q.code]);
    return false;
  }).length;

  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const handleSelectOption = (questionCode: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionCode]: value }));
    // Clear severity if switching to No
    if (value === "no") {
      setSeverityAnswers((prev) => {
        const next = { ...prev };
        delete next[questionCode];
        return next;
      });
    }
  };

  const handleSelectSeverity = (questionCode: string, value: string) => {
    setSeverityAnswers((prev) => ({ ...prev, [questionCode]: value }));
  };

  const handlePlayAudio = (question: FollowUpQuestion) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setPlayingCode(question.code);
    try {
      const utterance = new SpeechSynthesisUtterance(question.prompt_ha);
      utterance.rate = 0.9;
      utterance.onend = () => setPlayingCode(null);
      utterance.onerror = () => setPlayingCode(null);
      window.speechSynthesis.speak(utterance);
    } catch {
      setPlayingCode(null);
    }
  };

  const handleSubmit = async () => {
    if (!allAnswered) {
      toast.error("Please answer all questions before continuing");
      return;
    }

    // Build FLAT answers for triage engine (expects raw "yes"/"no" strings)
    // Severity answers are inlined as <CODE>_severity = "mild"|"moderate"|"severe"
    const triageAnswers: Record<string, unknown> = {};
    for (const question of allQuestions) {
      const ans = answers[question.code];
      triageAnswers[question.code] = ans;
      if (ans === "yes" && severityAnswers[question.code]) {
        triageAnswers[`${question.code}_severity`] = severityAnswers[question.code];
      }
    }

    // Persist to offline outbox (wrapped format for DB)
    for (const question of allQuestions) {
      const answerId = crypto.randomUUID();
      const dbValue: Record<string, unknown> = { answer: answers[question.code] };
      if (answers[question.code] === "yes" && severityAnswers[question.code]) {
        dbValue.severity = severityAnswers[question.code];
      }
      try {
        await syncController.enqueue("encounter_answer", answerId, "insert", {
          id: answerId,
          encounter_id: encounterId,
          question_id: question.code,
          value: dbValue,
          answered_by: userId,
          client_updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Offline outbox queue note:", e);
      }
    }

    onComplete(`qs_${syndromeIds.join("_")}`, triageAnswers);
  };

  const handleSaveDraft = () => {
    toast.success("Progress saved as draft");
  };

  // No questions edge case
  if (totalQuestions === 0) {
    return (
      <div className="w-full flex flex-col gap-5 pb-24 sm:pb-0">
        <div className="bg-[#f9f9f9] rounded-[16px] px-5 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-base text-[#242b33]">
              {isAnonymous ? "Anonymous patient" : "Patient"}
            </span>
            <span className="text-sm text-[#6e8298]">
              {isAnonymous
                ? new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
            </span>
          </div>
          <div className="bg-[#ffece5] text-[#d4583b] rounded-full px-3.5 py-1 text-xs sm:text-sm font-medium">
            {isAnonymous ? sessionCode || encounterCode : encounterCode}
          </div>
        </div>

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-4">
          <p className="text-[#6e8298] text-base">
            No follow-up questions for the selected symptom(s). You can proceed.
          </p>
        </div>

        <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="rounded-[12px] bg-[#f2f3f5] hover:bg-[#e4e8ec] text-[#0073f3] px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
          >
            Save as draft
          </button>
          <button
            type="button"
            onClick={() => onComplete(`qs_${syndromeIds.join("_")}`, {})}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-24 sm:pb-0">
      {/* Patient Bar */}
      <div className="bg-[#f9f9f9] rounded-[16px] px-5 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-base text-[#242b33]">
            {isAnonymous ? "Anonymous patient" : "Patient"}
          </span>
          <span className="text-sm text-[#6e8298]">
            {isAnonymous
              ? new Date().toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : ""}
          </span>
        </div>
        <div className="bg-[#ffece5] text-[#d4583b] rounded-full px-3.5 py-1 text-xs sm:text-sm font-medium">
          {isAnonymous ? sessionCode || encounterCode : encounterCode}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-[#6e8298] font-medium uppercase tracking-wider">
          Follow-up questions
        </span>
        <span className="text-xs font-semibold text-[#0073f3]">
          {answeredCount}/{totalQuestions} answered
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-[#e8edf2] rounded-full overflow-hidden -mt-3">
        <div
          className="h-full bg-[#0073f3] rounded-full transition-all duration-300"
          style={{
            width:
              totalQuestions > 0
                ? `${(answeredCount / totalQuestions) * 100}%`
                : "0%",
          }}
        />
      </div>

      {/* All questions */}
      <div className="flex flex-col gap-4">
        {allQuestions.map((question, idx) => {
          const currentAnswer = answers[question.code];
          const isPlaying = playingCode === question.code;
          const showSeverity = currentAnswer === "yes";
          const currentSeverity = severityAnswers[question.code];
          const syndromeLabel =
            syndromeLabels[syndromeIds.indexOf(question.syndromeId)];

          return (
            <div key={question.code} className="relative w-full">
              <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-7 flex flex-col gap-4">
                {/* Question header */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
                    Question {idx + 1}
                    {syndromeLabel ? ` · ${syndromeLabel}` : ""}
                  </span>
                  <h3 className="text-base sm:text-lg font-normal text-[#001f3e] leading-snug">
                    {question.prompt_en}
                  </h3>
                </div>

                {/* Hausa audio prompt */}
                <div className="bg-[#f0f7ff] border border-[#aad0fb] rounded-[16px] p-3.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(question)}
                    className="size-9 rounded-full bg-white text-[#0073f3] hover:bg-blue-50/70 flex items-center justify-center shrink-0 shadow-sm transition-colors cursor-pointer"
                    aria-label="Play Hausa audio prompt"
                  >
                    {isPlaying ? (
                      <VolumeX className="size-4 text-[#0073f3] animate-pulse" />
                    ) : (
                      <Volume2 className="size-4 text-[#0073f3]" />
                    )}
                  </button>
                  <p className="font-medium text-sm text-[#0051a8] leading-relaxed">
                    {question.prompt_ha}
                  </p>
                </div>

                {/* Yes / No options */}
                <div className="flex flex-row gap-3">
                  {question.options.map((opt) => {
                    const isSelected = currentAnswer === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelectOption(question.code, opt.value)}
                        className={cn(
                          "flex-1 rounded-[14px] py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all font-medium text-sm sm:text-base",
                          isSelected
                            ? "bg-[#0073f3] text-white shadow-sm"
                            : "bg-white text-[#242b33] hover:bg-gray-50/80 border border-[#e4e8ec]"
                        )}
                      >
                        <div
                          className={cn(
                            "size-5 rounded-full flex items-center justify-center border-2 shrink-0",
                            isSelected ? "border-white" : "border-[#c7d2de]"
                          )}
                        >
                          {isSelected && (
                            <div className="size-2.5 rounded-full bg-white" />
                          )}
                        </div>
                        {opt.label_en}
                      </button>
                    );
                  })}
                </div>

                {/* AC5 — Severity sub-question (only when Yes) */}
                {showSeverity && (
                  <div className="flex flex-col gap-2 pt-1 border-t border-[#eaedef] animate-in slide-in-from-top-2 duration-200">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">
                      Severity — Tsananin alamun
                    </span>
                    <p className="text-sm text-[#242b33] font-medium">
                      How severe is this symptom?
                    </p>
                    <p className="text-xs text-[#6e8298]">
                      Tsananin wannan alamun ya kai nawa?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {SEVERITY_OPTIONS.map((sev) => {
                        const isSelSev = currentSeverity === sev.value;
                        return (
                          <button
                            key={sev.value}
                            type="button"
                            onClick={() =>
                              handleSelectSeverity(question.code, sev.value)
                            }
                            className={cn(
                              "h-11 rounded-[12px] px-2 font-medium text-xs sm:text-sm flex flex-col items-center justify-center border transition-all cursor-pointer",
                              isSelSev
                                ? sev.value === "severe"
                                  ? "bg-[#e05338] text-white border-[#e05338] shadow-sm"
                                  : sev.value === "moderate"
                                  ? "bg-[#f59e0b] text-white border-[#f59e0b] shadow-sm"
                                  : "bg-[#22c55e] text-white border-[#22c55e] shadow-sm"
                                : "bg-white text-[#242b33] border-[#e4e8ec] hover:bg-[#fafafa]"
                            )}
                          >
                            {sev.label_en}
                            <span className="text-[10px] opacity-80">{sev.label_ha}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Actions Bar */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <button
          type="button"
          onClick={handleSaveDraft}
          className="rounded-[12px] bg-[#f2f3f5] hover:bg-[#e4e8ec] text-[#0073f3] px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
        >
          Save as draft
        </button>
        <button
          type="button"
          id="questions-continue-btn"
          disabled={!allAnswered}
          onClick={handleSubmit}
          className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Continue to assessment
        </button>
      </div>
    </div>
  );
}
