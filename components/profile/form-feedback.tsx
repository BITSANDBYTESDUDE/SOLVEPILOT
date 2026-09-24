import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Success / error banner shared by the settings forms (Task 05).
 *
 * Kept as one component so a saved state looks identical everywhere and the
 * `role` attributes stay correct for screen readers.
 */
export function FormFeedback({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle aria-hidden="true" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (success) {
    return (
      <Alert variant="success" role="status">
        <CheckCircle2 aria-hidden="true" />
        <AlertDescription>{success}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
