/**
 * Creates empty WorkoutSessionExercise rows for every (sessionId, exerciseId) that has sets
 * but no metadata row yet, so sessionExerciseId is available for updateSessionExercise.
 *
 * Usage: npx tsx scripts/backfill-workout-session-exercises.ts
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const pairs = await prisma.exerciseSet.groupBy({
    by: ["sessionId", "exerciseId"]
  });

  let created = 0;
  for (const p of pairs) {
    const existing = await prisma.workoutSessionExercise.findUnique({
      where: {
        sessionId_exerciseId: {
          sessionId: p.sessionId,
          exerciseId: p.exerciseId
        }
      }
    });
    if (existing) continue;
    await prisma.workoutSessionExercise.create({
      data: {
        sessionId: p.sessionId,
        exerciseId: p.exerciseId
      }
    });
    created += 1;
  }

  console.info(
    `[backfill-workout-session-exercises] Distinct session/exercise pairs: ${pairs.length}; new rows: ${created}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
