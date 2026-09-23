"use client";

import { useMemo, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFollowUpQuestions, type FollowUpQuestion } from "@/lib/reference/syndrome-questions";
import { syncController } from "@/lib/offline/sync";
import { useSession } from "@/lib/session/session-context";
import { toast } from "sonner";

interface SyndromeQuestionGroup {
  syndromeId: string;
  questions: FollowUpQuestion[];
}

interface StepQuestionsProps {
  /** Multi-syndrome support: array of syndrome IDs */
  syndromeIds: string[];
  syndromeLabels?: string[];
  encounterId: string;
  encounterCode?: string;
  patientName?: string;
  patientCreatedAt?: string;
  isAnonymous?: boolean;
  sessionCode?: string;
  onComplete: (questionSetId: string, answers: Record<string, unknown>) => void;
  onPrevious?: () => void;
}

export function StepQuestions({
  syndromeIds,
  syndromeLabels = [],
  encounterId,
  encounterCode = "ABC-1234-98",
  patientName = "Oyintari Werinipre",
  patientCreatedAt = "10 Aug 2023",
  isAnonymous = false,
  sessionCode,
  onComplete,
  onPrevious,
}: StepQuestionsProps) {
  const { userId } = useSession();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [playingCode, setPlayingCode] = useState<string | null>(null);

  // Aggregate questions from ALL selected syndromes
  const groups: SyndromeQuestionGroup[] = useMemo(() => {
    return syndromeIds.map((id) => ({
      syndromeId: id,
      questions: getFollowUpQuestions(id),
    }));
  }, [syndromeIds]);

  // All questions flattened (with deduplication by code)
  const allQuestions = useMemo(() => {
    const seen = new Set<string>();
    const result: (FollowUpQuestion & { syndromeId: string })[] = [];
    for (const group of groups) {
      for (const q of group.questions) {
        if (!seen.has(q.code)) {
          seen.add(q.code);
          result.push({ ...q, syndromeId: group.syndromeId });
        }
      }
    }
    return result;
  }, [groups]);

  const totalQuestions = allQuestions.length;
  const answeredCount = allQuestions.filter((q) => answers[q.code] !== undefined).length;
  const allAnswered = answeredCount === totalQuestions && totalQuestions > 0;

  const handleSelectOption = (questionCode: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionCode]: value }));
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

    // Persist answers to offline sync outbox
    for (const question of allQuestions) {
      const answerId = crypto.randomUUID();
      try {
        await syncController.enqueue("encounter_answer", answerId, "insert", {
          id: answerId,
          encounter_id: encounterId,
          question_id: question.code,
          value: { answer: answers[question.code] },
          answered_by: userId,
          client_updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("Offline outbox queue note:", e);
      }
    }

    onComplete(`qs_${syndromeIds.join("_")}`, answers);
  };

  const handleSaveDraft = () => {
    toast.success("Progress saved as draft");
  };

  if (totalQuestions === 0) {
    return (
      <div className="w-full flex flex-col gap-5 pb-24 sm:pb-0">
        <div className="bg-[#f9f9f9] rounded-[16px] px-5 py-4 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-base text-[#242b33]">
              {isAnonymous ? "Anonymous patient" : patientName}
            </span>
            <span className="text-sm text-[#6e8298]">
              {isAnonymous
                ? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                : `Created ${patientCreatedAt}`}
            </span>
          </div>
          <div className="bg-[#ffece5] text-[#d4583b] rounded-full px-3.5 py-1 text-xs sm:text-sm font-medium">
            {isAnonymous ? sessionCode || "ABC-1234-98" : encounterCode}
          </div>
        </div>

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-4">
          <p className="text-[#6e8298] text-base">
            No follow-up questions for the selected syndrome(s). You can proceed to triage.
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
            {isAnonymous ? "Anonymous patient" : patientName}
          </span>
          <span className="text-sm text-[#6e8298]">
            {isAnonymous
              ? new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : `Created ${patientCreatedAt}`}
          </span>
        </div>
        <div className="bg-[#ffece5] text-[#d4583b] rounded-full px-3.5 py-1 text-xs sm:text-sm font-medium">
          {isAnonymous ? sessionCode || "ABC-1234-98" : encounterCode}
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
          style={{ width: totalQuestions > 0 ? `${(answeredCount / totalQuestions) * 100}%` : "0%" }}
        />
      </div>

      {/* All questions stacked on one page */}
      <div className="flex flex-col gap-4">
        {allQuestions.map((question, idx) => {
          const currentAnswer = answers[question.code];
          const isPlaying = playingCode === question.code;

          return (
            <div key={question.code} className="relative w-full">
              <div className="bg-[#f9f9f9] rounded-[20px] p-5 sm:p-7 flex flex-col gap-4">
                {/* Question header */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
                    Question {idx + 1}
                    {syndromeLabels[syndromeIds.indexOf(question.syndromeId)]
                      ? ` · ${syndromeLabels[syndromeIds.indexOf(question.syndromeId)]}`
                      : ""}
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

                {/* Inline Yes / No options */}
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
                            isSelected
                              ? "border-white"
                              : "border-[#c7d2de]"
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
          disabled={!allAnswered}
          onClick={handleSubmit}
          className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Continue to triage
        </button>
      </div>
    </div>
  );
}
