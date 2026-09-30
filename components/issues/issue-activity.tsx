import { History } from "lucide-react";

import { ActivityMessage } from "@/components/activity/activity-message";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { SafeActivityItem } from "@/services/activity.service";

function relativeTime(input: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(input).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function IssueActivity({ activities }: { activities: SafeActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" aria-hidden="true" />
          Activity
        </CardTitle>
        <CardDescription>Changes and events recorded for this problem.</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative ml-2 flex flex-col gap-5 border-l pl-5">
            {activities.map((activity) => (
              <li key={activity.id} className="relative min-w-0">
                <span
                  className="absolute top-1 -left-[26px] size-2.5 rounded-full border-2 border-primary bg-background"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <ActivityMessage activity={activity} />
                </div>
                <time
                  className="mt-1 block text-xs text-muted-foreground"
                  dateTime={new Date(activity.createdAt).toISOString()}
                  title={formatDateTime(activity.createdAt)}
                >
                  {relativeTime(activity.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
