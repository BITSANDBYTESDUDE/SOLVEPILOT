import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the problem detail view. */
export default function IssueDetailLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading problem…</span>

      <Skeleton className="h-8 w-40 rounded-md" />

      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}
