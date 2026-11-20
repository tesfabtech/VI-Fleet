import { NextResponse } from "next/server";
import { ServiceError } from "./types";

export function jsonSuccess<T>(data: T, message?: string, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      data,
      ...(message ? { message } : {}),
    },
    { status },
  );
}

export function jsonError(err: unknown, fallbackStatus = 500) {
  if (err instanceof ServiceError) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.statusCode },
    );
  }

  if (err instanceof Error) {
    console.error("Unhandled API error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: fallbackStatus },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: "An unexpected error occurred.",
      code: "UNKNOWN_ERROR",
    },
    { status: fallbackStatus },
  );
}
