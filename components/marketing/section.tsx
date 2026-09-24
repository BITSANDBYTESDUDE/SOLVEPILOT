import * as React from "react";

import { cn } from "@/lib/utils";

interface SectionProps extends React.ComponentProps<"section"> {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

/**
 * Consistent marketing/app section wrapper: optional eyebrow, headline and
 * supporting copy with predictable vertical rhythm.
 */
export function Section({
  eyebrow,
  title,
  description,
  align = "center",
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("container-page py-16 sm:py-20 lg:py-24", className)} {...props}>
      <div
        className={cn(
          "flex flex-col gap-3",
          align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-2xl",
        )}
      >
        {eyebrow ? (
          <span className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
        {description ? (
          <p className="text-base leading-relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children ? <div className="mt-12">{children}</div> : null}
    </section>
  );
}
