import type { Metadata } from "next";

import { PasswordForm } from "@/components/profile/password-form";
import { PreferencesForm } from "@/components/profile/preferences-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";
import { getProfile } from "@/services/profile.service";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your SolvePilot profile, appearance and password.",
  robots: { index: false, follow: false },
};

/** Reads the signed-in user's profile, so it must never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * Settings (Task 05 — user profile and preferences).
 *
 * The profile is read from the database on this request rather than taken from
 * the session token, so a change elsewhere shows up immediately.
 */
export default async function SettingsPage() {
  const { user } = await requireUser("/dashboard/settings");
  const profile = await getProfile(user.id);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, appearance and password.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Member since {formatDate(profile.createdAt)}. Your email identifies your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Appearance applies instantly and is remembered on this device as well as your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            theme={profile.preferences.theme}
            emailNotifications={profile.preferences.emailNotifications}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs out every other device. This session stays active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
