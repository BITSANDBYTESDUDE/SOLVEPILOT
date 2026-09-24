import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading state: reserved layout space so navigation never flashes
 * a blank page.
 */
export default function RootLoading() {
  return (
    <main id="main" className="container-page py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading SolvePilot…</span>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </main>
  );
}
