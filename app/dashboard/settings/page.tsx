import type { Metadata } from "next";

import { PasswordForm } from "@/components/profile/password-form";
import { PreferencesForm } from "@/components/profile/preferences-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { WorkspaceCreateForm } from "@/components/workspace/workspace-create-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveWorkspaceId } from "@/lib/auth/active-workspace";
import { requireUser } from "@/lib/auth/guards";
import { WORKSPACE_ROLE_LABELS } from "@/lib/constants/domain";
import { formatDate } from "@/lib/utils";
import { getProfile } from "@/services/profile.service";
import { listWorkspacesForUser } from "@/services/workspace.service";

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

  const [profile, workspaces, activeWorkspaceId] = await Promise.all([
    getProfile(user.id),
    listWorkspacesForUser(user.id),
    getActiveWorkspaceId(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, workspaces, appearance and password.
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

      <Card id="workspaces">
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <CardDescription>
            A workspace holds your projects and problems. You only ever see the ones you belong to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {workspaces.length === 0 ? (
            <EmptyState
              title="No workspace yet"
              description="Create your first workspace to start capturing problems."
            />
          ) : (
            <ul className="flex flex-col divide-y">
              {workspaces.map((workspace) => (
                <li key={workspace.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{workspace.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      /{workspace.slug}
                      {workspace.id === activeWorkspaceId ? " · active" : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {WORKSPACE_ROLE_LABELS[workspace.role] ?? workspace.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {workspace.memberCount} {workspace.memberCount === 1 ? "member" : "members"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t pt-6">
            <WorkspaceCreateForm />
          </div>
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
