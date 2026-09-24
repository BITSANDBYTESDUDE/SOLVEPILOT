/**
 * Canonical API contract for SolvePilot.
 *
 * Every route handler responds with exactly one of these shapes:
 *
 *   { "success": true,  "data": { ... } }
 *   { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
 */

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "UNPROCESSABLE_ENTITY",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "AI_SERVICE_ERROR",
  "STORAGE_ERROR",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  /** Field-level details for validation failures. Never contains internal diagnostics. */
  details?: Record<string, string[]>;
  /** Correlation id so a user-visible error can be traced in server logs. */
  requestId?: string;
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<TItem> {
  items: TItem[];
  meta: PaginationMeta;
}

export type SortDirection = "asc" | "desc";

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: SortDirection;
  search?: string;
}
