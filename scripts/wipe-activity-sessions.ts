/**
 * Deletes every ActivitySession row. WHOOP mappings keep `whoopWorkoutId` but
 * `activitySessionId` is set to NULL (FK ON DELETE SET NULL) so the next sync can recreate activities.
 *
 * Does not delete WorkoutSession or ExerciseSet.
 *
 * Usage:
 *   npx tsx scripts/wipe-activity-sessions.ts --yes
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing: pass --yes to delete all ActivitySession rows.");
    process.exitCode = 1;
    return;
  }

  const result = await prisma.activitySession.deleteMany({});
  console.info(
    `[wipe-activity-sessions] Deleted ${result.count} ActivitySession row(s). Re-run WHOOP sync to pull activities again.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
