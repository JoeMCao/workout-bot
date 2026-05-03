import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  activitySessionUpdateData,
  updateActivitySessionSchema
} from "@/lib/validation";

const activityInclude = {
  relatedWorkoutSession: {
    select: {
      id: true,
      startedAt: true,
      sessionType: true,
      goal: true
    }
  }
} as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const activity = await prisma.activitySession.findUnique({
      where: { id },
      include: activityInclude
    });

    if (!activity) {
      return errorJson("Activity not found", 404);
    }

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
    const existing = await prisma.activitySession.findUnique({ where: { id } });

    if (!existing) {
      return errorJson("Activity not found", 404);
    }

    const body = updateActivitySessionSchema.parse(await parseJson(request));

    if (body.relatedWorkoutSessionId) {
      const workout = await prisma.workoutSession.findUnique({
        where: { id: body.relatedWorkoutSessionId }
      });
      if (!workout) {
        return errorJson("Workout session not found", 404);
      }
    }

    const activity = await prisma.activitySession.update({
      where: { id },
      data: activitySessionUpdateData(body),
      include: activityInclude
    });

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
    const existing = await prisma.activitySession.findUnique({ where: { id } });

    if (!existing) {
      return errorJson("Activity not found", 404);
    }

    await prisma.activitySession.delete({ where: { id } });

    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
