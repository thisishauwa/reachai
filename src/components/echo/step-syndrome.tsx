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

/**
 * AC3 — "Check danger signs" screen matching the Sentinel stakeholder prototype.
 *
 * Section 1 — Danger signs · alamun hatsari
 *   6 checkboxes, select all that apply.
 *
 * Section 2 — Dehydration · rashin ruwa
 *   Separate sub-section: No / Mild / moderate / Severe
 *
 * AC4 — Unusual symptoms:
 *   - The user must pick an IDSR category (required; blocks submission if missing).
 *   - Optional voice note or photo note can be added.
 */

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

  // AC4 state
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
    // AC4 Edge Case: Unusual symptom without an IDSR category: show an inline error and block submission
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

    // Include dehydration in codes so backend / questions step knows
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
    <div className="w-full flex flex-col gap-0 bg-[#f2f3f0] min-h-screen">
      <div className="flex flex-col gap-6 p-5 sm:p-8 pb-32">
        {/* Heading */}
        <div className="flex flex-col gap-1">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6e8298]">
            MODULE B+ · Danger signs
          </p>
          <h2 className="text-[26px] sm:text-[30px] font-bold text-[#1a1a1a] leading-tight">
            Check danger signs
          </h2>
          <p className="text-[14px] text-[#6e8298]">
            Alamun hatsari · danger signs. Tick what you notice, even if you are unsure.
          </p>
        </div>

        {/* ── Section 1: Danger signs checkboxes ──────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#1a1a1a]">
              Danger signs · alamun hatsari
            </span>
            <span className="text-[13px] text-[#6e8298]">Select all that apply</span>
          </div>

          <div className="flex flex-col gap-2">
            {DANGER_SIGNS.map((sign) => {
              const isChecked = checked.has(sign.code);
              return (
                <button
                  key={sign.id}
                  type="button"
                  id={`danger-sign-${sign.code.toLowerCase()}`}
                  onClick={() => toggle(sign.code)}
                  className={cn(
                    "w-full bg-white rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
                    isChecked
                      ? "border-[#1a8f76] ring-1 ring-[#1a8f76]"
                      : "border-[#e4e8ec] hover:bg-[#f9f9f9]"
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] font-semibold text-[#1a1a1a] leading-snug">
                      {sign.label_en}
                    </span>
                    <span className="text-[13px] text-[#6e8298]">
                      {sign.label_ha}
                    </span>
                  </div>

                  {/* Checkbox */}
                  <div
                    className={cn(
                      "size-6 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all",
                      isChecked
                        ? "border-[#1a8f76] bg-[#1a8f76]"
                        : "border-[#c7d2de] bg-white"
                    )}
                  >
                    {isChecked && (
                      <svg viewBox="0 0 12 9" fill="none" className="size-3">
                        <path
                          d="M1 4.5L4.5 8L11 1"
                          stroke="white"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 2: Dehydration sub-section ──────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#1a1a1a]">
              Dehydration · rashin ruwa
            </span>
            <span className="text-[13px] text-[#6e8298]">Mild, moderate, or severe</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {DEHYDRATION_OPTIONS.map((opt) => {
              const sel = dehydration === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  id={`dehydration-${opt.value}`}
                  onClick={() => setDehydration(opt.value)}
                  className={cn(
                    "min-h-[52px] w-full rounded-[14px] px-4 py-3 text-left text-[14px] font-medium",
                    "flex items-center justify-between gap-2",
                    "border transition-all cursor-pointer",
                    sel
                      ? "border-[#1a8f76] bg-[#e8f5f2] text-[#1a8f76]"
                      : "border-[#e4e8ec] bg-white text-[#242b33] hover:bg-[#f9f9f9]"
                  )}
                >
                  <span>{opt.label_en}</span>
                  {sel && (
                    <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
                      <path
                        d="M3 8.5L6.5 12L13 5"
                        stroke="#1a8f76"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: Unusual Symptoms (AC4) ──────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-[#1a1a1a]">
              Unusual symptoms · alamun da ba a saba gani ba
            </span>
            <span className="text-[13px] text-[#6e8298]">
              Flag unexpected symptoms, clusters, or conditions requiring public health surveillance
            </span>
          </div>

          {/* Toggle button */}
          <button
            type="button"
            id="toggle-unusual-symptom-btn"
            onClick={() => {
              setHasUnusual(!hasUnusual);
              if (categoryError) setCategoryError(null);
            }}
            className={cn(
              "w-full bg-white rounded-[14px] px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-all cursor-pointer border",
              hasUnusual
                ? "border-[#d97706] ring-1 ring-[#d97706] bg-[#fffbeb]"
                : "border-[#e4e8ec] hover:bg-[#f9f9f9]"
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "size-9 rounded-[10px] flex items-center justify-center shrink-0",
                  hasUnusual
                    ? "bg-[#fef3c7] text-[#d97706]"
                    : "bg-[#f1f5f9] text-[#64748b]"
                )}
              >
                <AlertTriangle className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[15px] font-semibold text-[#1a1a1a] leading-snug">
                  Report unusual symptom or novel cluster
                </span>
                <span className="text-[13px] text-[#6e8298]">
                  Bayar da rahoton alamar da ba a saba gani ba
                </span>
              </div>
            </div>

            <div
              className={cn(
                "size-6 rounded-[6px] border-2 flex items-center justify-center shrink-0 transition-all",
                hasUnusual
                  ? "border-[#d97706] bg-[#d97706]"
                  : "border-[#c7d2de] bg-white"
              )}
            >
              {hasUnusual && (
                <svg viewBox="0 0 12 9" fill="none" className="size-3">
                  <path
                    d="M1 4.5L4.5 8L11 1"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </button>

          {/* Expanded Unusual Symptoms form */}
          {hasUnusual && (
            <div className="bg-white border border-[#fde68a] rounded-[16px] p-4 sm:p-5 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
              {/* IDSR Category selection (Required by AC4) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[14px] font-semibold text-[#1a1a1a]">
                    IDSR Category <span className="text-[#e05338]">* Required</span>
                  </label>
                  <span className="text-[11px] text-[#6e8298] uppercase font-bold tracking-wider">
                    Surveillance Tier
                  </span>
                </div>
                <p className="text-[12px] text-[#6e8298]">
                  Select the official surveillance category for this unusual presentation.
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
                          "w-full rounded-[12px] px-3.5 py-3 text-left border transition-all cursor-pointer flex items-start justify-between gap-3",
                          isSel
                            ? "border-[#d97706] bg-[#fef3c7] text-[#92400e]"
                            : "border-[#e4e8ec] bg-[#fafafa] hover:bg-[#f1f5f9] text-[#242b33]"
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-semibold">{cat.label_en}</span>
                          <span className="text-[11px] opacity-75">{cat.label_ha}</span>
                          <span className="text-[11px] text-[#64748b] mt-0.5">{cat.desc}</span>
                        </div>
                        {isSel && (
                          <div className="size-5 rounded-full bg-[#d97706] text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="size-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {categoryError && (
                  <p className="text-[12px] text-[#e05338] font-medium mt-1">
                    {categoryError}
                  </p>
                )}
              </div>

              {/* Optional Voice Note & Photo (AC4) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#f1f5f9]">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#1a1a1a]">
                    Clinical Evidence <span className="text-[#6e8298] font-normal">(Optional)</span>
                  </span>
                  <span className="text-[11px] text-[#6e8298]">Voice or photo note</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Voice Note */}
                  <div className="flex flex-col gap-1">
                    {!voiceRecorded ? (
                      <button
                        type="button"
                        id="record-voice-note-btn"
                        onClick={handleToggleVoiceRecord}
                        className={cn(
                          "h-[48px] rounded-[12px] px-3 flex items-center justify-center gap-2 border text-[13px] font-medium transition-all cursor-pointer",
                          isRecording
                            ? "bg-[#fee2e2] border-[#ef4444] text-[#b91c1c] animate-pulse"
                            : "bg-[#f8fafc] border-[#e2e8f0] text-[#334155] hover:bg-[#f1f5f9]"
                        )}
                      >
                        <Mic className={cn("size-4", isRecording && "text-[#ef4444]")} />
                        <span>{isRecording ? `Recording ${recordingSeconds}s...` : "Voice Note"}</span>
                      </button>
                    ) : (
                      <div className="h-[48px] rounded-[12px] px-3 bg-[#e8f5f2] border border-[#1a8f76] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[#1a8f76] text-[12px] font-medium">
                          <CheckCircle2 className="size-4" />
                          <span>Voice note (0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVoiceRecorded(false);
                            setRecordingSeconds(0);
                          }}
                          className="size-6 text-[#ef4444] hover:bg-[#fee2e2] rounded-full flex items-center justify-center cursor-pointer"
                          aria-label="Remove voice note"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Photo Note */}
                  <div className="flex flex-col gap-1">
                    {!photoDataUrl ? (
                      <label
                        id="add-photo-note-label"
                        className="h-[48px] rounded-[12px] px-3 flex items-center justify-center gap-2 border border-[#e2e8f0] bg-[#f8fafc] text-[#334155] hover:bg-[#f1f5f9] text-[13px] font-medium transition-all cursor-pointer"
                      >
                        <Camera className="size-4 text-[#64748b]" />
                        <span>Add Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="h-[48px] rounded-[12px] px-2 bg-[#e8f5f2] border border-[#1a8f76] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photoDataUrl}
                            alt="Attached note"
                            className="size-8 rounded-[6px] object-cover shrink-0 border"
                          />
                          <span className="text-[12px] text-[#1a8f76] font-medium truncate">
                            Photo attached
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPhotoDataUrl(null)}
                          className="size-6 text-[#ef4444] hover:bg-[#fee2e2] rounded-full flex items-center justify-center cursor-pointer shrink-0"
                          aria-label="Remove photo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional Description */}
              <div className="flex flex-col gap-1">
                <label className="text-[12px] font-medium text-[#475569]">
                  Notes / Description <span className="text-[#94a3b8]">(Optional)</span>
                </label>
                <textarea
                  value={unusualNotes}
                  onChange={(e) => setUnusualNotes(e.target.value)}
                  placeholder="Describe unusual rash pattern, sudden cluster of cases, or other observations..."
                  rows={2}
                  className="w-full bg-[#f8fafc] rounded-[10px] border border-[#e2e8f0] p-2.5 text-[13px] text-[#1a1a1a] placeholder:text-[#94a3b8] outline-none focus:ring-2 focus:ring-[#d97706] resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar — fixed ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-5 py-4 bg-[#f2f3f0] border-t border-[#e4e8ec]">
        {onPrevious ? (
          <button
            type="button"
            onClick={onPrevious}
            className="size-11 rounded-full bg-white border border-[#e4e8ec] text-[#6e8298] flex items-center justify-center hover:bg-[#f9f9f9] transition-colors cursor-pointer"
            aria-label="Go back"
          >
            ←
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          id="symptom-continue-btn"
          onClick={handleContinue}
          className="flex-1 max-w-xs h-12 rounded-[14px] bg-[#1a3a34] hover:bg-[#142e28] text-white font-semibold text-[15px] transition-colors cursor-pointer"
        >
          Continue
          {(checked.size > 0 || hasUnusual) && (
            <span className="ml-2 text-[13px] opacity-70">
              ({checked.size + (hasUnusual ? 1 : 0)} selected)
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
