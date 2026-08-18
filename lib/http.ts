import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ServiceError, WriteConflictError } from "@/lib/services/errors";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorJson(message: string, status = 400, details?: unknown) {
  return json(
    {
      error: {
        message,
        details
      }
    },
    status
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return errorJson("Invalid request body", 400, error.flatten());
  }

  if (error instanceof WriteConflictError) {
    return errorJson(error.message, error.httpStatus, {
      code: error.code
    });
  }

  if (error instanceof ServiceError) {
    return errorJson(error.message, error.status);
  }

  console.error(error);
  return errorJson("Internal server error", 500);
}

export async function parseJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function parseLimit(value: string | null, fallback = 10, max = 50) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}
