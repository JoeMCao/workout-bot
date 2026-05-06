import { requireApiKey } from "@/lib/auth";
import { errorJson, handleRouteError, json, parseJson } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { appendSessionExerciseNotes } from "@/lib/workout-session-exercise";
import {
  createSetSchema,
  displayExerciseName,
  normalizeExerciseName
} from "@/lib/validation";

export async function POST(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = createSetSchema.parse(await parseJson(request));
    const session = await prisma.workoutSession.findUnique({
      where: { id: body.sessionId },
      select: { id: true }
    });

    if (!session) {
      return errorJson("Session not found", 404);
    }

    const exerciseName = displayExerciseName(body.exerciseName);
    const normalizedName = normalizeExerciseName(body.exerciseName);
    const exercise = await prisma.exercise.upsert({
      where: { normalizedName },
      create: {
        name: exerciseName,
        normalizedName
      },
      update: {}
    });

    const set = await prisma.$transaction(async (tx) => {
      const created = await tx.exerciseSet.create({
        data: {
          sessionId: body.sessionId,
          exerciseId: exercise.id,
          setNumber: body.setNumber,
          weight: body.weight,
          reps: body.reps,
          rpe: body.rpe,
          rir: body.rir,
          painFlag: body.painFlag ?? false,
          painNotes: body.painNotes,
          notes: body.notes,
          completedAt: body.completedAt ? new Date(body.completedAt) : undefined
        },
        include: {
          exercise: true
        }
      });

      const hasExerciseMeta =
        body.exerciseDisplayName !== undefined ||
        body.exerciseNotes !== undefined;

      if (hasExerciseMeta) {
        const display =
          body.exerciseDisplayName !== undefined
            ? displayExerciseName(body.exerciseDisplayName)
            : undefined;

        const row = await tx.workoutSessionExercise.findUnique({
          where: {
            sessionId_exerciseId: {
              sessionId: body.sessionId,
              exerciseId: exercise.id
            }
          }
        });

        if (!row) {
          await tx.workoutSessionExercise.create({
            data: {
              sessionId: body.sessionId,
              exerciseId: exercise.id,
              displayName: display ?? null,
              notes: body.exerciseNotes ?? null
            }
          });
        } else {
          await tx.workoutSessionExercise.update({
            where: { id: row.id },
            data: {
              ...(display !== undefined ? { displayName: display } : {}),
              ...(body.exerciseNotes !== undefined
                ? {
                    notes: appendSessionExerciseNotes(
                      row.notes,
                      body.exerciseNotes
                    )
                  }
                : {})
            }
          });
        }
      } else {
        await tx.workoutSessionExercise.upsert({
          where: {
            sessionId_exerciseId: {
              sessionId: body.sessionId,
              exerciseId: exercise.id
            }
          },
          create: {
            sessionId: body.sessionId,
            exerciseId: exercise.id
          },
          update: {}
        });
      }

      return created;
    });

    return json(
      {
        set: {
          id: set.id,
          sessionId: set.sessionId,
          exerciseId: set.exerciseId,
          exercise: {
            id: exercise.id,
            name: exercise.name
          },
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
        }
      },
      201
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
