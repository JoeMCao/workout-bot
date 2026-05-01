import { z } from "zod";

const optionalIsoDate = z.string().datetime({ offset: true }).optional();
const optionalTrimmedString = z.string().trim().min(1).optional();

export const createSessionSchema = z.object({
  startedAt: optionalIsoDate,
  sessionType: optionalTrimmedString,
  goal: optionalTrimmedString,
  readinessScore: z.number().int().optional(),
  energy: z.number().int().optional(),
  soreness: optionalTrimmedString,
  sleepQuality: optionalTrimmedString,
  notes: optionalTrimmedString
});

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
