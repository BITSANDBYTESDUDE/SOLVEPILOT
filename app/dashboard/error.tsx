"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-2">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl font-bold">Unable to load your dashboard</CardTitle>
          <CardDescription>
            Something went wrong while retrieving workspace information. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Button onClick={() => reset()} className="w-full">
            <RotateCcw className="size-4" aria-hidden="true" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
