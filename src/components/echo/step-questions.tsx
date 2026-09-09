"use client";

import { useMemo, useState } from "react";
import { useActiveQuestionSet } from "@/lib/queries/reference";
import {
  resolveVisibleQuestions,
  findSupersededAnswerCodes,
} from "@/lib/logic/conditions";
import { syncController } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

interface QuestionRow {
  id: string;
  code: string;
  type: string;
  prompt_en: string;
  prompt_ha: string;
  help_en: string | null;
  display_order: number;
  show_when: unknown;
  is_required: boolean;
}

export function StepQuestions({
  syndromeId,
  encounterId,
  onComplete,
}: {
  syndromeId: string;
  encounterId: string;
  onComplete: (questionSetId: string, answers: Record<string, unknown>) => void;
}) {
  const { data, isLoading } = useActiveQuestionSet(syndromeId);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    if (!data) return [];
    return resolveVisibleQuestions(
      data.questions.map((q) => ({
        code: q.code,
        display_order: q.display_order,
        show_when: q.show_when as never,
      })),
      answers,
    );
  }, [data, answers]);

  if (isLoading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }

  const questions = data.questions as unknown as QuestionRow[];
  const current = visible[index]
    ? questions.find((q) => q.code === visible[index].code)
    : null;

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          No questions are configured for this syndrome yet.
        </p>
        <Button onClick={() => onComplete(data.questionSetId, answers)}>
          Continue
        </Button>
      </div>
    );
  }

  const questionSetId = data.questionSetId;
  const options = data.options.filter((o) => o.question_id === current.id);
  const progress = Math.round(
    ((index + 1) / Math.max(visible.length, 1)) * 100,
  );

  async function persistAndAdvance(value: unknown) {
    setSaving(true);
    const nextAnswers = { ...answers, [current!.code]: value };

    // Downstream answers that become hidden by this change must be marked
    // superseded, never used for triage (PRD 5.6).
    const superseded = findSupersededAnswerCodes(
      questions.map((q) => ({
        code: q.code,
        display_order: q.display_order,
        show_when: q.show_when as never,
      })),
      nextAnswers,
    );
    for (const code of superseded) delete nextAnswers[code];

    setAnswers(nextAnswers);

    const answerId = crypto.randomUUID();
    try {
      await syncController.enqueueAndSync(
        "encounter_answer",
        answerId,
        "insert",
        {
          id: answerId,
          encounter_id: encounterId,
          question_id: current!.id,
          value,
          client_updated_at: new Date().toISOString(),
        },
      );
    } finally {
      setSaving(false);
    }

    if (index + 1 >= visible.length) {
      onComplete(questionSetId, nextAnswers);
    } else {
      setIndex(index + 1);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIndex(index - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
        <Progress value={progress} className="flex-1" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div>
            <p className="text-base font-medium">{current.prompt_en}</p>
            <p className="text-sm text-muted-foreground">{current.prompt_ha}</p>
            {current.help_en && (
              <p className="mt-1 text-xs text-muted-foreground">
                {current.help_en}
              </p>
            )}
          </div>

          <QuestionInput
            type={current.type}
            options={options}
            value={answers[current.code]}
            disabled={saving}
            onAnswer={persistAndAdvance}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionInput({
  type,
  options,
  value,
  disabled,
  onAnswer,
}: {
  type: string;
  options: { id: string; value: string; label_en: string }[];
  value: unknown;
  disabled: boolean;
  onAnswer: (value: unknown) => void;
}) {
  const [text, setText] = useState(typeof value === "string" ? value : "");
  const [num, setNum] = useState(
    typeof value === "number" ? String(value) : "",
  );

  if (type === "boolean") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={value === true ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onAnswer(true)}
        >
          Yes
        </Button>
        <Button
          variant={value === false ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onAnswer(false)}
        >
          No
        </Button>
      </div>
    );
  }

  if (type === "severity_0_10") {
    return (
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, i) => i).map((n) => (
          <Button
            key={n}
            size="sm"
            variant={value === n ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onAnswer(n)}
            className={cn("tabular-nums")}
          >
            {n}
          </Button>
        ))}
      </div>
    );
  }

  if (type === "integer" || type === "decimal") {
    return (
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode={type === "integer" ? "numeric" : "decimal"}
          value={num}
          onChange={(e) => setNum(e.target.value)}
        />
        <Button
          disabled={disabled || num === ""}
          onClick={() =>
            onAnswer(type === "integer" ? parseInt(num, 10) : parseFloat(num))
          }
        >
          Next
        </Button>
      </div>
    );
  }

  if (type === "short_text" || type === "long_text") {
    const Field = type === "short_text" ? Input : Textarea;
    return (
      <div className="flex flex-col gap-2">
        <Field value={text} onChange={(e) => setText(e.target.value)} />
        <Button disabled={disabled} onClick={() => onAnswer(text)}>
          Next
        </Button>
      </div>
    );
  }

  if (type === "single_select") {
    return (
      <div className="flex flex-col gap-2">
        {options.map((o) => (
          <Button
            key={o.id}
            variant={value === o.value ? "default" : "outline"}
            disabled={disabled}
            className="justify-start"
            onClick={() => onAnswer(o.value)}
          >
            {o.label_en}
          </Button>
        ))}
      </div>
    );
  }

  if (type === "multi_select") {
    return (
      <MultiSelectInput
        options={options}
        initial={value}
        disabled={disabled}
        onAnswer={onAnswer}
      />
    );
  }

  return null;
}

function MultiSelectInput({
  options,
  initial,
  disabled,
  onAnswer,
}: {
  options: { id: string; value: string; label_en: string }[];
  initial: unknown;
  disabled: boolean;
  onAnswer: (value: unknown) => void;
}) {
  const [selectedValues, setSelectedValues] = useState<string[]>(
    Array.isArray(initial) ? (initial as string[]) : [],
  );

  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const isSelected = selectedValues.includes(o.value);
        return (
          <Button
            key={o.id}
            variant={isSelected ? "default" : "outline"}
            disabled={disabled}
            className="justify-start"
            onClick={() =>
              setSelectedValues((prev) =>
                isSelected
                  ? prev.filter((v) => v !== o.value)
                  : [...prev, o.value],
              )
            }
          >
            {o.label_en}
          </Button>
        );
      })}
      <Button disabled={disabled} onClick={() => onAnswer(selectedValues)}>
        Next
      </Button>
    </div>
  );
}
