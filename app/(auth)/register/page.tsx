import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your SolvePilot account and workspace.",
  robots: { index: false, follow: false },
};

interface RegisterPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

/** Only same-origin paths are accepted, so `callbackUrl` cannot be an open redirect. */
function safeCallbackUrl(value: string | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  if (await getCurrentUser()) redirect("/dashboard");

  const { callbackUrl } = await searchParams;
  const destination = safeCallbackUrl(callbackUrl);

  return (
    <AuthForm
      title="Create your account"
      description="Start turning problems into verified resolutions."
      endpoint="/api/auth/register"
      callbackUrl={destination}
      submitLabel="Create account"
      fields={[
        {
          name: "name",
          label: "Name",
          type: "text",
          autoComplete: "name",
          placeholder: "Ayesha Khan",
        },
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
          autoComplete: "new-password",
          placeholder: `At least ${PASSWORD_MIN_LENGTH} characters`,
        },
      ]}
      checkbox={{
        name: "acceptTerms",
        label: "I agree to the terms of service and privacy policy.",
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          .
        </>
      }
    />
  );
}
