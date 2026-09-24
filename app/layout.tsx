import type { Metadata, Viewport } from "next";

import { getAppBaseUrl } from "@/lib/config/env";
import { themeInitScript } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrl()),
  title: {
    default: "SolvePilot — Your AI Guide from Problem to Solution",
    template: "%s · SolvePilot",
  },
  description:
    "SolvePilot is an AI-powered problem resolution workspace: capture a problem, get it classified, diagnosed and planned, track the work, verify the outcome and share a resolution report.",
  applicationName: "SolvePilot",
  keywords: [
    "problem resolution",
    "AI workspace",
    "issue tracking",
    "diagnosis",
    "verification report",
  ],
  authors: [{ name: "SolvePilot" }],
  openGraph: {
    type: "website",
    siteName: "SolvePilot",
    title: "SolvePilot — Your AI Guide from Problem to Solution",
    description:
      "Turn problems into structured, actionable and verifiable resolutions. Understand. Solve. Verify.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SolvePilot — Your AI Guide from Problem to Solution",
    description: "Understand. Solve. Verify.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the persisted/system theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <a
          href="#main"
          className="sr-only rounded-md bg-background focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
