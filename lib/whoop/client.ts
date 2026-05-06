import { WHOOP_API_BASE_URL } from "./config";
import { WhoopSyncError } from "./sync-error";
import type { WhoopSyncLogEvent } from "./sync-log";
import type { WhoopWorkoutCollection } from "./types";

type SyncLogFn = (event: WhoopSyncLogEvent) => void;

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
  log
}: {
  accessToken: string;
  start?: string;
  end?: string;
  nextToken?: string;
  limit?: number;
  page?: number;
  log?: SyncLogFn;
}) {
  const url = new URL("/v2/activity/workout", WHOOP_API_BASE_URL);
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
      page: page ?? null,
      ok: false,
      status: response.status,
      responseBody: body
    });
    throw new WhoopSyncError(
      "WHOOP_FETCH_FAILED",
      `WHOOP workout API returned ${response.status}`,
      httpStatusForWhoopWorkoutApi(response.status),
      { httpStatus: response.status, body }
    );
  }

  const payload = body as WhoopWorkoutCollection & { nextToken?: string };
  const records = payload.records ?? [];
  const next_page =
    payload.next_token ?? payload.nextToken ?? undefined;

  log?.({
    phase: "whoop_workout_http",
    page: page ?? null,
    ok: true,
    status: response.status,
    recordCount: records.length,
    hasNextToken: Boolean(next_page)
  });

  return { records, next_token: next_page };
}
