import type { Metadata } from "next";

import { BuildStageNotice } from "@/components/system/build-stage-notice";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your SolvePilot account and workspace.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <BuildStageNotice
      title="Registration is not available in this build yet"
      plannedTask="Phase 1 · Task 04 — Authentication"
      description="Account creation, email uniqueness checks and the first workspace setup arrive with the authentication task. This route is wired so navigation stays valid while the module is being built."
    />
  );
}
