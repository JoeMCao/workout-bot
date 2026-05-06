import { z } from "zod";
import { logApiRequestDebug } from "@/lib/api-debug";
import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { WhoopSyncError } from "@/lib/whoop/sync-error";
import { createWhoopSyncLogger } from "@/lib/whoop/sync-log";
import { syncWhoopHealthContext } from "@/lib/whoop/health-context-sync";
import { getWhoopStatus } from "@/lib/whoop/sync";

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

  logApiRequestDebug(request, { operation: "whoop_health_context_sync_post" });

  const exposeDetails = shouldExposeWhoopSyncDetails(request);
  const userId = request.headers.get("x-user-id")?.trim() ?? null;
  const log = createWhoopSyncLogger({ userId });

  try {
    const parsed = bodySchema.parse(await parseJson(request));
    const maxPages = parsed.maxPages ?? 10;

    const result = await syncWhoopHealthContext({
      request,
      start: parsed.start,
      end: parsed.end,
      maxPages,
      log,
      userId
    });

    const whoop = await getWhoopStatus();

    return json({ result, whoop });
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
