import { z } from "zod";
import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { syncWhoopWorkouts } from "@/lib/whoop/sync";

const syncSchema = z.object({
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  maxPages: z.number().int().min(1).max(20).optional()
});

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = syncSchema.parse(await parseJson(request));
    const result = await syncWhoopWorkouts({ request, ...body });

    return json({ result });
  } catch (error) {
    return handleRouteError(error);
  }
}
