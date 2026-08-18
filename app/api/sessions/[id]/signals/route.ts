import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import {
  getWorkoutSignals,
  updateWorkoutSignals
} from "@/lib/services/workout";
import { sessionSignalsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const signals = await getWorkoutSignals(id);

    return json({ signals });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const body = sessionSignalsSchema.parse(await parseJson(request));
    const signals = await updateWorkoutSignals(id, body);

    return json({ signals });
  } catch (error) {
    return handleRouteError(error);
  }
}
