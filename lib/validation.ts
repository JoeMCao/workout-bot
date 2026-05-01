import { Prisma } from "@prisma/client";
import { z } from "zod";

const optionalIsoDate = z.string().datetime({ offset: true }).optional();
const optionalTrimmedString = z.string().trim().min(1).optional();
const severitySchema = z.enum(["none", "mild", "moderate", "severe"]);
const levelSchema = z.enum(["low", "medium", "high"]);
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const nullableSeverity = severitySchema.nullable().optional();
const nullableLevel = levelSchema.nullable().optional();
const nullableString = z.string().trim().min(1).nullable().optional();
const nullableIsoDate = z.string().datetime({ offset: true }).nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableInt = z.number().int().nullable().optional();

export const sessionSignalsSchema = z.object({
  lowBackPain: z.boolean().nullable().optional(),
  lowBackPainSeverity: nullableSeverity,
  elbowIrritation: nullableSeverity,
  neckTightness: nullableSeverity,
  shoulderIrritation: nullableSeverity,
  fatigueLevel: nullableLevel,
  motivationLevel: nullableLevel,
  sorenessAreas: z.array(z.string().trim().min(1)).nullable().optional(),
  readinessNotes: nullableString,
  whoopRecoveryScore: nullableInt,
  whoopSleepPerformance: nullableNumber,
  whoopSleepEfficiency: nullableNumber,
  whoopHrvRmssd: nullableNumber,
  whoopRestingHeartRate: nullableNumber,
  whoopStrainYesterday: nullableNumber,
  whoopDataFetchedAt: nullableIsoDate,
  whoopRaw: jsonValueSchema.nullable().optional()
});

export const createSessionSchema = z
  .object({
    startedAt: optionalIsoDate,
    sessionType: optionalTrimmedString,
    goal: optionalTrimmedString,
    readinessScore: z.number().int().optional(),
    energy: z.number().int().optional(),
    soreness: optionalTrimmedString,
    sleepQuality: optionalTrimmedString,
    notes: optionalTrimmedString
  })
  .extend(sessionSignalsSchema.shape);

export const updateSessionSchema = createSessionSchema
  .extend({
    endedAt: optionalIsoDate.nullable()
  })
  .partial();

export const createSetSchema = z.object({
  sessionId: z.string().trim().min(1),
  exerciseName: z.string().trim().min(1),
  setNumber: z.number().int().optional(),
  weight: z.number().optional(),
  reps: z.number().int().optional(),
  rpe: z.number().optional(),
  rir: z.number().optional(),
  painFlag: z.boolean().optional(),
  painNotes: optionalTrimmedString,
  notes: optionalTrimmedString,
  completedAt: optionalIsoDate
});

export function toDate(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  if (!value) {
    return undefined;
  }

  return new Date(value);
}

export function normalizeExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayExerciseName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function sessionSignalsData(
  signals: z.infer<typeof sessionSignalsSchema>
) {
  return {
    lowBackPain: signals.lowBackPain,
    lowBackPainSeverity: signals.lowBackPainSeverity,
    elbowIrritation: signals.elbowIrritation,
    neckTightness: signals.neckTightness,
    shoulderIrritation: signals.shoulderIrritation,
    fatigueLevel: signals.fatigueLevel,
    motivationLevel: signals.motivationLevel,
    sorenessAreas:
      signals.sorenessAreas === null
        ? Prisma.JsonNull
        : signals.sorenessAreas,
    readinessNotes: signals.readinessNotes,
    whoopRecoveryScore: signals.whoopRecoveryScore,
    whoopSleepPerformance: signals.whoopSleepPerformance,
    whoopSleepEfficiency: signals.whoopSleepEfficiency,
    whoopHrvRmssd: signals.whoopHrvRmssd,
    whoopRestingHeartRate: signals.whoopRestingHeartRate,
    whoopStrainYesterday: signals.whoopStrainYesterday,
    whoopDataFetchedAt:
      signals.whoopDataFetchedAt === null
        ? null
        : signals.whoopDataFetchedAt
          ? new Date(signals.whoopDataFetchedAt)
          : undefined,
    whoopRaw: signals.whoopRaw === null ? Prisma.JsonNull : signals.whoopRaw
  };
}
