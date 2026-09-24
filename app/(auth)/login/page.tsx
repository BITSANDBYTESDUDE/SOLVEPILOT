import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your SolvePilot workspace.",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

/** Only same-origin paths are accepted, so `callbackUrl` cannot be an open redirect. */
function safeCallbackUrl(value: string | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Already signed in? Don't show a form that would only fail.
  if (await getCurrentUser()) redirect("/dashboard");

  const { callbackUrl } = await searchParams;
  const destination = safeCallbackUrl(callbackUrl);

  return (
    <AuthForm
      title="Sign in"
      description="Welcome back. Pick up where you left off."
      endpoint="/api/auth/login"
      callbackUrl={destination}
      submitLabel="Sign in"
      fields={[
        {
          name: "email",
          label: "Email",
          type: "email",
          autoComplete: "email",
          placeholder: "you@example.com",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "current-password",
          placeholder: "Your password",
        },
      ]}
      footer={
        <>
          New to SolvePilot?{" "}
          <Link
            href={`/register${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
          .
        </>
      }
    />
  );
}
