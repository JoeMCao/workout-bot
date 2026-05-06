import { Prisma } from "@prisma/client";
import { z } from "zod";
import { activitySessionTimeSource, DEFAULT_USER_TIMEZONE } from "@/lib/time";

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
  /** Session-level label (does not rename global Exercise). */
  exerciseDisplayName: optionalTrimmedString,
  /** Session-level execution notes; appended to existing row. Set-level `notes` stays on the set. */
  exerciseNotes: optionalTrimmedString,
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

export const updateSessionExerciseSchema = z
  .object({
    displayName: z.string().trim().min(1).nullable().optional(),
    notes: z.string().trim().min(1).optional(),
    /** When true, `notes` replaces session exercise notes entirely. Default: append to existing. */
    replaceNotes: z.boolean().optional(),
    /** Explicitly clear all session exercise notes (ignores `notes`). */
    clearNotes: z.boolean().optional()
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.clearNotes && body.notes !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Do not send `notes` together with `clearNotes`."
      });
    }
    const hasPatch =
      body.displayName !== undefined ||
      body.notes !== undefined ||
      body.clearNotes === true;
    if (!hasPatch) {
      ctx.addIssue({
        code: "custom",
        message:
          "Provide at least one of: displayName, notes, or clearNotes: true."
      });
    }
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

export const activityTypeSchema = z.enum([
  "zone2",
  "hiit",
  "stairmaster",
  "run",
  "walk",
  "hike",
  "surf",
  "swim",
  "bike",
  "mobility",
  "sauna",
  "cold_plunge",
  "strength",
  "other"
]);

export const activityIntensitySchema = z.enum(["low", "moderate", "high"]);

export const activitySourceSchema = z.enum([
  "manual",
  "whoop_screenshot",
  "whoop_api",
  "apple_health",
  "other"
]);

const nullableActivityIntensity =
  activityIntensitySchema.nullable().optional();
const nullableActivitySource = activitySourceSchema.nullable().optional();
const nullableFloat = z.number().nullable().optional();

type PaceInput = {
  paceSecondsPerKm?: number | null;
  paceSecondsPerMile?: number | null;
  paceMinutesPerKm?: number | null;
  paceMinutesPerMile?: number | null;
};

type ElevationGainInput = {
  elevationGainMeters?: number | null;
  elevationGainFeet?: number | null;
};

function definedValues(
  input: object,
  converters: Record<string, (value: number) => number>
) {
  return Object.keys(converters)
    .map((key) => {
      const value = (input as Record<string, unknown>)[key];
      if (value === undefined) return null;
      if (value !== null && typeof value !== "number") return null;
      return {
        key,
        value: value === null ? null : converters[key](value)
      };
    })
    .filter(Boolean) as Array<{ key: string; value: number | null }>;
}

function validateEquivalentInputs(
  values: Array<{ key: string; value: number | null }>,
  ctx: z.RefinementCtx,
  metricName: string
) {
  if (values.length <= 1) return;

  if (values.some(({ value }) => value === null)) {
    ctx.addIssue({
      code: "custom",
      message: `Provide only one ${metricName} field when clearing a value.`
    });
    return;
  }

  const [first] = values as Array<{ key: string; value: number }>;
  const hasConflict = values.some(
    ({ value }) => value !== null && Math.abs(value - first.value) > 0.001
  );

  if (hasConflict) {
    ctx.addIssue({
      code: "custom",
      message: `Conflicting ${metricName} values were provided.`
    });
  }
}

function validateCanonicalMetricInputs(
  body: PaceInput & ElevationGainInput,
  ctx: z.RefinementCtx
) {
  validateEquivalentInputs(
    definedValues(body, {
      paceSecondsPerKm: (value) => value,
      paceSecondsPerMile: (value) => value / 1.609344,
      paceMinutesPerKm: (value) => value * 60,
      paceMinutesPerMile: (value) => (value * 60) / 1.609344
    }),
    ctx,
    "pace"
  );

  validateEquivalentInputs(
    definedValues(body, {
      elevationGainMeters: (value) => value,
      elevationGainFeet: (value) => value * 0.3048
    }),
    ctx,
    "elevation gain"
  );
}

