import { Prisma } from "@prisma/client";
import { DEFAULT_USER_TIMEZONE } from "../time.ts";
import type { WhoopWorkout } from "./types";

function sportNameToActivityType(sportName: string) {
  const normalized = sportName.toLowerCase().replace(/[\s-]+/g, "_");

  if (["running", "track_&_field", "stroller_jogging"].includes(normalized)) {
    return "run";
  }
  if (["cycling", "mountain_biking", "spin", "assault_bike"].includes(normalized)) {
    return "bike";
  }
  if (["walking", "stroller_walking", "dog_walking"].includes(normalized)) {
    return "walk";
  }
  if (["hiking/rucking"].includes(normalized)) return "hike";
  if (normalized === "swimming") return "swim";
  if (normalized === "surfing") return "surf";
  if (normalized === "stairmaster" || normalized === "stadium_steps") {
    return "stairmaster";
  }
  if (normalized === "hiit") return "hiit";
  if (normalized === "sauna") return "sauna";
  if (["yoga", "pilates", "stretching", "barre"].includes(normalized)) {
    return "mobility";
  }

  return "other";
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

  return {
    type: sportNameToActivityType(workout.sport_name),
    modality: workout.sport_name,
    startedAt: new Date(workout.start),
    endedAt: new Date(workout.end),
    timeSource: "whoop_api",
    timezone: DEFAULT_USER_TIMEZONE,
    durationMinutes: durationMinutes(workout.start, workout.end),
    intensity: score?.strain && score.strain >= 14 ? "high" : undefined,
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
    notes: `WHOOP ${workout.score_state.toLowerCase()} workout (${workout.id})`
  };
}
