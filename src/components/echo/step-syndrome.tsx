"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DANGER_SIGNS,
  DEHYDRATION_OPTIONS,
  dangerSignsToSyndromes,
  type DehydrationLevel,
} from "@/lib/reference/individual-symptoms";
import {
  AlertTriangle,
  Mic,
  Camera,
  Check,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const IDSR_CATEGORIES = [
  {
    code: "CATEGORY_4",
    label_en: "Category 4: Unusual Health Event / Novel Cluster",
    label_ha: "Rukuni na 4: Alamun da ba a saba gani ba / Cutar da ba a sani ba",
    desc: "Unexplained symptoms, novel presentation, unexpected deaths, or sudden cluster of ill patients",
  },
  {
    code: "CATEGORY_1",
    label_en: "Category 1: Epidemic-Prone Outbreak",
    label_ha: "Rukuni na 1: Cutar da ke yaduwa da sauri",
    desc: "Suspected outbreak disease (e.g. cholera, hemorrhagic fever, measles)",
  },
  {
    code: "CATEGORY_2",
    label_en: "Category 2: Eradication / Elimination Priority",
    label_ha: "Rukuni na 2: Cutar da ake kokarin kawarwa",
    desc: "Acute flaccid paralysis (polio), neonatal tetanus",
  },
  {
    code: "CATEGORY_3",
    label_en: "Category 3: Other Condition of Public Health Concern",
    label_ha: "Rukuni na 3: Sauran cututtuka masu muhimmanci",
    desc: "Severe malaria, unusual respiratory distress, other severe presentations",
  },
];

interface StepSyndromeProps {
  sessionCode?: string;
  onSelect: (
    symptomCodes: string[],
    syndromeIds: string[],
    labels: string[]
  ) => void;
  onPrevious?: () => void;
}

export function StepSyndrome({
  sessionCode,
  onSelect,
  onPrevious,
}: StepSyndromeProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [dehydration, setDehydration] = useState<DehydrationLevel>("no");

  // Unusual symptoms state
  const [hasUnusual, setHasUnusual] = useState(false);
  const [idsrCategory, setIdsrCategory] = useState<string>("CATEGORY_4");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceRecorded, setVoiceRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [unusualNotes, setUnusualNotes] = useState("");

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const handleToggleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setVoiceRecorded(true);
      toast.success("Voice note recorded");
    } else {
      setIsRecording(true);
      setRecordingSeconds(0);
      const interval = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 6) {
            clearInterval(interval);
            setIsRecording(false);
            setVoiceRecorded(true);
            toast.success("Voice note recorded");
            return 6;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoDataUrl(event.target?.result as string);
      toast.success("Photo attached");
    };
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    if (hasUnusual && !idsrCategory) {
      setCategoryError("Please select an IDSR category to report an unusual symptom.");
      toast.error("An IDSR category is required for unusual symptoms");
      return;
    }

    const codes = Array.from(checked);
    let syndromeIds = dangerSignsToSyndromes(codes, dehydration);

    if (hasUnusual && idsrCategory) {
      if (!syndromeIds.includes("OTHER_PRIORITY")) {
        syndromeIds = [...syndromeIds, "OTHER_PRIORITY"];
      }
    }

    let allCodes =
      dehydration !== "no"
        ? [...codes, `DEHYDRATION_${dehydration.toUpperCase()}`]
        : codes;

    if (hasUnusual && idsrCategory) {
      allCodes = [...allCodes, `UNUSUAL_${idsrCategory}`];
    }

    const labels = [
      ...codes.map(
        (c) => DANGER_SIGNS.find((s) => s.code === c)?.label_en ?? c
      ),
      ...(dehydration !== "no"
        ? [
            DEHYDRATION_OPTIONS.find((o) => o.value === dehydration)
              ?.label_en ?? "Dehydration",
          ]
        : []),
      ...(hasUnusual && idsrCategory
        ? [
            IDSR_CATEGORIES.find((c) => c.code === idsrCategory)?.label_en ??
              "Unusual Health Event",
          ]
        : []),
    ];

    onSelect(allCodes, syndromeIds, labels);
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Eyebrow & Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Syndromic Screening
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Check danger signs</span> · Alamun hatsari
            </h2>
            <p className="text-sm sm:text-base text-[#6e8298]">
              Tick all symptoms observed or reported, even if mild or unsure.
            </p>
          </div>

          {/* ── Section 1: Danger Signs ─────────────────────────────── */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-4 shadow-none">
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33]">
                Danger Signs (Select all that apply)
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">
                Alamomin hatsari da aka lura da su
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DANGER_SIGNS.map((sign) => {
                const isChecked = checked.has(sign.code);
                return (
                  <button
                    key={sign.id}
                    type="button"
                    id={`danger-sign-${sign.code.toLowerCase()}`}
                    onClick={() => toggle(sign.code)}
                    className={cn(
                      "w-full rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                      isChecked
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={cn("text-sm sm:text-base leading-snug truncate", isChecked ? "font-semibold" : "font-medium")}>
                        {sign.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                        {sign.label_ha}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "size-5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-[#0073f3] border-[#0073f3] text-white"
                          : "border-[#c7d2de] bg-white"
                      )}
                    >
                      {isChecked && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Section 2: Dehydration ──────────────────────────────── */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-4 shadow-none">
            <div className="flex flex-col gap-0.5">
              <label className="text-sm sm:text-base font-medium text-[#242b33]">
                Dehydration Level
              </label>
              <p className="text-xs sm:text-sm text-[#6e8298]">
                Rashin ruwa a jiki
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DEHYDRATION_OPTIONS.map((opt) => {
                const isSel = dehydration === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    id={`dehydration-${opt.value}`}
                    onClick={() => setDehydration(opt.value)}
                    className={cn(
                      "w-full rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                      isSel
                        ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] shadow-sm ring-1 ring-[#0073f3]"
                        : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#fafafa]"
                    )}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className={cn("text-sm sm:text-base leading-snug", isSel ? "font-semibold" : "font-normal")}>
                        {opt.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] font-normal leading-tight mt-0.5">
                        {opt.label_ha}
                      </span>
                    </div>

                    <div
                      className={cn(
                        "size-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSel
                          ? "bg-[#0073f3] border-[#0073f3] text-white"
                          : "border-[#c7d2de] bg-white"
                      )}
                    >
                      {isSel && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Section 3: Unusual Symptoms (IDSR Category) ─────────── */}
          <div className="bg-white rounded-[16px] p-5 sm:p-6 border border-[#e4e8ec] flex flex-col gap-4 shadow-none">
            <button
              type="button"
              id="unusual-symptom-toggle"
              onClick={() => {
                setHasUnusual(!hasUnusual);
                setCategoryError(null);
              }}
              className={cn(
                "w-full rounded-[14px] p-4 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                hasUnusual
                  ? "border-[#f59e0b] bg-[#fffbeb] text-[#92400e]"
                  : "border-[#e4e8ec] bg-white hover:bg-[#fafafa]"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "size-10 rounded-[10px] flex items-center justify-center shrink-0",
                    hasUnusual
                      ? "bg-[#fde68a] text-[#b45309]"
                      : "bg-[#f2f3f5] text-[#6e8298]"
                  )}
                >
                  <AlertTriangle className="size-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm sm:text-base font-semibold leading-tight">
                    Unusual Symptom / Health Event
                  </span>
                  <span className="text-xs text-[#6e8298] leading-tight mt-0.5">
                    Wata cuta ko alamun da ba a saba gani ba (IDSR Tier 4)
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  "size-5 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors",
                  hasUnusual
                    ? "bg-[#f59e0b] border-[#f59e0b] text-white"
                    : "border-[#c7d2de] bg-white"
                )}
              >
                {hasUnusual && <Check className="size-3 stroke-[3]" />}
              </div>
            </button>

            {/* Expanded Unusual Symptoms form */}
            {hasUnusual && (
              <div className="bg-[#fafafa] border border-[#fde68a] rounded-[14px] p-4 sm:p-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#242b33]">
                    IDSR Category <span className="text-[#e05338]">* Required</span>
                  </label>
                  <p className="text-xs text-[#6e8298]">
                    Select the official public health surveillance category for this presentation.
                  </p>

                  <div className="grid gap-2 pt-1">
                    {IDSR_CATEGORIES.map((cat) => {
                      const isSel = idsrCategory === cat.code;
                      return (
                        <button
                          key={cat.code}
                          type="button"
                          id={`idsr-category-${cat.code.toLowerCase()}`}
                          onClick={() => {
                            setIdsrCategory(cat.code);
                            setCategoryError(null);
                          }}
                          className={cn(
                            "w-full rounded-[12px] p-3 text-left border transition-all cursor-pointer flex items-start justify-between gap-3",
                            isSel
                              ? "border-[#0073f3] bg-[#f0f7ff] text-[#0073f3] font-medium"
                              : "border-[#e4e8ec] bg-white hover:bg-gray-50 text-[#242b33]"
                          )}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold leading-tight">{cat.label_en}</span>
                            <span className="text-[11px] text-[#6e8298] leading-tight">{cat.label_ha}</span>
                            <span className="text-[11px] text-[#8e8e8e] mt-0.5 leading-tight">{cat.desc}</span>
                          </div>
                          {isSel && (
                            <div className="size-4 rounded-full bg-[#0073f3] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="size-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {categoryError && (
                    <p className="text-xs text-[#e05338] font-medium mt-1">
                      {categoryError}
                    </p>
                  )}
                </div>

                {/* Evidence attachments */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#e4e8ec]">
                  <span className="text-xs font-semibold text-[#242b33]">
                    Clinical Evidence (Optional voice note or photo)
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Voice Note */}
                    <div className="flex flex-col gap-1">
                      {!voiceRecorded ? (
                        <button
                          type="button"
                          id="record-voice-note-btn"
                          onClick={handleToggleVoiceRecord}
                          className={cn(
                            "h-[46px] rounded-[12px] px-3 flex items-center justify-center gap-2 border text-xs sm:text-sm font-medium transition-all cursor-pointer",
                            isRecording
                              ? "bg-[#fee2e2] border-[#ef4444] text-[#b91c1c] animate-pulse"
                              : "bg-white border-[#e4e8ec] text-[#495766] hover:bg-[#fafafa]"
                          )}
                        >
                          <Mic className="size-4 shrink-0" />
                          <span>{isRecording ? `Recording (${recordingSeconds}s)...` : "Voice Note"}</span>
                        </button>
                      ) : (
                        <div className="h-[46px] rounded-[12px] px-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="size-4 text-[#22c55e] shrink-0" />
                            <span className="truncate">Voice ({recordingSeconds || 6}s)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setVoiceRecorded(false);
                              setRecordingSeconds(0);
                            }}
                            className="text-[#991b1b] hover:text-[#b91c1c] cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Photo Attach */}
                    <div className="flex flex-col gap-1">
                      {!photoDataUrl ? (
                        <label
                          htmlFor="photo-upload-input"
                          className="h-[46px] rounded-[12px] px-3 bg-white border border-[#e4e8ec] text-[#495766] hover:bg-[#fafafa] flex items-center justify-center gap-2 text-xs sm:text-sm font-medium transition-all cursor-pointer"
                        >
                          <Camera className="size-4 shrink-0" />
                          <span>Attach Photo</span>
                          <input
                            id="photo-upload-input"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="h-[46px] rounded-[12px] px-3 bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534] flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="size-4 text-[#22c55e] shrink-0" />
                            <span>Photo attached</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPhotoDataUrl(null)}
                            className="text-[#991b1b] hover:text-[#b91c1c] cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea
                    value={unusualNotes}
                    onChange={(e) => setUnusualNotes(e.target.value)}
                    placeholder="Describe unusual symptoms or clinical observations..."
                    rows={2}
                    className="w-full bg-white rounded-[12px] border border-[#e4e8ec] p-3 text-xs sm:text-sm text-[#242b33] placeholder:text-[#a1aebc] outline-none focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all resize-none mt-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Actions Bar ──────────────────────────────────────── */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Danger Signs
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-[12px] border border-[#e4e8ec] bg-white hover:bg-[#fafafa] text-[#495766] px-5 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
            >
              Previous
            </button>
          )}
          <button
            type="button"
            id="symptom-continue-btn"
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Continue to questions
            {(checked.size > 0 || hasUnusual) && (
              <span className="ml-2 text-xs font-normal opacity-80">
                ({checked.size + (hasUnusual ? 1 : 0)} selected)
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
