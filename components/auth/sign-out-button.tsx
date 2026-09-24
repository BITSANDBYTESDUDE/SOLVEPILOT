"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";

/**
 * Sign out (Task 04).
 *
 * Posts to the JSON endpoint, then refreshes so every Server Component reads
 * the now-revoked session. `router.refresh()` matters: without it the page
 * would keep rendering the signed-in state it already produced.
 */
export function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const router = useRouter();
  const [pending, startPending] = React.useTransition();

  function onClick() {
    startPending(() => {
      void (async () => {
        try {
          await fetch("/api/auth/signout", { method: "POST" });
        } finally {
          // Sign out even if the request failed — the local view should not
          // keep pretending a revoked or unreachable session is live.
          router.refresh();
          router.replace("/");
        }
      })();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <LogOut aria-hidden="true" />
      {label}
    </Button>
  );
}
