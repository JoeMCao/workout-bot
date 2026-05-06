import type { Prisma } from "@prisma/client";
import { DEFAULT_USER_TIMEZONE, getLocalDateKey } from "../time.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function asInt(value: unknown): number | undefined {
  const n = asNumber(value);
  if (n == null) return undefined;
  return Math.round(n);
}

function millisToSeconds(value: unknown): number | undefined {
  const n = asNumber(value);
  if (n == null) return undefined;
  return Math.round(n / 1000);
}

function sumSleepNeededSeconds(sleepNeeded: Record<string, unknown> | undefined): number | undefined {
  if (!sleepNeeded) return undefined;
  let sumMs = 0;
  let any = false;
  for (const v of Object.values(sleepNeeded)) {
    const ms = asNumber(v);
    if (ms != null && ms > 0) {
      sumMs += ms;
      any = true;
    }
  }
  return any ? Math.round(sumMs / 1000) : undefined;
}

/** Prefer WHOOP `id` when present; else stable key from `cycle_id` (integer or string). */
export function stableWhoopRecoverySourceId(raw: Record<string, unknown>): string | null {
  if (typeof raw.id === "string" && raw.id.length > 0) return raw.id;
  const cycle = raw.cycle_id;
  if (typeof cycle === "number" && Number.isFinite(cycle)) {
    return `whoop:recovery:cycle:${cycle}`;
  }
  if (typeof cycle === "string" && cycle.length > 0) {
    return `whoop:recovery:cycle:${cycle}`;
  }
  return null;
}

export function mapWhoopSleepToUpsert(
  rawUnknown: unknown
): (Prisma.WhoopSleepCreateInput & { sourceSleepId: string }) | null {
  if (!isRecord(rawUnknown)) return null;
  const raw = rawUnknown;
  const id = raw.id;
  if (typeof id !== "string" || !id.length) return null;

  const startRaw = raw.start;
  const endRaw = raw.end;
  const startedAt =
    typeof startRaw === "string" ? new Date(startRaw) : undefined;
  const endedAt = typeof endRaw === "string" ? new Date(endRaw) : undefined;

  const anchor =
    endedAt && !Number.isNaN(endedAt.getTime())
      ? endedAt
      : startedAt && !Number.isNaN(startedAt.getTime())
        ? startedAt
        : null;
  if (!anchor) return null;

  const localDate = getLocalDateKey(anchor, DEFAULT_USER_TIMEZONE);

  const scoreState =
    typeof raw.score_state === "string" ? raw.score_state : null;
  const scoreRaw = raw.score;
  const score = isRecord(scoreRaw) ? scoreRaw : null;
  const stage = score && isRecord(score.stage_summary) ? score.stage_summary : null;
  const sleepNeeded =
    score && isRecord(score.sleep_needed) ? score.sleep_needed : undefined;

  const light = millisToSeconds(stage?.total_light_sleep_time_milli);
  const sws = millisToSeconds(stage?.total_slow_wave_sleep_time_milli);
  const rem = millisToSeconds(stage?.total_rem_sleep_time_milli);
  const sleepDurationSeconds =
    light != null || sws != null || rem != null
      ? (light ?? 0) + (sws ?? 0) + (rem ?? 0)
      : undefined;

  return {
    sourceSleepId: id,
    localDate,
    startedAt:
      startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined,
    endedAt: endedAt && !Number.isNaN(endedAt.getTime()) ? endedAt : undefined,
    timezone: DEFAULT_USER_TIMEZONE,
    scoreState,
    sleepPerformancePercentage: asNumber(score?.sleep_performance_percentage),
    sleepConsistencyPercentage: asNumber(score?.sleep_consistency_percentage),
    sleepEfficiencyPercentage: asNumber(score?.sleep_efficiency_percentage),
    sleepNeededSeconds: sumSleepNeededSeconds(sleepNeeded),
    sleepDurationSeconds,
    timeInBedSeconds: millisToSeconds(stage?.total_in_bed_time_milli),
    awakeTimeSeconds: millisToSeconds(stage?.total_awake_time_milli),
    slowWaveSleepSeconds: sws,
    remSleepSeconds: rem,
    lightSleepSeconds: light,
    respiratoryRate: asNumber(score?.respiratory_rate),
    rawPayloadJson: raw as unknown as Prisma.InputJsonValue
  };
}

export function mapWhoopRecoveryToUpsert(
  rawUnknown: unknown
): (Prisma.WhoopRecoveryCreateInput & { sourceRecoveryId: string }) | null {
  if (!isRecord(rawUnknown)) return null;
  const raw = rawUnknown;
  const sourceRecoveryId = stableWhoopRecoverySourceId(raw);
  if (!sourceRecoveryId) return null;

  const updatedRaw = raw.updated_at;
  const createdRaw = raw.created_at;
  const ts =
    typeof updatedRaw === "string"
      ? new Date(updatedRaw)
      : typeof createdRaw === "string"
        ? new Date(createdRaw)
        : null;
  if (!ts || Number.isNaN(ts.getTime())) return null;

  const localDate = getLocalDateKey(ts, DEFAULT_USER_TIMEZONE);

  const scoreState =
    typeof raw.score_state === "string" ? raw.score_state : null;
  const scoreRaw = raw.score;
  const score = isRecord(scoreRaw) ? scoreRaw : null;

  const cycle = raw.cycle_id;
  const cycleId =
    typeof cycle === "number"
      ? String(cycle)
      : typeof cycle === "string"
        ? cycle
        : null;

  const sleepRef = raw.sleep_id;
  const sleepId = typeof sleepRef === "string" ? sleepRef : null;

  return {
    sourceRecoveryId,
    localDate,
    cycleId,
    sleepId,
    timezone: DEFAULT_USER_TIMEZONE,
    scoreState,
    recoveryScore: asInt(score?.recovery_score),
    restingHeartRate: asNumber(score?.resting_heart_rate),
    hrvRmssdMilli: asNumber(score?.hrv_rmssd_milli),
    spo2Percentage: asNumber(score?.spo2_percentage),
    skinTempCelsius: asNumber(score?.skin_temp_celsius),
    rawPayloadJson: raw as unknown as Prisma.InputJsonValue
  };
}
