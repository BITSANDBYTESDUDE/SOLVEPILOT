const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Human readable file size (used by upload UI and evidence metadata).
 */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const unit = BYTE_UNITS[unitIndex] ?? "B";
  return `${value.toFixed(fractionDigits)} ${unit}`;
}

/**
 * Human readable duration from minutes, e.g. `30` -> "30 min", `90` -> "1 hr 30 min".
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) {
    return "—";
  }
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

/**
 * Percentage helper that never divides by zero and clamps to 0–100.
 */
export function toPercentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

/**
 * Title-case a domain enum value for display, e.g. `needs_review` -> "Needs review".
 */
export function humanizeEnum(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (spaced.length === 0) return "";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Convert an arbitrary string to a URL-safe slug.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Truncate text for previews while keeping whole words where possible.
 */
export function truncate(text: string, maxLength = 160): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;

  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Stable, locale-independent date formatting (avoids server/client hydration drift). */
export function formatDate(value: Date | string | number): string {
  const date = toDate(value);
  return date ? DATE_FORMATTER.format(date) : "—";
}

export function formatDateTime(value: Date | string | number): string {
  const date = toDate(value);
  return date ? DATE_TIME_FORMATTER.format(date) : "—";
}

function toDate(value: Date | string | number): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
