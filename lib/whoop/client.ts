import { WHOOP_API_BASE_URL } from "./config";
import type { WhoopWorkoutCollection } from "./types";

/** WHOOP collection filters expect ISO-8601 instants; normalize offsets to UTC Z. */
function whoopQueryInstant(value: string) {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid WHOOP query datetime: ${value}`);
  }
  return new Date(ms).toISOString();
}

export async function fetchWhoopWorkoutPage({
  accessToken,
  start,
  end,
  nextToken,
  limit = 25
}: {
  accessToken: string;
  start?: string;
  end?: string;
  nextToken?: string;
  limit?: number;
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
    throw new Error(
      `WHOOP workout fetch failed (${response.status}): ${JSON.stringify(body)}`
    );
  }

  const payload = body as WhoopWorkoutCollection & { nextToken?: string };
  const records = payload.records ?? [];
  const next_page =
    payload.next_token ?? payload.nextToken ?? undefined;

  return { records, next_token: next_page };
}