function normalizePaceSecondsPerKm(input: PaceInput) {
  const values = definedValues(input, {
    paceSecondsPerKm: (value) => value,
    paceSecondsPerMile: (value) => value / 1.609344,
    paceMinutesPerKm: (value) => value * 60,
    paceMinutesPerMile: (value) => (value * 60) / 1.609344
  });

  return values[0]?.value;
}

function normalizeElevationGainMeters(input: ElevationGainInput) {
  const values = definedValues(input, {
    elevationGainMeters: (value) => value,
    elevationGainFeet: (value) => value * 0.3048
  });

  return values[0]?.value;
}

const activitySyncStatusSchema = z.enum(["needs_review"]).nullable().optional();

const activitySessionFieldsShape = {
  modality: z.string().trim().min(1).nullable().optional(),
  sourceActivityType: z.string().trim().min(1).nullable().optional(),
  rawPayloadJson: z.any().nullable().optional(),
  syncStatus: activitySyncStatusSchema,
  endedAt: nullableIsoDate,
  durationMinutes: nullableFloat,
  intensity: nullableActivityIntensity,
  avgHeartRate: nullableInt,
  maxHeartRate: nullableInt,
  minHeartRate: nullableInt,
  calories: nullableInt,
  distanceMeters: nullableFloat,
  elevationGainMeters: nullableFloat,
  elevationGainFeet: nullableFloat,
  elevationLossMeters: nullableFloat,
  paceSecondsPerKm: nullableFloat,
  paceSecondsPerMile: nullableFloat,
  paceMinutesPerKm: nullableFloat,
  paceMinutesPerMile: nullableFloat,
  strain: nullableFloat,
  zone0Minutes: nullableFloat,
  zone1Minutes: nullableFloat,
  zone2Minutes: nullableFloat,
  zone3Minutes: nullableFloat,
  zone4Minutes: nullableFloat,
  zone5Minutes: nullableFloat,
  source: nullableActivitySource,
  notes: z.string().trim().min(1).nullable().optional(),
  relatedWorkoutSessionId: z.string().trim().min(1).nullable().optional()
};

export const createActivitySessionSchema = z
  .object({
    ...activitySessionFieldsShape,
    type: activityTypeSchema,
    /** ISO 8601 with offset; interpreted as UTC instant. Omit or null to use server time. */
    startedAt: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional()
  })
  .superRefine((body, ctx) => validateCanonicalMetricInputs(body, ctx));

export const updateActivitySessionSchema = z
  .object({
    ...activitySessionFieldsShape,
    type: activityTypeSchema.optional(),
    startedAt: optionalIsoDate.optional()
  })
  .partial()
  .superRefine((body, ctx) => validateCanonicalMetricInputs(body, ctx));

export type ParsedActivitySessionCreateBody = z.infer<
  typeof createActivitySessionSchema
>;

export function activitySessionCreateData(
  body: ParsedActivitySessionCreateBody,
  meta: { startedAt: Date; timeSource: string }
) {
  const data: Prisma.ActivitySessionCreateInput = {
    type: body.type,
    modality: body.modality,
    sourceActivityType: body.sourceActivityType,
    rawPayloadJson:
      body.rawPayloadJson === null
        ? Prisma.JsonNull
        : body.rawPayloadJson === undefined
          ? undefined
          : (body.rawPayloadJson as Prisma.InputJsonValue),
    startedAt: meta.startedAt,
    timeSource: meta.timeSource,
    timezone: DEFAULT_USER_TIMEZONE,
    endedAt:
      body.endedAt === null
        ? null
        : body.endedAt
          ? new Date(body.endedAt)
          : undefined,
    durationMinutes: body.durationMinutes,
    intensity: body.intensity,
    avgHeartRate: body.avgHeartRate,
    maxHeartRate: body.maxHeartRate,
    minHeartRate: body.minHeartRate,
    calories: body.calories,
    distanceMeters: body.distanceMeters,
    elevationGainMeters: normalizeElevationGainMeters(body),
    elevationLossMeters: body.elevationLossMeters,
    paceSecondsPerKm: normalizePaceSecondsPerKm(body),
    strain: body.strain,
    zone0Minutes: body.zone0Minutes,
    zone1Minutes: body.zone1Minutes,
    zone2Minutes: body.zone2Minutes,
    zone3Minutes: body.zone3Minutes,
    zone4Minutes: body.zone4Minutes,
    zone5Minutes: body.zone5Minutes,
    source: body.source,
    notes: body.notes,
    syncStatus: body.syncStatus
  };

  if (body.relatedWorkoutSessionId) {
    data.relatedWorkoutSession = {
      connect: { id: body.relatedWorkoutSessionId }
    };
  }

  return data;
}

