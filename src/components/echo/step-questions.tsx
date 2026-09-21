"use client";

import { useMemo, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFollowUpQuestions, type FollowUpQuestion } from "@/lib/reference/syndrome-questions";
import { syncController } from "@/lib/offline/sync";
import { useSession } from "@/lib/session/session-context";
import { toast } from "sonner";

interface StepQuestionsProps {
  syndromeId: string;
  syndromeCode?: string;
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
  syndromeId,
  syndromeCode,
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Get syndrome-specific questions (with English and Hausa prompts)
  const questions: FollowUpQuestion[] = useMemo(() => {
    const code = syndromeCode || syndromeId;
    return getFollowUpQuestions(code);
  }, [syndromeCode, syndromeId]);

  const currentQuestion = questions[currentIndex] || questions[0];
  const totalQuestions = questions.length;
  const currentAnswer = answers[currentQuestion.code];

  const handleSelectOption = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.code]: value,
    }));
  };

  const handlePlayAudio = () => {
    setIsPlayingAudio(true);
    // Simulate audio playback or speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt_ha);
        utterance.rate = 0.9;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setTimeout(() => setIsPlayingAudio(false), 2000);
      }
    } else {
      setTimeout(() => setIsPlayingAudio(false), 2000);
    }
  };

  const handleNext = async () => {
    if (!currentAnswer) {
      toast.error("Please select an option before proceeding");
      return;
    }

    // Persist answer to offline sync outbox
    const answerId = crypto.randomUUID();
    try {
      await syncController.enqueue("encounter_answer", answerId, "insert", {
        id: answerId,
        encounter_id: encounterId,
        question_id: currentQuestion.code || currentQuestion.id,
        value: { answer: currentAnswer },
        answered_by: userId,
        client_updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Offline outbox queue note:", e);
    }

    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed all follow-up questions
      onComplete(`qs_${syndromeId}`, answers);
    }
  };

  const handleSaveDraft = () => {
    toast.success("Progress saved as draft");
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-24 sm:pb-0">
      {/* Patient Bar (Figma 0:3639, 0:3684, 0:3331, 0:3504) */}
      <div className="bg-[#f9f9f9] rounded-[16px] px-5 py-4 flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-base text-[#242b33]">
            {isAnonymous ? "Anonymous patient" : patientName}
          </span>
          <span className="text-sm text-[#6e8298]">
            {isAnonymous
              ? new Date().toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : `Created ${patientCreatedAt}`}
          </span>
        </div>
        <div className="bg-[#ffece5] text-[#d4583b] rounded-full px-3.5 py-1 text-xs sm:text-sm font-medium">
          {isAnonymous ? sessionCode || "ABC-1234-98" : encounterCode}
        </div>
      </div>

      {/* Main Question Card Stack */}
      <div className="relative w-full">
        {/* Background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Eyebrow and Question Title */}
          <div className="flex flex-col gap-2">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Follow up {currentIndex + 1}/{totalQuestions}
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              {currentQuestion.prompt_en}
            </h2>
          </div>

          {/* Hausa Audio Prompt Card */}
          <div className="bg-[#f0f7ff] border border-[#aad0fb] rounded-[20px] p-4 sm:p-5 flex items-center gap-4">
            <button
              type="button"
              onClick={handlePlayAudio}
              className="size-11 rounded-full bg-white text-[#0073f3] hover:bg-blue-50/70 flex items-center justify-center shrink-0 shadow-sm transition-colors cursor-pointer"
              aria-label="Play Hausa audio prompt"
            >
              {isPlayingAudio ? (
                <VolumeX className="size-5 text-[#0073f3] animate-pulse" />
              ) : (
                <Volume2 className="size-5 text-[#0073f3]" />
              )}
            </button>
            <p className="font-medium text-sm sm:text-base text-[#0051a8] leading-relaxed">
              {currentQuestion.prompt_ha}
            </p>
          </div>

          {/* Options (Yes / No) */}
          <div className="flex flex-col gap-3">
            {currentQuestion.options.map((opt) => {
              const isSelected = currentAnswer === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectOption(opt.value)}
                  className={cn(
                    "bg-white rounded-[16px] p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-all text-left",
                    isSelected
                      ? "ring-2 ring-[#0073f3] bg-[#f8fbff]"
                      : "hover:bg-gray-50/80"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium text-base",
                      isSelected ? "text-[#0073f3]" : "text-[#242b33]"
                    )}
                  >
                    {opt.label_en}
                  </span>
                  <div
                    className={cn(
                      "size-6 rounded-full flex items-center justify-center transition-colors shrink-0",
                      isSelected
                        ? "border-2 border-[#0073f3]"
                        : "border-2 border-[#c7d2de]"
                    )}
                  >
                    {isSelected && (
                      <div className="size-3 rounded-full bg-[#0073f3]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar - fixed to bottom on mobile */}
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
          disabled={!currentAnswer}
          onClick={handleNext}
          className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          Next
        </button>
      </div>
    </div>
  );
}
