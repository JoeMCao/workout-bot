import { Prisma } from "@prisma/client";
import { activitySessionTimeSource, DEFAULT_USER_TIMEZONE } from "../time.ts";
import type { WhoopWorkout } from "./types";

/** WHOOP sport_name normalized like existing mappings (lowercase, spaces/hyphens → _). */
function normalizeWhoopSportKey(sportName: string) {
  return sportName
    .toLowerCase()
    .trim()
    .replace(/[/]+/g, "_")
    .replace(/[\s-]+/g, "_")
    .replace(/&/g, "and");
}

/**
 * WHOOP labels we normalize to ActivitySession.type = "strength".
 * Physiology lives on ActivitySession; WorkoutSession is only for logged sets — never inferred from WHOOP.
 */
export const WHOOP_STRENGTH_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

/** GPT / API: only values we persist today; extend as needed. */
export const activitySyncStatus = {
  needsReview: "needs_review"
} as const;

const WHOOP_STRENGTH_KEYS = new Set([
  "functional_fitness",
  "weightlifting",
  "strength_training",
  "strength",
  "gym",
  "crossfit",
  "powerlifting",
  "olympic_weightlifting",
  "bootcamp",
  "circuit_training",
  "barbell",
  "free_weights",
  "machine_weights"
]);

export function whoopWorkoutIsStrengthLike(workout: WhoopWorkout): boolean {
  return WHOOP_STRENGTH_KEYS.has(normalizeWhoopSportKey(workout.sport_name));
}

/** User-facing modality for strength-capable WHOOP sports (underscore form). */
function strengthModalityFromKey(key: string): string {
  if (!WHOOP_STRENGTH_KEYS.has(key)) return "functional_fitness";
  return key;
}

function whoopSportToCanonicalTypeAndModality(sportName: string): {
  type: string;
  modality: string;
} {
  const key = normalizeWhoopSportKey(sportName);

  if (WHOOP_STRENGTH_KEYS.has(key)) {
    return { type: "strength", modality: strengthModalityFromKey(key) };
  }

  if (["running", "track_and_field", "stroller_jogging"].includes(key)) {
    return { type: "run", modality: "run" };
  }
  if (["cycling", "mountain_biking", "spin", "assault_bike"].includes(key)) {
    return { type: "bike", modality: "bike" };
  }
  if (["walking", "stroller_walking", "dog_walking"].includes(key)) {
    return { type: "walk", modality: "walk" };
  }
  if (key === "hiking_rucking" || key === "hiking/rucking") {
    return { type: "hike", modality: "hike" };
  }
  if (key === "swimming") return { type: "swim", modality: "swim" };
  if (key === "surfing") return { type: "surf", modality: "surf" };
  if (key === "stairmaster" || key === "stadium_steps") {
    return { type: "stairmaster", modality: "stairmaster" };
  }
  if (key === "hiit") return { type: "hiit", modality: "hiit" };
  if (key === "sauna") return { type: "sauna", modality: "sauna" };
  if (["yoga", "pilates", "stretching", "barre"].includes(key)) {
    return { type: "mobility", modality: key };
  }

  return { type: "other", modality: key || "other" };
}

function durationMinutes(start: string, end: string) {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return diffMs > 0 ? diffMs / 60_000 : undefined;
}

function zoneMinutes(milliseconds?: number) {
  return milliseconds == null ? undefined : milliseconds / 60_000;
}

function caloriesFromKilojoules(kilojoule?: number) {
  return kilojoule == null ? undefined : Math.round(kilojoule / 4.184);
}

export function whoopWorkoutToActivityData(
  workout: WhoopWorkout
): Prisma.ActivitySessionCreateInput {
  const score = workout.score;
  const zones = score?.zone_durations;
  const { type, modality } = whoopSportToCanonicalTypeAndModality(workout.sport_name);
  const rawPayloadJson = workout as unknown as Prisma.InputJsonValue;
  const stateLabel = (workout.score_state ?? "pending_score").toLowerCase();

  return {
    type,
    modality,
    sourceActivityType: workout.sport_name,
    rawPayloadJson,
    startedAt: new Date(workout.start),
    endedAt: new Date(workout.end),
    timeSource: activitySessionTimeSource.whoopApi,
    timezone: DEFAULT_USER_TIMEZONE,
    durationMinutes: durationMinutes(workout.start, workout.end),
    intensity: score?.strain != null && score.strain >= 14 ? "high" : undefined,
    avgHeartRate: score?.average_heart_rate,
    maxHeartRate: score?.max_heart_rate,
    calories: caloriesFromKilojoules(score?.kilojoule),
    distanceMeters: score?.distance_meter,
    elevationGainMeters: score?.altitude_gain_meter,
    strain: score?.strain,
    zone0Minutes: zoneMinutes(zones?.zone_zero_milli),
    zone1Minutes: zoneMinutes(zones?.zone_one_milli),
    zone2Minutes: zoneMinutes(zones?.zone_two_milli),
    zone3Minutes: zoneMinutes(zones?.zone_three_milli),
    zone4Minutes: zoneMinutes(zones?.zone_four_milli),
    zone5Minutes: zoneMinutes(zones?.zone_five_milli),
    source: "whoop_api",
    notes: `WHOOP ${stateLabel} (${workout.id})`
  };
}

/** WHOOP fields safe for ActivitySession.update (no nested creates). */
export function whoopWorkoutToActivitySessionUpdateInput(
  workout: WhoopWorkout,
  options: { syncStatus?: string | null } = {}
): Prisma.ActivitySessionUpdateInput {
  const b = whoopWorkoutToActivityData(workout);
  return {
    type: b.type,
    modality: b.modality,
    sourceActivityType: b.sourceActivityType,
    rawPayloadJson: b.rawPayloadJson,
    startedAt: b.startedAt,
    endedAt: b.endedAt,
    timeSource: b.timeSource,
    timezone: b.timezone,
    durationMinutes: b.durationMinutes,
    intensity: b.intensity,
    avgHeartRate: b.avgHeartRate,
    maxHeartRate: b.maxHeartRate,
    calories: b.calories,
    distanceMeters: b.distanceMeters,
    elevationGainMeters: b.elevationGainMeters,
    strain: b.strain,
    zone0Minutes: b.zone0Minutes,
    zone1Minutes: b.zone1Minutes,
    zone2Minutes: b.zone2Minutes,
    zone3Minutes: b.zone3Minutes,
    zone4Minutes: b.zone4Minutes,
    zone5Minutes: b.zone5Minutes,
    source: b.source,
    notes: b.notes,
    ...(options.syncStatus !== undefined ? { syncStatus: options.syncStatus } : {})
  };
}
