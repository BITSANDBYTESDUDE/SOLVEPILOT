import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  CircleDot,
  ClipboardCheck,
  Minus,
  Sparkles,
  Tag,
  TriangleAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { issueCategoryLabel, issuePriorityLabel, issueStatusLabel } from "@/lib/constants/issues";
import { cn } from "@/lib/utils";
import type { IssueCategory, IssuePriority, IssueStatus } from "@/types/domain";

/**
 * Problem badges (Task 11).
 *
 * Every state is conveyed with an icon and a word as well as a colour, so the
 * meaning survives for users who cannot distinguish the palette.
 */

const PRIORITY_VARIANTS = {
  low: { variant: "muted", Icon: Minus },
  medium: { variant: "info", Icon: CircleDot },
  high: { variant: "warning", Icon: TriangleAlert },
  critical: { variant: "destructive", Icon: TriangleAlert },
} as const;

const STATUS_VARIANTS = {
  new: { variant: "secondary", Icon: CircleDashed },
  analyzing: { variant: "info", Icon: Sparkles },
  planned: { variant: "info", Icon: ClipboardCheck },
  in_progress: { variant: "warning", Icon: CircleDot },
  verification: { variant: "info", Icon: ClipboardCheck },
  resolved: { variant: "success", Icon: CheckCircle2 },
  closed: { variant: "muted", Icon: XCircle },
} as const;

export function IssuePriorityBadge({
  priority,
  className,
}: {
  priority: IssuePriority;
  className?: string;
}) {
  const { variant, Icon } = PRIORITY_VARIANTS[priority] ?? PRIORITY_VARIANTS.medium;

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon aria-hidden="true" />
      {issuePriorityLabel(priority)}
    </Badge>
  );
}

export function IssueStatusBadge({
  status,
  className,
}: {
  status: IssueStatus;
  className?: string;
}) {
  const { variant, Icon } = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.new;

  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      <Icon aria-hidden="true" />
      {issueStatusLabel(status)}
    </Badge>
  );
}

export function IssueCategoryBadge({
  category,
  className,
}: {
  category: IssueCategory;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", className)}>
      <Tag aria-hidden="true" />
      {issueCategoryLabel(category)}
    </Badge>
  );
}

export function IssueUnavailableNotice({ className }: { className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
        className,
      )}
    >
      <CircleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Unable to load this problem.</p>
      <p className="text-sm text-muted-foreground">Please try again.</p>
    </div>
  );
}
