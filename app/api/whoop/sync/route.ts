import { z } from "zod";
import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { syncWhoopWorkouts } from "@/lib/whoop/sync";

const syncSchema = z.object({
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  maxPages: z.preprocess(
    (value) =>
      value === undefined || value === null || value === ""
        ? undefined
        : Number(value),
    z.number().int().min(1).max(20).optional()
  )
});

function mapWhoopSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message === "WHOOP is not connected") {
    return errorJson(message, 401);
  }

  if (
    message.startsWith("WHOOP workout fetch failed") ||
    message.startsWith("WHOOP token request failed")
  ) {
    return errorJson(message, 502);
  }

  if (
    message.startsWith("Invalid WHOOP query datetime:") ||
    message.startsWith("Invalid WHOOP")
  ) {
    return errorJson(message, 400);
  }

  if (
    message.includes("WHOOP_CLIENT_ID") ||
    message.includes("WHOOP_CLIENT_SECRET") ||
    message.includes("WHOOP_REDIRECT_URI") ||
    message.includes("WHOOP_TOKEN_ENCRYPTION_KEY")
  ) {
    return errorJson("WHOOP is not configured on the server", 503);
  }

  if (message.includes("Invalid encrypted") || message.includes("decrypt")) {
    return errorJson(
      "Stored WHOOP tokens could not be decrypted (check WHOOP_TOKEN_ENCRYPTION_KEY or reconnect WHOOP)",
      401
    );
  }

  return null;
}

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = syncSchema.parse(await parseJson(request));
    const result = await syncWhoopWorkouts({ request, ...body });

    return json({ result });
  } catch (error) {
    const mapped = mapWhoopSyncError(error);
    if (mapped) return mapped;
    return handleRouteError(error);
  }
}
