import type { ActivitySession, WorkoutSession } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_USER_TIMEZONE, getLocalDateKey } from "@/lib/time";
import { WHOOP_STRENGTH_MATCH_WINDOW_MS } from "./adapter";

export type WhoopStrengthMatch =
  | { kind: "none" }
  | { kind: "ambiguous"; candidates: WorkoutSession[] }
  | {
      kind: "unique";
      workout: WorkoutSession;
      /** Existing ActivitySession shell for this WorkoutSession, if any (e.g. Phase 1 backfill). */
      shell: ActivitySession | null;
    };

/**
 * Find at most one WorkoutSession on the same America/Los_Angeles calendar day as the WHOOP
 * start, with startedAt within ±WHOOP_STRENGTH_MATCH_WINDOW_MS of that instant.
 * Multiple candidates → ambiguous (no auto-link; ActivitySession gets needs_review).
 */
export async function resolveWhoopStrengthWorkoutMatch(
  whoopStart: Date
): Promise<WhoopStrengthMatch> {
  const laDay = getLocalDateKey(whoopStart, DEFAULT_USER_TIMEZONE);
  const windowStart = new Date(whoopStart.getTime() - WHOOP_STRENGTH_MATCH_WINDOW_MS);
  const windowEnd = new Date(whoopStart.getTime() + WHOOP_STRENGTH_MATCH_WINDOW_MS);

  const candidates = await prisma.workoutSession.findMany({
    where: {
      startedAt: {
        gte: windowStart,
        lte: windowEnd
      }
    },
    include: {
      linkedActivitySessions: {
        orderBy: { startedAt: "desc" }
      }
    },
    orderBy: { startedAt: "asc" }
  });

  const sameDay = candidates.filter(
    (w) => getLocalDateKey(w.startedAt, DEFAULT_USER_TIMEZONE) === laDay
  );

  if (sameDay.length === 0) return { kind: "none" };
  if (sameDay.length > 1) return { kind: "ambiguous", candidates: sameDay };

  const workout = sameDay[0];
  const shell = workout.linkedActivitySessions[0] ?? null;
  return { kind: "unique", workout, shell };
}
