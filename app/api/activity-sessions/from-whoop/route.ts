import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { activitySessionTimeSource, getServerNow } from "@/lib/time";
import {
  activitySessionCreateData,
  createActivitySessionSchema
} from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const raw = (await parseJson(request)) as Record<string, unknown>;
    const body = createActivitySessionSchema.parse({
      ...raw,
      source: raw.source ?? "whoop_screenshot"
    });
    const startedAtRaw = body.startedAt;
    const hasStartedAt = startedAtRaw != null;
    const startedAt = hasStartedAt ? new Date(startedAtRaw) : getServerNow();
    const timeSource = hasStartedAt
      ? activitySessionTimeSource.whoopScreenshot
      : activitySessionTimeSource.apiDefault;

    console.info(
      `[activity-session] create (from-whoop) timeSource=${timeSource} type=${body.type}`
    );

    if (body.relatedWorkoutSessionId) {
      const workout = await prisma.workoutSession.findUnique({
        where: { id: body.relatedWorkoutSessionId }
      });
      if (!workout) {
        return errorJson("Workout session not found", 404);
      }
    }

    const activity = await prisma.activitySession.create({
      data: activitySessionCreateData(body, { startedAt, timeSource })
    });

    return json({ activity }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
