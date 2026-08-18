import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { createWorkoutSession } from "@/lib/services/workout";
import { createSessionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createSessionSchema.parse(await parseJson(request));
    const { value: session } = await createWorkoutSession(body, {
      source: "rest",
      clientEventId: request.headers.get("idempotency-key")?.trim() || undefined
    });

    return json({ session }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
