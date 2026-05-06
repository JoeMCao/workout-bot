import { z } from "zod";
import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { WhoopSyncError } from "@/lib/whoop/sync-error";
import { createWhoopSyncLogger } from "@/lib/whoop/sync-log";
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

const exposeWhoopSyncDetails =
  process.env.NODE_ENV !== "production" ||
  process.env.WHOOP_SYNC_EXPOSE_ERRORS === "1";

/** Legacy string errors from older call paths (if any). */
function mapLegacyWhoopSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("WHOOP_CLIENT_ID") ||
    message.includes("WHOOP_CLIENT_SECRET") ||
    message.includes("WHOOP_REDIRECT_URI") ||
    message.includes("WHOOP_TOKEN_ENCRYPTION_KEY")
  ) {
    return errorJson("WHOOP is not configured on the server", 503);
  }

  return null;
}

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const userId = request.headers.get("x-user-id")?.trim() ?? null;
  const log = createWhoopSyncLogger({ userId });

  try {
    const body = syncSchema.parse(await parseJson(request));
    const result = await syncWhoopWorkouts({
      request,
      ...body,
      log,
      userId
    });

    return json({ result });
  } catch (error) {
    if (error instanceof WhoopSyncError) {
      return json(
        {
          error: {
            message: error.message,
            code: error.code,
            ...(exposeWhoopSyncDetails ? { details: error.details } : {})
          }
        },
        error.httpStatus
      );
    }

    const mapped = mapLegacyWhoopSyncError(error);
    if (mapped) return mapped;

    return handleRouteError(error);
  }
}
