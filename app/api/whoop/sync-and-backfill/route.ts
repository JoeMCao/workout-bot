import { z } from "zod";
import { logApiRequestDebug } from "@/lib/api-debug";
import { requireApiKey } from "@/lib/auth";
import { backfillStrengthActivityShells } from "@/lib/backfill/strength-activity-shells";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { WhoopSyncError } from "@/lib/whoop/sync-error";
import { createWhoopSyncLogger } from "@/lib/whoop/sync-log";
import { getWhoopStatus, syncWhoopWorkouts } from "@/lib/whoop/sync";

const bodySchema = z.object({
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

function shouldExposeWhoopSyncDetails(request: Request) {
  const debugHeader = request.headers.get("x-debug-whoop-sync");
  const debugOn = debugHeader === "1" || debugHeader?.toLowerCase() === "true";
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.WHOOP_SYNC_EXPOSE_ERRORS === "1" ||
    debugOn
  );
}

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  logApiRequestDebug(request, { operation: "whoop_sync_and_backfill_post" });

  const exposeDetails = shouldExposeWhoopSyncDetails(request);
  const userId = request.headers.get("x-user-id")?.trim() ?? null;
  const log = createWhoopSyncLogger({ userId });

  try {
    const parsed = bodySchema.parse(await parseJson(request));
    const maxPages = parsed.maxPages ?? 10;

    const syncResult = await syncWhoopWorkouts({
      request,
      start: parsed.start,
      end: parsed.end,
      maxPages,
      log,
      userId
    });

    const backfillResult = await backfillStrengthActivityShells();
    const whoop = await getWhoopStatus();

    return json({
      sync: syncResult,
      backfill: backfillResult,
      whoop
    });
  } catch (error) {
    if (error instanceof WhoopSyncError) {
      return json(
        {
          error: {
            message: error.message,
            code: error.code,
            ...(exposeDetails
              ? {
                  details: error.details,
                  whoop: await getWhoopStatus()
                }
              : {})
          }
        },
        error.httpStatus
      );
    }

    return handleRouteError(error);
  }
}
