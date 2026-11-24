"use client";

import { useRouter } from "next/navigation";

interface EncounterCompletedModalProps {
  patientName?: string;
  isAnonymous?: boolean;
  onReturnHome?: () => void;
}

export function EncounterCompletedModal({
  patientName = "Oyintari Werinipre",
  isAnonymous = false,
  onReturnHome,
}: EncounterCompletedModalProps) {
  const router = useRouter();

  const handleReturnHome = () => {
    if (onReturnHome) {
      onReturnHome();
    } else {
      router.push("/home");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="w-full max-w-[420px] bg-white rounded-[24px] p-6 sm:p-8 flex flex-col items-center text-center gap-6">
      {/* Medicine bottles & celebration SVG illustration */}
      <div className="relative size-32 flex items-center justify-center">
        <svg
          viewBox="0 0 120 105"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-full"
        >
          {/* Confetti particles */}
          <circle cx="61" cy="7" r="2.5" stroke="#FA8059" strokeWidth="1.5" />
          <circle cx="70" cy="14" r="3" fill="#FFC15D" />
          <polygon points="45,18 47,21 44,21" fill="#0CCA26" />
          <polygon points="47,32 49,32 49,34 47,34" fill="#4284EC" />
          <path d="M72 20C73 19 74 21 75 20" stroke="#58B5FB" strokeWidth="1.5" strokeLinecap="round" />
          <polygon points="74,31 75,34 77,33 76,30" fill="#E23B06" />

          {/* Bottle 1 */}
          <g transform="translate(48, 10)">
            <path
              d="M12 28L18 24L34 32L28 36L12 28Z"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M18 24L18 16L30 22L30 30"
              fill="#FBFBFC"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 28V62L28 72V36L12 28Z"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M28 72L44 62V32L28 36V72Z"
              fill="#F2F3F5"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Bottle cap */}
            <path
              d="M20 14L24 12L30 15L26 17L20 14Z"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.2"
            />
            {/* Label detail */}
            <rect x="16" y="40" width="8" height="12" rx="2" stroke="#4284EC" strokeWidth="1.2" fill="none" />
            <line x1="18" y1="44" x2="22" y2="44" stroke="#4284EC" strokeWidth="1" />
            <line x1="18" y1="47" x2="21" y2="47" stroke="#4284EC" strokeWidth="1" />
          </g>

          {/* Bottle 2 (Tilted) */}
          <g transform="translate(56, 26)">
            <path
              d="M10 24L16 20L32 28L26 32L10 24Z"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M10 24V56L26 64V32L10 24Z"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M26 64L40 56V28L26 32V64Z"
              fill="#E4E8EC"
              stroke="#A1AEBC"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Dropper tip */}
            <path
              d="M14 18L18 10L24 13L20 21"
              fill="#FFFFFF"
              stroke="#A1AEBC"
              strokeWidth="1.2"
            />
          </g>
        </svg>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-[#121619]">
          Encounter completed
        </h2>
        <p className="text-sm sm:text-base text-[#6e8298] leading-relaxed max-w-sm">
          <span className="font-semibold text-[#242b33]">
            {isAnonymous ? "Anonymous patient's" : `${patientName}’s`}
          </span>{" "}
          encounter has been completed. You can track their referral from your
          notifications.
        </p>
      </div>

      {/* Return home button */}
      <button
        type="button"
        onClick={handleReturnHome}
        className="w-full py-4 rounded-[12px] bg-[#fbfbfc] hover:bg-[#f0f7ff] text-[#0073f3] font-semibold text-base transition-colors cursor-pointer"
      >
        Return home
      </button>
      </div>
    </div>
  );
}
