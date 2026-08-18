import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import {
  deleteActivitySession,
  getActivitySession,
  updateActivitySession
} from "@/lib/services/activity";
import { updateActivitySessionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const activity = await getActivitySession(id);

    return json({ activity });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = updateActivitySessionSchema.parse(await parseJson(request));
    const activity = await updateActivitySession(id, body);

    return json({ activity });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authError = requireApiKey(_request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    return json(await deleteActivitySession(id));
  } catch (error) {
    return handleRouteError(error);
  }
}
