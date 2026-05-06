import type { Exercise, WorkoutSessionExercise } from "@prisma/client";

/** Append execution context without duplicating identical fragments. */
export function appendSessionExerciseNotes(
  existing: string | null | undefined,
  addition: string
): string {
  const a = (existing ?? "").trim();
  const b = addition.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n\n${b}`;
}

export type SerializedWorkoutSessionExercise = {
  id: string;
  sessionId: string;
  exerciseId: string;
  displayName: string | null;
  notes: string | null;
  exercise: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

export function serializeWorkoutSessionExercise(
  row: WorkoutSessionExercise & { exercise: Exercise }
): SerializedWorkoutSessionExercise {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    displayName: row.displayName,
    notes: row.notes,
    exercise: { id: row.exercise.id, name: row.exercise.name },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function exerciseDisplayLabel(
  canonicalName: string,
  displayName: string | null | undefined
): string {
  const d = displayName?.trim();
  return d && d.length > 0 ? d : canonicalName;
}
