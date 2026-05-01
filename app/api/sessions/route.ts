import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createSessionSchema, sessionSignalsData } from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createSessionSchema.parse(await parseJson(request));
    const session = await prisma.workoutSession.create({
      data: {
        startedAt: body.startedAt ? new Date(body.startedAt) : undefined,
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
