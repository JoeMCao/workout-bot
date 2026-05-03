import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  activitySessionCreateData,
  createActivitySessionSchema
} from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createActivitySessionSchema.parse(await parseJson(request));

    if (body.relatedWorkoutSessionId) {
      const workout = await prisma.workoutSession.findUnique({
        where: { id: body.relatedWorkoutSessionId }
      });
      if (!workout) {
        return errorJson("Workout session not found", 404);
      }
    }

    const activity = await prisma.activitySession.create({
      data: activitySessionCreateData(body)
    });

    return json({ activity }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
