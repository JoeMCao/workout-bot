import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { updateSensationCheckInSchema } from "@/lib/sensation-validation";
import { updateSensationCheckIn, deleteSensationCheckIn } from "@/lib/services/sensation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    const body = updateSensationCheckInSchema.parse(await parseJson(request));
    return json({ checkIn: await updateSensationCheckIn(id, body) });
  } catch (error) { return handleRouteError(error); }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;
    return json(await deleteSensationCheckIn(id));
  } catch (error) { return handleRouteError(error); }
}
