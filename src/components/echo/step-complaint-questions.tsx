"use client";

import { useMemo, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { syncController } from "@/lib/offline/sync";
import { useSession } from "@/lib/session/session-context";
import {
  COMPLAINT_AREAS,
  hasComplaintAnswer,
  visibleComplaintQuestions,
  type ComplaintAnswer,
  type ComplaintAreaCode,
  type DisplayQuestion,
} from "@/lib/reference/complaint-questions";

function QuestionCard({
  question,
  answer,
  showError,
  caregiverReported,
  onAnswer,
}: {
  question: DisplayQuestion;
  answer?: ComplaintAnswer;
  showError: boolean;
  caregiverReported: boolean;
  onAnswer: (answer: ComplaintAnswer) => void;
}) {
  const selectedValues = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
  const choices = caregiverReported && !question.multiple && !question.options.some((choice) => choice.value === "unknown")
    ? [...question.options, { value: "unknown", label: "Don't know", label_ha: "Ban sani ba" }]
    : question.options;

  const selectOption = (value: string) => {
    if (!question.multiple) {
      onAnswer(value);
      return;
    }
    if (value === "none") {
      onAnswer(["none"]);
      return;
    }
    const next = new Set(selectedValues);
    next.delete("none");
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onAnswer([...next]);
  };

  return (
    <fieldset className={cn("rounded-[16px] border bg-white p-4 sm:p-5 flex flex-col gap-3", showError ? "border-[#d44424]" : "border-[#e4e8ec]") }>
      <legend className="sr-only">{question.prompt_en}</legend>
      <div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 rounded-full bg-[#eef5fc] px-2 py-0.5 text-[10px] font-semibold text-[#4c6f91] shrink-0">{question.id}</span>
          <p className="text-sm sm:text-base font-medium text-[#242b33]">{question.prompt_en}</p>
        </div>
        <p className="text-xs text-[#6e8298] mt-1">{question.prompt_ha}</p>
      </div>
      <div className={cn("grid gap-2", choices.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
        {choices.map((choice) => {
          const selected = selectedValues.has(choice.value);
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={selected}
              onClick={() => selectOption(choice.value)}
              className={cn(
                "min-h-11 rounded-[12px] border px-3 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 text-center",
                selected ? "bg-[#e8f2ff] border-[#0073f3] text-[#0051a8] ring-1 ring-[#0073f3]" : "bg-white border-[#d8e0e7] text-[#242b33]",
              )}
            >
              {question.multiple && <span className={cn("size-5 rounded-[5px] border flex items-center justify-center shrink-0", selected ? "bg-[#0073f3] border-[#0073f3] text-white" : "border-[#b8c5d1]")}>{selected && <Check className="size-3 stroke-[3]" />}</span>}
              <span>{choice.label}<span className="block text-[10px] opacity-70">{choice.label_ha}</span></span>
            </button>
          );
        })}
      </div>
      {showError && <p className="text-xs font-medium text-[#d44424]">Required — choose an answer.</p>}
    </fieldset>
  );
}

interface StepComplaintQuestionsProps {
  area: ComplaintAreaCode;
  ageBand: string;
  encounterId: string;
  caregiverReported?: boolean;
  initialAnswers?: Record<string, ComplaintAnswer>;
  onComplete: (questionSetId: string, answers: Record<string, ComplaintAnswer>) => void;
  onPrevious?: () => void;
}

export function StepComplaintQuestions({ area, ageBand, encounterId, caregiverReported = false, initialAnswers = {}, onComplete, onPrevious }: StepComplaintQuestionsProps) {
  const { userId } = useSession();
  const [answers, setAnswers] = useState<Record<string, ComplaintAnswer>>(initialAnswers);
  const questions = useMemo(() => visibleComplaintQuestions(area, answers, ageBand), [ageBand, area, answers]);
  const hasStarted = Object.keys(answers).length > 0;
  const allAnswered = questions.length > 0 && questions.every((question) => hasComplaintAnswer(answers[question.answerKey]));
  const areaLabel = COMPLAINT_AREAS.find((item) => item.code === area)?.label_en ?? area;
  const baseQuestions = questions.filter((question) => !question.bridgeFrom);
  const bridgeA7 = questions.filter((question) => question.bridgeFrom === "A7");
  const bridgeA8 = questions.filter((question) => question.bridgeFrom === "A8");

  const setAnswer = (key: string, value: ComplaintAnswer) => setAnswers((current) => {
    const next = { ...current, [key]: value };
    if (key === "DIARRHOEA_OR_VOMITING" && value !== "yes") {
      delete next.WATERY_STOOL_COUNT;
      delete next.BLOOD_OR_MUCUS_STOOL;
      delete next.RICE_WATER_STOOL;
      delete next.DEHYDRATION_SIGNS;
    }
    if (key === "COUGH_PRESENT" && value !== "yes") {
      delete next.COUGH_DURATION;
      delete next.BLOOD_IN_SPUTUM;
      delete next.WEIGHT_LOSS_OR_NIGHT_SWEATS;
    }
    return next;
  });

  const handleSubmit = async () => {
    if (!allAnswered) return;
    for (const question of questions) {
      try {
        const answerId = crypto.randomUUID();
        await syncController.enqueue("encounter_answer", answerId, "insert", {
          id: answerId,
          encounter_id: encounterId,
          question_id: question.answerKey,
          value: { answer: answers[question.answerKey], display_id: question.id, complaint_area: area },
          answered_by: userId,
          client_updated_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn("Complaint answer queue note:", error);
      }
    }
    onComplete(`complaint_${area}`, answers);
  };

  const renderQuestions = (items: DisplayQuestion[]) => items.map((item) => (
    <QuestionCard
      key={`${item.id}-${item.answerKey}`}
      question={item}
      answer={answers[item.answerKey]}
      showError={hasStarted && !hasComplaintAnswer(answers[item.answerKey])}
      caregiverReported={caregiverReported}
      onAnswer={(value) => setAnswer(item.answerKey, value)}
    />
  ));

  return (
    <div className="w-full flex flex-col gap-6 pb-28">
      <div className="rounded-[20px] bg-[#f9f9f9] p-5 sm:p-10 flex flex-col gap-5">
        <div>
          <p className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">Step 5 of 6 · Questions</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#001f3e] mt-1">{areaLabel}</h2>
          <p className="text-sm text-[#6e8298] mt-1">Answer each question to continue.</p>
          <p className="text-xs text-[#8a99a8] mt-0.5">Amsa kowace tambaya domin ci gaba.</p>
        </div>
        <div className="flex flex-col gap-4">{renderQuestions(baseQuestions)}</div>

        {bridgeA7.length > 0 && (
          <section className="rounded-[18px] border border-[#cfd8e1] bg-[#eef1f4] p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex gap-3"><Link2 className="size-5 text-[#596b7c] shrink-0" /><div><p className="font-semibold text-[#354554]">A few related questions</p><p className="text-sm text-[#596b7c]">You mentioned diarrhoea or vomiting. These answers help choose the safest next step.</p><p className="text-xs text-[#596b7c] mt-1">Kun ambaci gudawa ko amai. Wadannan amsoshin za su taimaka wajen zabar mataki mafi aminci.</p></div></div>
            {renderQuestions(bridgeA7)}
          </section>
        )}

        {bridgeA8.length > 0 && (
          <section className="rounded-[18px] border border-[#cfd8e1] bg-[#eef1f4] p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex gap-3"><Link2 className="size-5 text-[#596b7c] shrink-0" /><div><p className="font-semibold text-[#354554]">A few related questions</p><p className="text-sm text-[#596b7c]">You mentioned a cough. These answers help choose the safest next step.</p><p className="text-xs text-[#596b7c] mt-1">Kun ambaci tari. Wadannan amsoshin za su taimaka wajen zabar mataki mafi aminci.</p></div></div>
            {renderQuestions(bridgeA8)}
          </section>
        )}
      </div>

      <div className="encounter-action-bar">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button type="button" onClick={handleSubmit} disabled={!allAnswered} className="min-h-11 rounded-[12px] bg-[#0073f3] px-6 sm:px-8 text-sm sm:text-base font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed">Continue to result</button>
      </div>
    </div>
  );
}
