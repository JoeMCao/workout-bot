import { requireApiKey } from "@/lib/auth";
import { handleRouteError, json, parseLimit } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"));
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

    return json({
      sessions: sessions.map((session) => {
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
      })
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
