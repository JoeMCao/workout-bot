import { WHOOP_API_BASE_URL } from "./config";
import { WhoopSyncError } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";
import type { WhoopWorkoutCollection } from "./types";

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

/** OpenAPI `servers[0].url`; requests without `/developer` return 404 on the workout collection path. */
const WHOOP_OPENAPI_SERVER_ORIGIN = "https://api.prod.whoop.com/developer";

function assertWhoopDataApiBaseMatchesOpenApi() {
  const normalized = WHOOP_API_BASE_URL.replace(/\/$/, "");
  if (normalized !== WHOOP_OPENAPI_SERVER_ORIGIN) {
    throw new WhoopSyncError(
      "WHOOP_CONFIG_INVALID",
      `WHOOP_API_BASE_URL must be ${WHOOP_OPENAPI_SERVER_ORIGIN} per WHOOP OpenAPI; got ${normalized}`,
      503
    );
  }
}

/** Non-sensitive headers useful when WHOOP returns 404/401 (no cookie/auth secrets expected). */
function whoopResponseHeadersForLog(headers: Headers) {
  const pick = [
    "content-type",
    "www-authenticate",
    "x-request-id",
    "cf-ray",
    "server"
  ] as const;
  const out: Record<string, string> = {};
  for (const k of pick) {
    const v = headers.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function httpStatusForWhoopWorkoutApi(status: number) {
  if (status === 401 || status === 403 || status === 429) return status;
  return 502;
}

/** WHOOP collection filters expect ISO-8601 instants; normalize offsets to UTC Z. */
function whoopQueryInstant(value: string) {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new WhoopSyncError(
      "WHOOP_QUERY_DATETIME_INVALID",
      `Invalid WHOOP query datetime: ${value}`,
      400
    );
  }
  return new Date(ms).toISOString();
}

export async function fetchWhoopWorkoutPage({
  accessToken,
  start,
  end,
  nextToken,
  limit = 25,
  page,
  log,
  /** Stored OAuth scope / flag for failure diagnostics (never logs tokens). */
  whoopConnectionContext
}: {
  accessToken: string;
  start?: string;
  end?: string;
  nextToken?: string;
  limit?: number;
  page?: number;
  log?: SyncLogFn;
  whoopConnectionContext?: {
    connectionScope: string | null;
    readWorkout: boolean;
  };
}) {
  assertWhoopDataApiBaseMatchesOpenApi();
  /**
   * Must not use `new URL("/v2/...", base)` when base path is `/developer`:
   * an absolute path replaces the entire base path and drops `/developer` (WHATWG URL rules).
   */
  const url = new URL(
    `${WHOOP_API_BASE_URL.replace(/\/$/, "")}/v2/activity/workout`
  );
  url.searchParams.set("limit", String(Math.min(limit, 25)));

  if (start) url.searchParams.set("start", whoopQueryInstant(start));
  if (end) url.searchParams.set("end", whoopQueryInstant(end));
  if (nextToken) url.searchParams.set("nextToken", nextToken);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    log?.({
      phase: "whoop_workout_http",
      requestUrl: url.toString(),
      page: page ?? null,
      ok: false,
      status: response.status,
      responseHeaders: whoopResponseHeadersForLog(response.headers),
      responseBody: body,
      ...(whoopConnectionContext
        ? {
            connectionScope: whoopConnectionContext.connectionScope,
            readWorkout: whoopConnectionContext.readWorkout
          }
        : {})
    });
    throw new WhoopSyncError(
      "WHOOP_FETCH_FAILED",
      `WHOOP workout API returned ${response.status}`,
      httpStatusForWhoopWorkoutApi(response.status),
      {
        requestUrl: url.toString(),
        httpStatus: response.status,
        body,
        responseHeaders: whoopResponseHeadersForLog(response.headers),
        ...(whoopConnectionContext
          ? {
              connectionScope: whoopConnectionContext.connectionScope,
              readWorkout: whoopConnectionContext.readWorkout
            }
          : {})
      }
    );
  }

  const payload = body as WhoopWorkoutCollection & { nextToken?: string };
  const records = payload.records ?? [];
  const next_page =
    payload.next_token ?? payload.nextToken ?? undefined;

  log?.({
    phase: "whoop_workout_http",
    requestUrl: url.toString(),
    page: page ?? null,
    ok: true,
    status: response.status,
    recordCount: records.length,
    hasNextToken: Boolean(next_page),
    ...(whoopConnectionContext
      ? {
          connectionScope: whoopConnectionContext.connectionScope,
          readWorkout: whoopConnectionContext.readWorkout
        }
      : {})
  });

  return { records, next_token: next_page };
}
