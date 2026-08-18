import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { createActivitySession } from "@/lib/services/activity";
import { createActivitySessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createActivitySessionSchema.parse(await parseJson(request));
    const { value: activity } = await createActivitySession(body, {
      source: "rest",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });

    return json({ activity }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
