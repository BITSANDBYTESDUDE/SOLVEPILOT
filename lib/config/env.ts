import "server-only";

import { z } from "zod";

/**
 * Environment access layer.
 *
 * Rules enforced here:
 *  - nothing is read from `process.env` outside this module (single source of truth),
 *  - no secret ever gets a `NEXT_PUBLIC_` prefix,
 *  - misconfiguration fails loudly at startup with an actionable message.
 *
 * Variables become *required* only when the feature that needs them is imported,
 * so the app can boot (and the landing page can render) before Mongo/OpenAI/S3
 * credentials are provided.
 */

const optionalUrl = z
  .string()
  .trim()
  .url("must be a valid URL")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalString = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  /* Database */
  MONGODB_URI: optionalString,
  MONGODB_DB_NAME: optionalString,

  /* Authentication (Auth.js) */
  AUTH_SECRET: optionalString,
  AUTH_URL: optionalUrl,
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),

  /* AI */
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().trim().default("gpt-4o-mini"),
  OPENAI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(32_000).default(2000),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().max(120_000).default(60_000),

  /* S3-compatible object storage */
  STORAGE_ENDPOINT: optionalUrl,
  STORAGE_REGION: z.string().trim().default("auto"),
  STORAGE_ACCESS_KEY: optionalString,
  STORAGE_SECRET_KEY: optionalString,
  STORAGE_BUCKET: optionalString,
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),

  /* Uploads */
  UPLOAD_MAX_IMAGE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(8 * 1024 * 1024),
  UPLOAD_MAX_DOCUMENT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(20 * 1024 * 1024),
  UPLOAD_MAX_AUDIO_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),

  /* PDF rendering (Puppeteer) */
  PDF_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false" && value !== "0"),
  PUPPETEER_EXECUTABLE_PATH: optionalString,
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_APP_NAME: z.string().trim().default("SolvePilot"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;
let cachedPublicEnv: PublicEnv | null = null;

/**
 * Parsed server environment. Throws on invalid values — never returns a
 * partially-configured object.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment configuration:\n${problems}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  cachedPublicEnv = parsed.success ? parsed.data : { NEXT_PUBLIC_APP_NAME: "SolvePilot" };
  return cachedPublicEnv;
}

/**
 * Absolute application base URL used for links inside emails, PDF reports and
 * share URLs.
 */
export function getAppBaseUrl(): string {
  const configured = getServerEnv().AUTH_URL ?? getPublicEnv().NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}

/**
 * Assert that a required variable is present, with a message that tells the
 * developer exactly what to do. Used by feature modules (db, ai, storage) so
 * missing configuration surfaces at the first real use, not at import time.
 */
export function requireEnv(
  key: keyof ServerEnv,
  hint = "Add it to your .env.local file (see .env.example).",
): string {
  const value = getServerEnv()[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required environment variable ${key}. ${hint}`);
  }
  return value;
}
