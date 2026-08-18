/**
 * Legacy / manual WHOOP activity creation (fallback).
 * Preferred path: WHOOP OAuth + POST /api/whoop/sync; read ActivitySession via GET /api/activity-sessions/recent.
 * Keep this route for offline sync, historical import, screenshot recovery, and backward-compatible GPT clients.
 */
import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { createActivitySession } from "@/lib/services/activity";
import { createActivitySessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const raw = (await parseJson(request)) as Record<string, unknown>;
    const body = createActivitySessionSchema.parse({
      ...raw,
      source: raw.source ?? "whoop_screenshot"
    });
    const { value: activity } = await createActivitySession(body, {
      source: "rest",
      mode: "whoop",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });

    return json({ activity }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