export function activitySessionUpdateData(
  body: z.infer<typeof updateActivitySessionSchema>
): Prisma.ActivitySessionUpdateInput {
  const data: Prisma.ActivitySessionUpdateInput = {};

  if (body.type !== undefined) {
    data.type = body.type;
  }

  if (body.modality !== undefined) {
    data.modality = body.modality;
  }

  if (body.sourceActivityType !== undefined) {
    data.sourceActivityType = body.sourceActivityType;
  }

  if (body.rawPayloadJson !== undefined) {
    data.rawPayloadJson =
      body.rawPayloadJson === null
        ? Prisma.JsonNull
        : (body.rawPayloadJson as Prisma.InputJsonValue);
  }

  if (body.startedAt !== undefined) {
    data.startedAt = new Date(body.startedAt);
    data.timeSource = activitySessionTimeSource.userProvided;
  }

  if (body.endedAt !== undefined) {
    data.endedAt =
      body.endedAt === null ? null : new Date(body.endedAt);
  }

  if (body.durationMinutes !== undefined) {
    data.durationMinutes = body.durationMinutes;
  }

  if (body.intensity !== undefined) {
    data.intensity = body.intensity;
  }

  if (body.avgHeartRate !== undefined) {
    data.avgHeartRate = body.avgHeartRate;
  }

  if (body.maxHeartRate !== undefined) {
    data.maxHeartRate = body.maxHeartRate;
  }

  if (body.minHeartRate !== undefined) {
    data.minHeartRate = body.minHeartRate;
  }

  if (body.calories !== undefined) {
    data.calories = body.calories;
  }

  if (body.distanceMeters !== undefined) {
    data.distanceMeters = body.distanceMeters;
  }

  const elevationGainMeters = normalizeElevationGainMeters(body);
  if (elevationGainMeters !== undefined) {
    data.elevationGainMeters = elevationGainMeters;
  }

  if (body.elevationLossMeters !== undefined) {
    data.elevationLossMeters = body.elevationLossMeters;
  }

  const paceSecondsPerKm = normalizePaceSecondsPerKm(body);
  if (paceSecondsPerKm !== undefined) {
    data.paceSecondsPerKm = paceSecondsPerKm;
  }

  if (body.strain !== undefined) {
    data.strain = body.strain;
  }

  for (const key of [
    "zone0Minutes",
    "zone1Minutes",
    "zone2Minutes",
    "zone3Minutes",
    "zone4Minutes",
    "zone5Minutes"
  ] as const) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }

  if (body.source !== undefined) {
    data.source = body.source;
  }

  if (body.notes !== undefined) {
    data.notes = body.notes;
  }

  if (body.syncStatus !== undefined) {
    data.syncStatus = body.syncStatus;
  }

  if (body.relatedWorkoutSessionId !== undefined) {
    if (body.relatedWorkoutSessionId === null) {
      data.relatedWorkoutSession = { disconnect: true };
    } else {
      data.relatedWorkoutSession = {
        connect: { id: body.relatedWorkoutSessionId }
      };
    }
  }

  return data;
}
