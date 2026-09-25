import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { createActivitySession } from "@/lib/services/activity";
import { createActivitySessionSchema } from "@/lib/validation";
import { journalEventIdSchema } from "@/lib/sensation-validation";

const requestSchema = createActivitySessionSchema.extend({ clientEventId: journalEventIdSchema.optional() });

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { clientEventId, ...body } = requestSchema.parse(await parseJson(request));
    const headerEventId = request.headers.get("idempotency-key")?.trim() || undefined;
    if (clientEventId && headerEventId && clientEventId !== headerEventId) {
      return errorJson("clientEventId and idempotency-key must match", 400);
    }
    const { value: activity, receipt } = await createActivitySession(body, {
      source: "rest",
      clientEventId: clientEventId ?? headerEventId
    });

    return json({ activity, receipt }, receipt?.status === "replayed" ? 200 : 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
