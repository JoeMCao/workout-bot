/**
 * Deletes every WhoopWorkoutMapping row. Next WHOOP workout sync will recreate mappings
 * as it ingests workouts (insert vs update per WHOOP id).
 *
 * Does not delete ActivitySession, WhoopConnection, sleep, or recovery.
 * For a clean re-import of activities, run `wipe:activities` first or after, as you prefer.
 *
 * Usage:
 *   npx tsx scripts/wipe-whoop-workout-mappings.ts --yes
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing: pass --yes to delete all WhoopWorkoutMapping rows.");
    process.exitCode = 1;
    return;
  }

  const result = await prisma.whoopWorkoutMapping.deleteMany({});
  console.info(
    `[wipe-whoop-workout-mappings] Deleted ${result.count} mapping row(s). Run WHOOP workout sync to rebuild.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
