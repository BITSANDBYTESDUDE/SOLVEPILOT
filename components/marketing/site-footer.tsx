import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { href: "#lifecycle", label: "Resolution lifecycle" },
      { href: "#workspace", label: "Workspace" },
      { href: "#inputs", label: "Inputs" },
      { href: "#example", label: "Example" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "#security", label: "Security" },
      { href: "/login", label: "Sign in" },
      { href: "/register", label: "Create account" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="container-page py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              SolvePilot turns problems into structured, verifiable resolutions — from first
              description to a shareable resolution report.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              Workspace-isolated data, server-enforced permissions.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold tracking-[0.14em] uppercase">{section.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SolvePilot. Understand. Solve. Verify.</p>
          <p>Built with Next.js, MongoDB and server-side AI.</p>
        </div>
      </div>
    </footer>
  );
}
