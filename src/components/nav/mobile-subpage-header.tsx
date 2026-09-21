"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MobileNavMenu } from "@/components/nav/mobile-nav-menu";
import { cn } from "@/lib/utils";

interface MobileSubpageHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
}

export function MobileSubpageHeader({
  title,
  backHref = "/home",
  backLabel,
  onBack,
  rightElement,
  className,
}: MobileSubpageHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div
      className={cn(
        "flex sm:hidden items-center justify-between gap-3 w-full py-2 mb-2",
        className
      )}
    >
      {/* Left: Round Back Button + Screen Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleBack}
          className="size-10 rounded-full bg-[#f7f7f7] hover:bg-[#eaeaea] active:scale-95 flex items-center justify-center text-[#242b33] transition-colors cursor-pointer shrink-0 border-0 shadow-none"
          aria-label={backLabel ? `Go back to ${backLabel}` : "Go back"}
        >
          <ArrowLeft className="size-5 text-[#495766]" />
        </button>

        {title && (
          <h1 className="text-lg font-medium text-[#001f3e] tracking-tight truncate">
            {title}
          </h1>
        )}
      </div>

      {/* Right: Optional Element (Delete, Badge) + Consistent Hamburger Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {rightElement}
        <MobileNavMenu />
      </div>
    </div>
  );
}
