import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the problem list. */
export default function IssuesLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading problems…</span>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="flex flex-col rounded-xl border bg-card">
        <Skeleton className="h-11 w-full rounded-t-xl" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-t px-4 py-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
