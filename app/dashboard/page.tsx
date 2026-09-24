import type { Metadata } from "next";

import { BuildStageNotice } from "@/components/system/build-stage-notice";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <BuildStageNotice
      title="The dashboard is not available in this build yet"
      plannedTask="Phase 1 · Task 05 → Phase 2 · Task 09 — Dashboard"
      description="The workspace shell, statistics and activity feed are implemented once authentication and the workspace model are in place. This route is wired so navigation stays valid while the module is being built."
    />
  );
}
