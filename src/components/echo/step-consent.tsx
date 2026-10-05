"use client";

import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StepConsentProps {
  onContinue: (data: {
    locale: "en" | "ha";
    verbalAttested: boolean;
  }) => void;
}

/**
 * AC1 — Anonymous-only consent step.
 *
 * The first consent screen already states that no personal data is collected,
 * so there is no second consent step, no Identified Patient option and no
 * Create New Patient button.  This component locks the flow to anonymous mode.
 */
export function StepConsent({ onContinue }: StepConsentProps) {
  const [locale, setLocale] = useState<"en" | "ha">("en");
  const [verbalAttested, setVerbalAttested] = useState(false);

  const handleContinue = () => {
    if (!verbalAttested) {
      toast.error(
        locale === "en"
          ? "Please confirm patient verbal consent before continuing"
          : "Da fatan a tabbatar da amincewar majiyyacin kafin ci gaba"
      );
      return;
    }
    onContinue({ locale, verbalAttested: true });
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
              Pre-screening
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">Obtain consent</span> before starting
              the anonymous syndromic classification
            </h2>
          </div>

          {/* Anonymous Mode Banner */}
          <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
            <div className="size-12 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
              <ShieldCheck className="size-6" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-[#242b33] text-base sm:text-lg">
                Anonymous syndromic data only
              </h3>
              <p className="text-sm sm:text-base text-[#6e8298]">
                No personal data or identifiers will be collected in this
                screening.
              </p>
            </div>
          </div>

          {/* Language Toggle */}
          <div className="inline-flex bg-[#f2f3f5] p-1 rounded-[8px] self-start">
            <button
              type="button"
              id="consent-lang-en"
              onClick={() => setLocale("en")}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium",
                locale === "en"
                  ? "bg-white text-[#242b33]"
                  : "text-[#a1aebc] hover:text-[#495766]"
              )}
            >
              English
            </button>
            <button
              type="button"
              id="consent-lang-ha"
              onClick={() => setLocale("ha")}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium",
                locale === "ha"
                  ? "bg-white text-[#242b33]"
                  : "text-[#a1aebc] hover:text-[#495766]"
              )}
            >
              Hausa
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Read to patient box */}
            <div className="bg-white rounded-[12px] p-4 sm:p-5 flex flex-col gap-2">
              <span className="font-medium text-sm sm:text-base text-[#0073f3]">
                {locale === "en" ? "Read to patient" : "Karanta wa majiyyaci"}
              </span>
              <p className="text-sm sm:text-base text-[#6e8298] leading-relaxed">
                {locale === "en" ? (
                  <>
                    "We are collecting symptom information today to help track
                    community health.{" "}
                    <span className="font-semibold text-[#242b33]">
                      We will not ask for your name, phone number, or any
                      personal details.
                    </span>{" "}
                    This is completely anonymous. Do you agree to proceed?"
                  </>
                ) : (
                  <>
                    "Muna tattara bayanan alamun rashin lafiya a yau don taimakawa
                    wajen lura da lafiyar al&apos;umma.{" "}
                    <span className="font-semibold text-[#242b33]">
                      Ba za mu tambayi sunanka, lambar wayarka, ko wani bayani
                      na kanka ba.
                    </span>{" "}
                    Wannan gaba daya ba a bayyana sunan mai shi ba. Ka yarda mu
                    ci gaba?"
                  </>
                )}
              </p>
            </div>

            {/* Verbal consent checkbox */}
            <button
              type="button"
              id="verbal-consent-btn"
              onClick={() => setVerbalAttested((prev) => !prev)}
              className="bg-white rounded-[12px] p-4 sm:p-5 flex items-start gap-3.5 text-left transition-colors hover:bg-gray-50/80"
            >
              <div
                className={cn(
                  "size-5 rounded-[4px] mt-0.5 flex items-center justify-center transition-colors shrink-0",
                  verbalAttested
                    ? "bg-[#0073f3] text-white"
                    : "border border-[#c7d2de] bg-white"
                )}
              >
                {verbalAttested && <Check className="size-3.5 stroke-[3]" />}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-sm sm:text-base text-[#242b33]">
                  {locale === "en"
                    ? "Patient has provided verbal consent"
                    : "Majiyyacin ya bai amincewarsa ta baki"}
                </span>
                <span className="text-xs sm:text-sm text-[#6e8298]">
                  {locale === "en"
                    ? "I confirm that the patient understands this is anonymous and agrees to proceed"
                    : "Na tabbatar da cewa majiyyacin ya fahimci cewa wannan ba shi da suna kuma ya yarda ya ci gaba"}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar — fixed to bottom on mobile */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Pre-Screening
          </span>
        </div>
        <button
          type="button"
          id="consent-continue-btn"
          onClick={handleContinue}
          className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
        >
          {locale === "en" ? "Continue to screening" : "Ci gaba zuwa gwajin"}
        </button>
      </div>
    </div>
  );
}
