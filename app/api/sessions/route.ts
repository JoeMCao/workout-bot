import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_USER_TIMEZONE,
  getServerNow,
  workoutSessionTimeSource
} from "@/lib/time";
import { createSessionSchema, sessionSignalsData } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createSessionSchema.parse(await parseJson(request));
    const startedAtRaw = body.startedAt;
    const hasStartedAt = startedAtRaw != null;
    const startedAt = hasStartedAt ? new Date(startedAtRaw) : getServerNow();
    const timeSource = hasStartedAt
      ? workoutSessionTimeSource.userProvided
      : workoutSessionTimeSource.apiDefault;

    console.info(`[workout-session] create timeSource=${timeSource}`);

    const session = await prisma.workoutSession.create({
      data: {
        startedAt,
        timeSource,
        timezone: DEFAULT_USER_TIMEZONE,
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

    return json({ session }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
