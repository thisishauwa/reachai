"use client";

import { useState } from "react";
import { Check, ShieldCheck, UserCheck, Edit3, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PrivacyMode } from "@/lib/supabase/database.types";

export interface StepConsentResult {
  privacyMode: PrivacyMode;
  locale: "en" | "ha";
  verbalAttested?: boolean;
  signatureMethod?: "type" | "draw";
  signatureText?: string;
}

interface StepConsentProps {
  initialMode?: PrivacyMode;
  /** Whether the patient is under 18 — drives parental vs patient consent */
  isMinor?: boolean;
  onContinue: (data: StepConsentResult) => void;
  onPrevious?: () => void;
}

export function StepConsent({
  initialMode = "identified",
  isMinor = false,
  onContinue,
  onPrevious,
}: StepConsentProps) {
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(initialMode);
  const [locale, setLocale] = useState<"en" | "ha">("en");
  const [verbalAttested, setVerbalAttested] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState<"type" | "draw">("type");
  const [signatureText, setSignatureText] = useState("");

  const handleContinue = () => {
    if (privacyMode === "anonymous") {
      if (!verbalAttested) {
        toast.error(
          locale === "en"
            ? "Please confirm patient verbal consent before continuing"
            : "Da fatan a tabbatar da amincewar majiyyacin kafin ci gaba"
        );
        return;
      }
      onContinue({
        privacyMode: "anonymous",
        locale,
        verbalAttested: true,
      });
    } else {
      if (signatureMethod === "type" && !signatureText.trim()) {
        toast.error(
          locale === "en"
            ? "Please enter the patient's full name signature"
            : "Da fatan a shigar da cikakken sunan majiyyacin a matsayin sa hannu"
        );
        return;
      }
      onContinue({
        privacyMode: "identified",
        locale,
        signatureMethod,
        signatureText: signatureText.trim() || "Attested Signature",
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-24 sm:pb-0">
      <div className="relative w-full">
        {/* Decorative background peeking card */}
        <div className="absolute inset-x-4 -bottom-3 h-12 bg-[#f2f3f5] rounded-[20px] -z-10" />

        <div className="bg-[#f9f9f9] rounded-[20px] p-6 sm:p-10 flex flex-col gap-6">
          {/* Top Segmented Mode Switcher */}
          <div className="w-full flex items-center bg-[#f2f3f5] p-1 rounded-[10px]">
            <button
              type="button"
              id="consent-mode-identified"
              onClick={() => setPrivacyMode("identified")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-[8px] transition-all text-center cursor-pointer",
                privacyMode === "identified"
                  ? "bg-white text-[#242b33] shadow-sm"
                  : "text-[#6e8298] hover:text-[#242b33]"
              )}
            >
              Identified mode
            </button>
            <button
              type="button"
              id="consent-mode-anonymous"
              onClick={() => setPrivacyMode("anonymous")}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-[8px] transition-all text-center cursor-pointer",
                privacyMode === "anonymous"
                  ? "bg-white text-[#242b33] shadow-sm"
                  : "text-[#6e8298] hover:text-[#242b33]"
              )}
            >
              Anonymous mode
            </button>
          </div>

          {/* Section Eyebrow and Heading */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[#0590f9] text-xs font-semibold uppercase tracking-wider">
              Step 2 of 6
            </span>
            <h2 className="text-xl sm:text-2xl font-normal text-[#001f3e] leading-snug">
              <span className="font-medium">
                {isMinor ? "Parental / Guardian consent" : "Obtain consent"}
              </span>{" "}
              before starting the{" "}
              {privacyMode === "identified" ? "identified" : "anonymous"}{" "}
              syndromic classification
            </h2>
            {isMinor && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#fff8ec] border border-[#f5c842] rounded-[10px] mt-1">
                <span className="text-[#c98800] text-xs font-medium">
                  ⚠️ Patient is under 18 — consent must be obtained from a parent or guardian.
                </span>
              </div>
            )}
          </div>

          {/* Mode Banner */}
          {privacyMode === "identified" ? (
            <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
              <div className="size-12 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
                <UserCheck className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-[#242b33] text-base sm:text-lg">
                  Identified Patient Encounter
                </h3>
                <p className="text-sm sm:text-base text-[#6e8298]">
                  Enables linked referrals, care continuity, and follow-up tracking at the referral facility.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#f0f7ff] rounded-[20px] p-5 flex items-start gap-4">
              <div className="size-12 rounded-[12px] bg-[#cce3fd] text-[#0073f3] flex items-center justify-center shrink-0">
                <ShieldCheck className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-[#242b33] text-base sm:text-lg">
                  Anonymous syndromic data only
                </h3>
                <p className="text-sm sm:text-base text-[#6e8298]">
                  No personal data or identifiers will be collected in this screening.
                </p>
              </div>
            </div>
          )}

          {/* Language Toggle */}
          <div className="inline-flex bg-[#f2f3f5] p-1 rounded-[8px] self-start">
            <button
              type="button"
              id="consent-lang-en"
              onClick={() => setLocale("en")}
              className={cn(
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium cursor-pointer",
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
                "px-3.5 py-1.5 text-sm rounded-[6px] transition-colors font-medium cursor-pointer",
                locale === "ha"
                  ? "bg-white text-[#242b33]"
                  : "text-[#a1aebc] hover:text-[#495766]"
              )}
            >
              Hausa
            </button>
          </div>

          {/* Mode-Specific Consent Content */}
          {privacyMode === "identified" ? (
            <div className="flex flex-col gap-5">
              {/* Consent Text Box */}
              <div className="bg-white rounded-[12px] p-4 sm:p-5 flex flex-col gap-2">
                <span className="font-medium text-base text-[#242b33]">
                  {isMinor
                    ? (locale === "en" ? "Parental / Guardian consent" : "Amincewar iyaye / mai kula")
                    : (locale === "en" ? "Patient consent" : "Amincewar maralafiya")}
                </span>
                <p className="text-sm sm:text-base text-[#6e8298] leading-relaxed">
                  {isMinor
                    ? (locale === "en"
                        ? "As parent or legal guardian, I consent to sharing this minor's personal and medical information with the REACH clinic for the purpose of this referral. I understand their data will be protected under NHREC and GDPR standards, and participation is voluntary."
                        : "A matsayina na iyaye ko mai kula da wannan yaro, na yarda a raba bayanan su na sirri da na lafiya tare da asibitin REACH domin wannan tura mara lafiya. Na fahimci cewa za a kare bayanan su a karkashin ka'idojin NHREC da GDPR, kuma shiga ta son rai ne.")
                    : (locale === "en"
                        ? "I consent to sharing my personal and medical information with the REACH clinic for the purpose of this referral. I understand that my data will be protected under NHREC and GDPR standards, and my participation is voluntary."
                        : "Na yarda a raba bayanan kaina da na lafiya tare da asibitin REACH domin wannan tura mara lafiya. Na fahimci cewa za a kare bayanan na a karkashin ka'idojin NHREC da GDPR, kuma shiga ta na son raina ne.")}
                </p>
              </div>

              {/* Signature */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-[#6e8298] font-medium">
                    {isMinor
                      ? (locale === "en" ? "Guardian signature / Attestation" : "Sa hannun mai kula")
                      : (locale === "en" ? "Patient signature / Attestation" : "Sa hannun majiyyaci")}
                  </span>
                  <div className="bg-[#f2f3f5] p-0.5 rounded-[8px] flex items-center">
                    <button
                      type="button"
                      onClick={() => setSignatureMethod("draw")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors cursor-pointer",
                        signatureMethod === "draw"
                          ? "bg-white text-[#242b33]"
                          : "text-[#a1aebc] hover:text-[#495766]"
                      )}
                    >
                      <Edit3 className="size-3.5" />
                      Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignatureMethod("type")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[6px] transition-colors cursor-pointer",
                        signatureMethod === "type"
                          ? "bg-white text-[#242b33]"
                          : "text-[#a1aebc] hover:text-[#495766]"
                      )}
                    >
                      <Keyboard className="size-3.5" />
                      Type
                    </button>
                  </div>
                </div>

                {signatureMethod === "type" ? (
                  <input
                    type="text"
                    id="consent-signature-input"
                    value={signatureText}
                    onChange={(e) => setSignatureText(e.target.value)}
                    placeholder={locale === "en" ? "Enter patient full name" : "Shigar da cikakken sunan majiyyaci"}
                    className="w-full bg-white rounded-[12px] px-4 py-3.5 text-sm sm:text-base text-[#242b33] placeholder:text-[#a1aebc] outline-none border border-[#e4e8ec] focus:border-[#0073f3] focus:ring-2 focus:ring-[#0073f3]/20 transition-all"
                  />
                ) : (
                  <div className="w-full bg-white rounded-[12px] p-6 text-center text-sm text-[#6e8298] border-2 border-dashed border-[#e4e8ec]">
                    <p className="italic">
                      {locale === "en"
                        ? "Patient signature attested / Verbal confirmation with caregiver"
                        : "Tabbatar da sa hannun majiyyaci ko mai kula"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Read to patient box */}
              <div className="bg-white rounded-[12px] p-4 sm:p-5 flex flex-col gap-2">
                <span className="font-medium text-sm sm:text-base text-[#0073f3]">
                  {locale === "en" ? "Read to patient" : "Karanta wa majiyyaci"}
                </span>
                <p className="text-sm sm:text-base text-[#6e8298] leading-relaxed">
                  {locale === "en" ? (
                    <>
                      &ldquo;We are collecting symptom information today to help track
                      community health.{" "}
                      <span className="font-semibold text-[#242b33]">
                        We will not ask for your name, phone number, or any
                        personal details.
                      </span>{" "}
                      This is completely anonymous. Do you agree to proceed?&rdquo;
                    </>
                  ) : (
                    <>
                      &ldquo;Muna tattara bayanan alamun rashin lafiya a yau don taimakawa
                      wajen lura da lafiyar al&apos;umma.{" "}
                      <span className="font-semibold text-[#242b33]">
                        Ba za mu tambayi sunanka, lambar wayarka, ko wani bayani
                        na kanka ba.
                      </span>{" "}
                      Wannan gaba daya ba a bayyana sunan mai shi ba. Ka yarda mu
                      ci gaba?&rdquo;
                    </>
                  )}
                </p>
              </div>

              {/* Verbal consent checkbox */}
              <button
                type="button"
                id="verbal-consent-btn"
                onClick={() => setVerbalAttested((prev) => !prev)}
                className="bg-white rounded-[12px] p-4 sm:p-5 flex items-start gap-3.5 text-left transition-colors hover:bg-gray-50/80 cursor-pointer border border-[#e4e8ec]"
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
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="w-full flex items-center justify-between pt-2 sm:static fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:border-0 sm:p-0 sm:bg-transparent z-40">
        <div className="bg-[#f9f3ff] px-4 py-2.5 rounded-full inline-flex items-center">
          <span className="text-[#9175a7] text-sm sm:text-base font-medium">
            Consent
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
            id="consent-continue-btn"
            onClick={handleContinue}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            {locale === "en" ? "Continue to screening" : "Ci gaba zuwa gwajin"}
          </button>
        </div>
      </div>
    </div>
  );
}
