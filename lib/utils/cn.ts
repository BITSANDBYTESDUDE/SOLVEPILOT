import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and resolve Tailwind conflicts.
 *
 * Used by every UI primitive so that callers can always override styles
 * through the `className` prop without specificity surprises.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
