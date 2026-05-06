import { WHOOP_API_BASE_URL } from "./config";
import type { WhoopWorkoutCollection } from "./types";

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

  if (start) url.searchParams.set("start", start);
  if (end) url.searchParams.set("end", end);
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

  return body as WhoopWorkoutCollection;
}
