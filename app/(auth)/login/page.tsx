import type { Metadata } from "next";

import { BuildStageNotice } from "@/components/system/build-stage-notice";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your SolvePilot workspace.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <BuildStageNotice
      title="Sign in is not available in this build yet"
      plannedTask="Phase 1 · Task 04 — Authentication"
      description="Credentials, sessions and server-side authorization are implemented in the authentication task. This route is wired so navigation stays valid while the module is being built."
    />
  );
}
