"use client";

import { Check, Loader2, Monitor, Moon, Sun } from "lucide-react";
import * as React from "react";

import { FormFeedback } from "@/components/profile/form-feedback";
import { Label } from "@/components/ui/label";
import { useFormSubmit } from "@/hooks/use-form-submit";
import { applyThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Theme } from "@/types/domain";

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export interface PreferencesFormProps {
  theme: Theme;
  emailNotifications: boolean;
}

/**
 * Preferences form (Task 05).
 *
 * The theme is applied to the document the moment it is picked, then persisted.
 * Saving first and painting later would leave the UI out of step with the
 * user's choice for as long as the request takes.
 *
 * Preferences are patched individually so choosing a theme cannot silently
 * reset the notification setting.
 */
export function PreferencesForm({ theme, emailNotifications }: PreferencesFormProps) {
  const { pending, formError, successMessage, submit } = useFormSubmit();
  const [selectedTheme, setSelectedTheme] = React.useState<Theme>(theme);
  const [notifications, setNotifications] = React.useState(emailNotifications);

  function chooseTheme(next: Theme) {
    setSelectedTheme(next);
    applyThemePreference(next);
    submit(
      "/api/profile/preferences",
      { theme: next },
      { method: "PATCH", successMessage: "Theme saved." },
    );
  }

  function toggleNotifications() {
    const next = !notifications;
    setNotifications(next);
    submit(
      "/api/profile/preferences",
      { emailNotifications: next },
      { method: "PATCH", successMessage: "Notification preference saved." },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormFeedback error={formError} success={successMessage} />

      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="text-sm leading-none font-medium">Appearance</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
          {THEME_OPTIONS.map((option) => {
            const active = selectedTheme === option.value;
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseTheme(option.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/8 text-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {option.label}
                {active ? <Check className="size-3.5" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          System follows your operating system setting and updates automatically.
        </p>
      </fieldset>

      <div className="flex flex-col gap-3">
        <Label htmlFor="email-notifications" className="text-sm leading-none font-medium">
          Email notifications
        </Label>
        <label
          htmlFor="email-notifications"
          className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground"
        >
          <input
            id="email-notifications"
            type="checkbox"
            checked={notifications}
            disabled={pending}
            onChange={toggleNotifications}
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <span>
            Email me when an issue is assigned, a task completes, verification finishes or a report
            is ready.
          </span>
        </label>
      </div>

      {pending ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
