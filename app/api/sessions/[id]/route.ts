import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { updateWorkoutSession } from "@/lib/services/workout";
import { updateSessionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = updateSessionSchema.parse(await parseJson(request));
    const session = await updateWorkoutSession(id, body);

    return json({ session });
  } catch (error) {
    return handleRouteError(error);
  }
}
