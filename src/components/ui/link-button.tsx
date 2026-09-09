import Link from "next/link";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

/**
 * The installed Button primitive (@base-ui/react) uses a `render` prop for
 * polymorphism instead of Radix's `asChild`, and its docs explicitly warn
 * against rendering an anchor through it (link semantics differ from
 * button semantics). This component applies the same button styling to a
 * Next.js `Link` directly instead.
 */
export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size, className }))}>
      {children}
    </Link>
  );
}
