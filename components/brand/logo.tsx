import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * SolvePilot brand mark.
 *
 * The glyph combines a flight path with waypoints — the "pilot" idea — plus a
 * verification tick. Deliberately geometric and quiet so it reads as a
 * technical product rather than a mascot.
 */
export function LogoMark({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="SolvePilot"
      className={cn("size-8", className)}
      {...props}
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path
        d="M8.25 23.25c0-4.6 2.9-6.35 6.1-7.9 2.5-1.2 4.6-2.6 4.9-5.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        className="stroke-primary-foreground"
      />
      <circle cx="8.6" cy="24.6" r="2.1" className="fill-primary-foreground" />
      <path
        d="m17.6 15.9 2.3 2.3 4.3-4.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
    </svg>
  );
}

export interface LogoProps extends React.ComponentProps<"div"> {
  /** Hide the wordmark and render only the glyph. */
  markOnly?: boolean;
  subtitle?: string;
}

export function Logo({ className, markOnly = false, subtitle, ...props }: LogoProps) {
  return (
    <div
      data-slot="logo"
      className={cn("flex items-center gap-2.5", className)}
      {...props}
      aria-label="SolvePilot"
    >
      <LogoMark />
      {markOnly ? null : (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">
            Solve<span className="text-primary">Pilot</span>
          </span>
          {subtitle ? (
            <span className="mt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {subtitle}
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
