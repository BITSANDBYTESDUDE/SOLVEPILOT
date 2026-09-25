"use client";

import { AlertCircle, CheckCircle2, Loader2, Plus, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKSPACE_ROLE_LABELS } from "@/lib/constants/domain";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/types/domain";
import type { SafeWorkspaceMember } from "@/services/workspace-member.service";

export interface WorkspaceMembersProps {
  workspaceId: string;
  workspaceName: string;
  currentUserRole: WorkspaceRole;
  currentUserId: string;
  initialMembers: SafeWorkspaceMember[];
}

export function WorkspaceMembers({
  workspaceId,
  workspaceName,
  currentUserRole,
  currentUserId,
  initialMembers,
}: WorkspaceMembersProps) {
  const router = useRouter();
  const [members, setMembers] = React.useState<SafeWorkspaceMember[]>(initialMembers);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Dialog states
  const [addOpen, setAddOpen] = React.useState(false);
  const [roleTarget, setRoleTarget] = React.useState<SafeWorkspaceMember | null>(null);
  const [removeTarget, setRemoveTarget] = React.useState<SafeWorkspaceMember | null>(null);

  // Synchronize local state when server props update
  const [prevInitial, setPrevInitial] = React.useState(initialMembers);
  if (prevInitial !== initialMembers) {
    setPrevInitial(initialMembers);
    setMembers(initialMembers);
  }

  // Permission helpers for UI visibility
  const canAdd = currentUserRole === "owner" || currentUserRole === "admin";
  const totalOwners = members.filter((m) => m.role === "owner").length;

  function canModifyTarget(target: SafeWorkspaceMember): {
    canChangeRole: boolean;
    canRemove: boolean;
  } {
    if (currentUserRole === "member") {
      return { canChangeRole: false, canRemove: false };
    }

    if (currentUserRole === "admin") {
      // Admin cannot modify owner or another admin
      if (target.role === "owner" || target.role === "admin") {
        return { canChangeRole: false, canRemove: false };
      }
      return { canChangeRole: true, canRemove: true };
    }

    if (currentUserRole === "owner") {
      // Owner can modify members & admins.
      // If target is owner: cannot remove or downgrade if single owner.
      if (target.role === "owner" && totalOwners <= 1) {
        return { canChangeRole: false, canRemove: false };
      }
      return { canChangeRole: true, canRemove: true };
    }

    return { canChangeRole: false, canRemove: false };
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback ? (
        <Alert
          variant={feedback.type === "error" ? "destructive" : "success"}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.type === "error" ? (
            <AlertCircle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Workspace Members</h2>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? "member" : "members"} with access to this
            workspace.
          </p>
        </div>

        {canAdd ? (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Add Member
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="divide-y">
          {members.map((member) => {
            const { canChangeRole, canRemove } = canModifyTarget(member);
            const isSelf = member.userId === currentUserId;

            return (
              <div
                key={member.userId}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    {isSelf ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      member.role === "owner"
                        ? "default"
                        : member.role === "admin"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {WORKSPACE_ROLE_LABELS[member.role] ?? member.role}
                  </Badge>

                  {canChangeRole || canRemove ? (
                    <div className="flex items-center gap-2">
                      {canChangeRole ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFeedback(null);
                            setRoleTarget(member);
                          }}
                        >
                          Change Role
                        </Button>
                      ) : null}

                      {canRemove ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            setFeedback(null);
                            setRemoveTarget(member);
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Member Dialog */}
      {addOpen ? (
        <AddMemberDialog
          workspaceId={workspaceId}
          currentUserRole={currentUserRole}
          onClose={() => setAddOpen(false)}
          onSuccess={(newMember) => {
            setMembers((prev) => [...prev, newMember]);
            setFeedback({
              type: "success",
              message: `${newMember.name} has been added to the workspace.`,
            });
            setAddOpen(false);
            router.refresh();
          }}
        />
      ) : null}

      {/* Change Role Dialog */}
      {roleTarget ? (
        <ChangeRoleDialog
          workspaceId={workspaceId}
          target={roleTarget}
          currentUserRole={currentUserRole}
          onClose={() => setRoleTarget(null)}
          onSuccess={(updatedMember) => {
            setMembers((prev) =>
              prev.map((m) => (m.userId === updatedMember.userId ? updatedMember : m)),
            );
            setFeedback({
              type: "success",
              message: `Role for ${updatedMember.name} changed to ${WORKSPACE_ROLE_LABELS[updatedMember.role]}.`,
            });
            setRoleTarget(null);
            router.refresh();
          }}
        />
      ) : null}

      {/* Remove Member Confirmation Dialog */}
      {removeTarget ? (
        <RemoveMemberDialog
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          target={removeTarget}
          onClose={() => setRemoveTarget(null)}
          onSuccess={() => {
            setMembers((prev) => prev.filter((m) => m.userId !== removeTarget.userId));
            setFeedback({
              type: "success",
              message: `${removeTarget.name} has been removed from the workspace.`,
            });
            setRemoveTarget(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add Member Dialog                                                          */
/* -------------------------------------------------------------------------- */

interface AddMemberDialogProps {
  workspaceId: string;
  currentUserRole: WorkspaceRole;
  onClose: () => void;
  onSuccess: (member: SafeWorkspaceMember) => void;
}

function AddMemberDialog({
  workspaceId,
  currentUserRole,
  onClose,
  onSuccess,
}: AddMemberDialogProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<WorkspaceRole>("member");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { member: SafeWorkspaceMember };
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success || !body.data?.member) {
        setError(body?.error?.message ?? "Failed to add member. Please try again.");
        return;
      }

      onSuccess(body.data.member);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 id="add-member-title" className="text-lg font-semibold tracking-tight">
          Add Workspace Member
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the email address of a registered SolvePilot user to invite them to this workspace.
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              required
              autoFocus
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="member-role">Role</Label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              disabled={pending}
              className={cn(
                "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {currentUserRole === "owner" ? <option value="owner">Owner</option> : null}
            </select>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Add Member
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Change Role Dialog                                                         */
/* -------------------------------------------------------------------------- */

interface ChangeRoleDialogProps {
  workspaceId: string;
  target: SafeWorkspaceMember;
  currentUserRole: WorkspaceRole;
  onClose: () => void;
  onSuccess: (member: SafeWorkspaceMember) => void;
}

function ChangeRoleDialog({
  workspaceId,
  target,
  currentUserRole,
  onClose,
  onSuccess,
}: ChangeRoleDialogProps) {
  const [role, setRole] = React.useState<WorkspaceRole>(target.role);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === target.role) {
      onClose();
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${target.userId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        data?: { member: SafeWorkspaceMember };
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success || !body.data?.member) {
        setError(body?.error?.message ?? "Failed to change member role. Please try again.");
        return;
      }

      onSuccess(body.data.member);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-role-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 id="change-role-title" className="text-lg font-semibold tracking-tight">
          Change Member Role
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Modify the access level for{" "}
          <strong className="font-semibold text-foreground">{target.name}</strong> ({target.email}).
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="change-role-select">Select Role</Label>
            <select
              id="change-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              disabled={pending}
              className={cn(
                "h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors outline-none",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              {currentUserRole === "owner" ? <option value="owner">Owner</option> : null}
            </select>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || role === target.role}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Update Role
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Remove Member Dialog                                                       */
/* -------------------------------------------------------------------------- */

interface RemoveMemberDialogProps {
  workspaceId: string;
  workspaceName: string;
  target: SafeWorkspaceMember;
  onClose: () => void;
  onSuccess: () => void;
}

function RemoveMemberDialog({
  workspaceId,
  workspaceName,
  target,
  onClose,
  onSuccess,
}: RemoveMemberDialogProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleRemove() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${target.userId}`, {
        method: "DELETE",
      });

      const body = (await response.json().catch(() => null)) as {
        success: boolean;
        error?: { message: string };
      } | null;

      if (!response.ok || !body?.success) {
        setError(body?.error?.message ?? "Failed to remove member. Please try again.");
        return;
      }

      onSuccess();
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3
          id="remove-member-title"
          className="text-lg font-semibold tracking-tight text-destructive"
        >
          Remove Workspace Member
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Are you sure you want to remove{" "}
          <strong className="font-semibold text-foreground">{target.name}</strong> ({target.email})
          from <strong className="font-semibold text-foreground">{workspaceName}</strong>?
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          They will immediately lose all access to this workspace and its resources.
        </p>

        {error ? (
          <div className="mt-4">
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={pending}>
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <UserMinus className="size-4" />
            )}
            Remove Member
          </Button>
        </div>
      </div>
    </div>
  );
}
