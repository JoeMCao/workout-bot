import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseLimit } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { serializeRecentWorkoutSessionsForApi } from "@/lib/sessions/recent-response";
import { Prisma } from "@prisma/client";

function databaseHostLabel() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "DATABASE_URL not configured";
  }

  try {
    const url = new URL(databaseUrl);
    return `${url.host}${url.pathname}`;
  } catch {
    return "DATABASE_URL is not a valid URL";
  }
}

function logRecent(line: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      route: "/api/sessions/recent",
      ...line
    })
  );
}

function logRecentError(line: Record<string, unknown>) {
  console.error(
    JSON.stringify({
      route: "/api/sessions/recent",
      ...line
    })
  );
}

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

  try {
    logRecent({
      phase: "request",
      limit,
      database: databaseHostLabel()
    });

    logRecent({ phase: "query_start", limit });

    const sessions = await prisma.workoutSession.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      include: {
        sets: {
          orderBy: { completedAt: "asc" },
          include: {
            exercise: true
          }
        }
      }
    });

    logRecent({
      phase: "query_success",
      limit,
      count: sessions.length
    });

    const latestSession = sessions[0];
    const latestExerciseCount = latestSession
      ? new Set(latestSession.sets.map((set) => set.exerciseId)).size
      : 0;
    const latestSetCount = latestSession?.sets.length ?? 0;

    logRecent({
      phase: "serialization_start",
      limit,
      count: sessions.length
    });

    const mappedSessions = serializeRecentWorkoutSessionsForApi(sessions);

    logRecent({
      phase: "serialization_done",
      limit,
      count: mappedSessions.length
    });

    logRecent({
      phase: "response_ready",
      limit,
      latestSessionId: latestSession?.id ?? null,
      relatedExercises: latestExerciseCount,
      relatedSets: latestSetCount
    });

    return json({
      message:
        latestSession && latestExerciseCount === 0 && latestSetCount === 0
          ? "I found your latest session, but no exercise/set details are attached yet."
          : undefined,
      sessions: mappedSessions
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const prismaCode =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : undefined;

    logRecentError({
      phase: "error",
      limit,
      message: err.message,
      stack: err.stack ?? null,
      prismaCode: prismaCode ?? null
    });

    return handleRouteError(error);
  }
}
