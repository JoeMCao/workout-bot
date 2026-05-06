import type { WhoopStrengthMatch } from "./strength-match";

/**
 * When re-syncing an existing WHOOP-mapped ActivitySession that is strength-like and
 * **unlinked** (no relatedWorkoutSessionId), decides whether sync may clear review state.
 *
 * - **clear** → set `syncStatus` null and allow linking in the same update.
 * - **needs_review** → keep or set `needs_review` (ambiguous / no match / conflicting shell).
 */
export function strengthUnlinkedResyncSyncStatusDecision(args: {
  match: WhoopStrengthMatch;
  activityId: string;
}): "clear" | "needs_review" {
  const { match, activityId } = args;

  if (match.kind !== "unique") {
    return "needs_review";
  }

  const shell = match.shell;
  if (!shell || shell.id === activityId) {
    return "clear";
  }

  return "needs_review";
}
