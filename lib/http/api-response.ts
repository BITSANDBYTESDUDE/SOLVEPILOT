import "server-only";

import { NextResponse } from "next/server";

import { normalizeError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ApiFailure, ApiSuccess, Paginated, PaginationMeta } from "@/types/api";

const log = logger.child("http");

function requestId(): string {
  return globalThis.crypto.randomUUID();
}

function withRequestId(response: NextResponse, id: string): NextResponse {
  response.headers.set("x-request-id", id);
  return response;
}

/** 200 — `{ success: true, data }`. */
export function jsonOk<TData>(data: TData, init?: ResponseInit): NextResponse {
  const body: ApiSuccess<TData> = { success: true, data };
  const response = NextResponse.json(body, { status: 200, ...init });
  return withRequestId(response, requestId());
}

/** 201 — `{ success: true, data }` for created resources. */
export function jsonCreated<TData>(data: TData, init?: ResponseInit): NextResponse {
  const body: ApiSuccess<TData> = { success: true, data };
  const response = NextResponse.json(body, { status: 201, ...init });
  return withRequestId(response, requestId());
}

/**
 * Translate any thrown value into the canonical error envelope.
 *
 * Unexpected errors are logged with full context server-side and always
 * answered with a generic message plus a request id for support.
 */
export function jsonError(error: unknown, context?: Record<string, unknown>): NextResponse {
  const appError = normalizeError(error);
  const id = requestId();

  if (appError.statusCode >= 500) {
    log.error(`${appError.code}: ${appError.message}`, error, { requestId: id, ...context });
  } else {
    log.warn(`${appError.code}: ${appError.message}`, { requestId: id, ...context });
  }

  const body: ApiFailure = { success: false, error: { ...appError.toApiError(), requestId: id } };
  const response = NextResponse.json(body, { status: appError.statusCode });
  return withRequestId(response, id);
}

/** Build pagination metadata consistently across list endpoints. */
export function buildPaginationMeta(options: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  const { page, pageSize, total } = options;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function jsonPaginated<TItem>(options: {
  items: TItem[];
  page: number;
  pageSize: number;
  total: number;
}): NextResponse {
  const data: Paginated<TItem> = {
    items: options.items,
    meta: buildPaginationMeta(options),
  };
  return jsonOk(data);
}
