import { NextResponse } from "next/server";

export type JsonErrorCode =
  | "UNKNOWN_SLUG"
  | "RUN_NOT_FOUND"
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "INTERNAL_ERROR";

export function jsonError(
  status: number,
  code: JsonErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}
