"use client";

import { useState } from "react";
import {
  Thermometer,
  Droplet,
  Droplets,
  Frown,
  Accessibility,
  Wind,
  Eye,
  ShieldAlert,
  Baby,
  Stethoscope,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSyndromes } from "@/lib/queries/reference";
import { Skeleton } from "@/components/ui/skeleton";

interface StepSyndromeProps {
  encounterCode?: string;
  patientName?: string;
  patientCreatedAt?: string;
  isAnonymous?: boolean;
  sessionCode?: string;
  onSelect: (syndromeId: string, labelEn: string) => void;
  onPrevious?: () => void;
}

// Map syndrome codes to representative Lucide icons
function getSyndromeIcon(code: string) {
  switch (code.toUpperCase()) {
    case "FEVER_RASH":
      return <Thermometer className="size-5 text-[#0073f3]" />;
    case "ACUTE_WATERY_DIARRHOEA":
    case "ACUTE_WATERY_DIARRHEA":
      return <Droplet className="size-5 text-[#0073f3]" />;
    case "FEVER_BLEEDING":
      return <Droplets className="size-5 text-[#0073f3]" />;
    case "FEVER_NECK_STIFFNESS":
      return <Frown className="size-5 text-[#0073f3]" />;
    case "ACUTE_FLACCID_PARALYSIS":
      return <Accessibility className="size-5 text-[#0073f3]" />;
    case "ACUTE_RESPIRATORY_ILLNESS":
      return <Wind className="size-5 text-[#0073f3]" />;
    case "JAUNDICE":
      return <Eye className="size-5 text-[#0073f3]" />;
    case "COUGH_OVER_TWO_WEEKS":
      return <ShieldAlert className="size-5 text-[#0073f3]" />;
    case "NEONATAL_DANGER_SIGNS":
      return <Baby className="size-5 text-[#0073f3]" />;
    case "OTHER_PRIORITY":
    default:
      return <Stethoscope className="size-5 text-[#0073f3]" />;
  }
}

// Fallback list of 10 standard syndromes from Figma 0:1264 if database is loading or empty
const FALLBACK_SYNDROMES = [
  { id: "FEVER_RASH", code: "FEVER_RASH", label_en: "Fever with rash", label_ha: "Zazzabi da kurji" },
  { id: "ACUTE_WATERY_DIARRHOEA", code: "ACUTE_WATERY_DIARRHOEA", label_en: "Acute watery diarrhea", label_ha: "Gudawa mai ruwa-ruwa" },
  { id: "FEVER_BLEEDING", code: "FEVER_BLEEDING", label_en: "Fever with bleeding", label_ha: "Zazzabi da zubar jini" },
  { id: "FEVER_NECK_STIFFNESS", code: "FEVER_NECK_STIFFNESS", label_en: "Fever with neck stiffness", label_ha: "Zazzabi da tauri wuya" },
  { id: "ACUTE_FLACCID_PARALYSIS", code: "ACUTE_FLACCID_PARALYSIS", label_en: "Accute flaccid paralysis", label_ha: "Sanyin kafa ko hannu na gaggawa" },
  { id: "ACUTE_RESPIRATORY_ILLNESS", code: "ACUTE_RESPIRATORY_ILLNESS", label_en: "Accute respiratory illness", label_ha: "Ciwon numfashi na gaggawa" },
  { id: "JAUNDICE", code: "JAUNDICE", label_en: "Jaundice", label_ha: "Ciwon shawara" },
  { id: "COUGH_OVER_TWO_WEEKS", code: "COUGH_OVER_TWO_WEEKS", label_en: "Cough > 2 weeks", label_ha: "Tari na mako 2 ko fiye" },
  { id: "NEONATAL_DANGER_SIGNS", code: "NEONATAL_DANGER_SIGNS", label_en: "Neonatal danger signs", label_ha: "Alamomin hadari ga jariri" },
  { id: "OTHER_PRIORITY", code: "OTHER_PRIORITY", label_en: "Other priority syndrome", label_ha: "Sauran cututtuka masu mahimmanci" },
];

export function StepSyndrome({
  patientName = "Oyintari Werinipre",
  patientCreatedAt = "10 Aug 2023",
  isAnonymous = false,
  sessionCode,
  onSelect,
  onPrevious,
}: StepSyndromeProps) {
  const { data: dbSyndromes = [], isLoading } = useSyndromes();
  const syndromes = dbSyndromes.length > 0 ? dbSyndromes : FALLBACK_SYNDROMES;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hausaAudioOn, setHausaAudioOn] = useState(false);

  const handleNext = () => {
    if (!selectedId) return;
    const found = syndromes.find((s) => s.id === selectedId);
    if (found) {
      onSelect(found.id, found.label_en);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Section Eyebrow and Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Chief complaint
            </span>
            <h2 className="text-xl sm:text-2xl font-light text-[#001f3e] leading-snug">
              Select the patient and their primary reason for visiting today.
            </h2>
          </div>

          {/* Patient Card Banner (Figma 0:1264) */}
          <div className="bg-[#f2f3f5] rounded-[20px] px-5 py-4 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-base text-[#001f3f]">
                {isAnonymous ? "Anonymous Patient" : patientName}
              </span>
              <span className="text-sm text-[#6e8298]">
                {isAnonymous
                  ? `Session code: ${sessionCode || "ANON-SESSION"}`
                  : `Created ${patientCreatedAt}`}
              </span>
            </div>
          </div>

          {/* Subheader: Primary Symptom & Hausa Audio Toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
              Primary symptom
            </span>
            <button
              type="button"
              onClick={() => setHausaAudioOn(!hausaAudioOn)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                hausaAudioOn
                  ? "bg-[#e0edff] text-[#0073f3]"
                  : "bg-[#f2f3f5] text-[#6e8298] hover:text-[#242b33]"
              )}
            >
              {hausaAudioOn ? (
                <Volume2 className="size-3.5" />
              ) : (
                <VolumeX className="size-3.5" />
              )}
              <span>Hausa audio: {hausaAudioOn ? "On" : "Off"}</span>
            </button>
          </div>

          {/* Syndrome Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {syndromes.map((syndrome) => {
                const isSelected = selectedId === syndrome.id;
                return (
                  <button
                    key={syndrome.id}
                    type="button"
                    onClick={() => setSelectedId(syndrome.id)}
                    className={cn(
                      "rounded-[16px] p-4 flex items-center gap-3.5 text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-[#eff6ff] ring-2 ring-[#0073f3]"
                        : "bg-white hover:bg-gray-50/80"
                    )}
                  >
                    <div
                      className={cn(
                        "size-11 rounded-[12px] flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-[#cce3fd]" : "bg-[#f0f7ff]"
                      )}
                    >
                      {getSyndromeIcon(syndrome.code)}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span
                        className={cn(
                          "font-medium text-sm sm:text-base truncate",
                          isSelected ? "text-[#0073f3]" : "text-[#242b33]"
                        )}
                      >
                        {syndrome.label_en}
                      </span>
                      <span className="text-xs text-[#6e8298] truncate">
                        {syndrome.label_ha}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar - fixed to bottom on mobile */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Page 1 of 4
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="rounded-[12px] bg-[#f2f3f5] hover:bg-[#e4e8ec] text-[#0073f3] px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
            >
              Previous
            </button>
          )}
          <button
            type="button"
            disabled={!selectedId}
            onClick={handleNext}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
