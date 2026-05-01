import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sessionSignalsData, sessionSignalsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const signalsSelect = {
  id: true,
  lowBackPain: true,
  lowBackPainSeverity: true,
  elbowIrritation: true,
  neckTightness: true,
  shoulderIrritation: true,
  fatigueLevel: true,
  motivationLevel: true,
  sorenessAreas: true,
  readinessNotes: true,
  whoopRecoveryScore: true,
  whoopSleepPerformance: true,
  whoopSleepEfficiency: true,
  whoopHrvRmssd: true,
  whoopRestingHeartRate: true,
  whoopStrainYesterday: true,
  whoopDataFetchedAt: true,
  whoopRaw: true,
  updatedAt: true
} as const;

export async function GET(request: Request, context: RouteContext) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const signals = await prisma.workoutSession.findUnique({
      where: { id },
      select: signalsSelect
    });

    if (!signals) {
      return errorJson("Session not found", 404);
    }

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
    const existing = await prisma.workoutSession.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      return errorJson("Session not found", 404);
    }

    const body = sessionSignalsSchema.parse(await parseJson(request));
    const signals = await prisma.workoutSession.update({
      where: { id },
      data: sessionSignalsData(body),
      select: signalsSelect
    });

    return json({ signals });
  } catch (error) {
    return handleRouteError(error);
  }
}
