import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseLimit } from "@/lib/http";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
    console.info("[sessions/recent] endpoint hit", {
      limit,
      database: databaseHostLabel()
    });

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
    const latestSession = sessions[0];
    const latestExerciseCount = latestSession
      ? new Set(latestSession.sets.map((set) => set.exerciseId)).size
      : 0;
    const latestSetCount = latestSession?.sets.length ?? 0;

    console.info("[sessions/recent] query result", {
      sessionsFound: sessions.length,
      latestSessionId: latestSession?.id ?? null,
      startedAt: latestSession?.startedAt?.toISOString() ?? null,
      endedAt: latestSession?.endedAt?.toISOString() ?? null,
      relatedExercises: latestExerciseCount,
      relatedSets: latestSetCount
    });

    const mappedSessions = sessions.map((session) => {
      const exercises = new Map<
        string,
        {
          id: string;
          name: string;
          sets: Array<{
            id: string;
            sessionId: string;
            exerciseId: string;
            setNumber: number | null;
            weight: number | null;
            reps: number | null;
            rpe: number | null;
            rir: number | null;
            painFlag: boolean;
            painNotes: string | null;
            notes: string | null;
            completedAt: Date;
            createdAt: Date;
            updatedAt: Date;
          }>;
        }
      >();

      for (const set of session.sets) {
        const exercise = exercises.get(set.exerciseId) ?? {
          id: set.exercise.id,
          name: set.exercise.name,
          sets: []
        };

        exercise.sets.push({
          id: set.id,
          sessionId: set.sessionId,
          exerciseId: set.exerciseId,
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          rir: set.rir,
          painFlag: set.painFlag,
          painNotes: set.painNotes,
          notes: set.notes,
          completedAt: set.completedAt,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt
        });
        exercises.set(set.exerciseId, exercise);
      }

      return {
        ...session,
        sets: undefined,
        exercises: Array.from(exercises.values())
      };
    });

    return json({
      message:
        latestSession && latestExerciseCount === 0 && latestSetCount === 0
          ? "I found your latest session, but no exercise/set details are attached yet."
          : undefined,
      sessions: mappedSessions
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
