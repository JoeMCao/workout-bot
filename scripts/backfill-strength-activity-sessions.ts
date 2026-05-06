/**
 * Phase 1: For each WorkoutSession with no linked ActivitySession, create a shell
 * ActivitySession (type strength) and set relatedWorkoutSessionId.
 * Idempotent: safe to re-run; skips workouts that already have linked activities.
 *
 * Usage: npx tsx scripts/backfill-strength-activity-sessions.ts
 * Requires DATABASE_URL (e.g. from .env).
 *
 * Logic lives in `lib/backfill/strength-activity-shells.ts` (also used by dashboard WHOOP sync).
 */
import "dotenv/config";
import { backfillStrengthActivityShells } from "../lib/backfill/strength-activity-shells";

async function main() {
  const { eligible, created } = await backfillStrengthActivityShells();
  console.info(
    `[backfill-strength-activities] WorkoutSessions without link: ${eligible}; created ActivitySessions: ${created}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
