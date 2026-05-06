import type { WhoopWorkout } from "./types";
import type { WhoopSyncLogEvent } from "./sync-log";

type LogFn = (event: WhoopSyncLogEvent) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Coerce WHOOP v2 workout JSON into our shape; tolerate missing score / optional fields.
 * Returns null if the record cannot represent a persistable workout (missing id/start/end).
 */
export function normalizeWhoopWorkoutRecord(
  raw: unknown,
  log?: LogFn
): WhoopWorkout | null {
  if (!isRecord(raw)) {
    log?.({ phase: "workout_normalize", ok: false, reason: "not_object" });
    return null;
  }

  const id = raw.id;
  if (typeof id !== "string" || id.length === 0) {
    log?.({ phase: "workout_normalize", ok: false, reason: "missing_or_invalid_id" });
    return null;
  }

  const start = raw.start;
  const end = raw.end;
  if (typeof start !== "string" || typeof end !== "string") {
    log?.({ phase: "workout_normalize", ok: false, reason: "missing_start_or_end", whoopWorkoutId: id });
    return null;
  }

  const sportName =
    typeof raw.sport_name === "string"
      ? raw.sport_name
      : typeof raw.sport_name === "number"
        ? String(raw.sport_name)
        : "unknown";

  const scoreStateRaw = raw.score_state;
  let score_state: WhoopWorkout["score_state"] = "PENDING_SCORE";
  if (
    scoreStateRaw === "SCORED" ||
    scoreStateRaw === "PENDING_SCORE" ||
    scoreStateRaw === "UNSCORABLE"
  ) {
    score_state = scoreStateRaw;
  }

  const userId = asOptionalNumber(raw.user_id);

  const scoreRaw = raw.score;
  const score =
    isRecord(scoreRaw) || scoreRaw == null
      ? scoreRaw == null
        ? undefined
        : {
            strain: asOptionalNumber(scoreRaw.strain),
            average_heart_rate: asOptionalNumber(scoreRaw.average_heart_rate),
            max_heart_rate: asOptionalNumber(scoreRaw.max_heart_rate),
            kilojoule: asOptionalNumber(scoreRaw.kilojoule),
            distance_meter: asOptionalNumber(scoreRaw.distance_meter),
            altitude_gain_meter: asOptionalNumber(scoreRaw.altitude_gain_meter),
            altitude_change_meter: asOptionalNumber(scoreRaw.altitude_change_meter),
            zone_durations: isRecord(scoreRaw.zone_durations)
              ? {
                  zone_zero_milli: asOptionalNumber(scoreRaw.zone_durations.zone_zero_milli),
                  zone_one_milli: asOptionalNumber(scoreRaw.zone_durations.zone_one_milli),
                  zone_two_milli: asOptionalNumber(scoreRaw.zone_durations.zone_two_milli),
                  zone_three_milli: asOptionalNumber(scoreRaw.zone_durations.zone_three_milli),
                  zone_four_milli: asOptionalNumber(scoreRaw.zone_durations.zone_four_milli),
                  zone_five_milli: asOptionalNumber(scoreRaw.zone_durations.zone_five_milli)
                }
              : undefined
          }
      : undefined;

  log?.({
    phase: "workout_normalize",
    ok: true,
    whoopWorkoutId: id,
    hasScore: score != null,
    scoreState: score_state
  });

  return {
    id,
    v1_id: asOptionalNumber(raw.v1_id),
    ...(userId != null ? { user_id: userId } : {}),
    created_at: typeof raw.created_at === "string" ? raw.created_at : start,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : end,
    start,
    end,
    timezone_offset:
      typeof raw.timezone_offset === "string" ? raw.timezone_offset : "",
    sport_name: sportName,
    score_state,
    score,
    sport_id: asOptionalNumber(raw.sport_id)
  };
}
