import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { workoutSessionTimeSource } from "@/lib/time";
import { sessionSignalsData, updateSessionSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const existing = await prisma.workoutSession.findUnique({ where: { id } });

    if (!existing) {
      return errorJson("Session not found", 404);
    }

    const body = updateSessionSchema.parse(await parseJson(request));
    const session = await prisma.workoutSession.update({
      where: { id },
      data: {
        startedAt:
          body.startedAt !== undefined
            ? new Date(body.startedAt)
            : undefined,
        timeSource:
          body.startedAt !== undefined
            ? workoutSessionTimeSource.userProvided
            : undefined,
        endedAt:
          body.endedAt === null
            ? null
            : body.endedAt
              ? new Date(body.endedAt)
              : undefined,
        sessionType: body.sessionType,
        goal: body.goal,
        readinessScore: body.readinessScore,
        energy: body.energy,
        soreness: body.soreness,
        sleepQuality: body.sleepQuality,
        notes: body.notes,
        ...sessionSignalsData(body)
      }
    });

    return json({ session });
  } catch (error) {
    return handleRouteError(error);
  }
}
