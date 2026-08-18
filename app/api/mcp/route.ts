import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { requireApiKey } from "@/lib/auth";
import { ServiceError, WriteConflictError } from "@/lib/services/errors";
import {
  createActivitySession,
  deleteActivitySession,
  getActivitySession,
  listRecentActivitySessions,
  updateActivitySession
} from "@/lib/services/activity";
import {
  getRecoveryContext,
  getTrainingContext
} from "@/lib/services/planning";
import { getTrainingPlan, saveTrainingPlan } from "@/lib/services/training-plan";
import {
  createCompletedSet,
  createWorkoutSession,
  getDatabaseTime,
  getExerciseHistory,
  getWorkoutSession,
  getWorkoutSignals,
  patchSessionExerciseSets,
  updateExerciseSet,
  updateWorkoutSession,
  updateWorkoutSignals
} from "@/lib/services/workout";
import { DEFAULT_USER_TIMEZONE } from "@/lib/time";
import {
  activityTypeSchema,
  createActivitySessionSchema,
  createSessionSchema,
  createSetSchema,
  patchSessionExerciseSetsSchema,
  sessionSignalsSchema,
  updateActivitySessionSchema,
  updateSetSchema,
  updateSessionSchema,
  saveTrainingPlanSchema
} from "@/lib/validation";
import {
  getWhoopStatus,
  syncWhoopWorkouts
} from "@/lib/whoop/sync";
import { syncWhoopRecovery } from "@/lib/whoop/health-context-sync";
import { WhoopSyncError } from "@/lib/whoop/sync-error";
import { createWhoopSyncLogger } from "@/lib/whoop/sync-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientEventId = z.string().trim().min(1).max(200);
const id = z.string().trim().min(1);
const limit = z.number().int().min(1).max(50).optional();
const syncInput = {
  start: z.string().datetime({ offset: true }).optional(),
  end: z.string().datetime({ offset: true }).optional(),
  maxPages: z.number().int().min(1).max(20).optional()
};

function jsonText(value: unknown) {
  return JSON.stringify(value);
}

function ok(value: unknown) {
  return {
    content: [{ type: "text" as const, text: jsonText(value) }]
  };
}

function updatedReceipt(operation: string, entityType: string, entityId: string) {
  return { status: "updated" as const, operation, entityType, entityId };
}

function deletedReceipt(operation: string, entityType: string, entityId: string) {
  return { status: "deleted" as const, operation, entityType, entityId };
}

function errorResult(error: unknown) {
  if (error instanceof WriteConflictError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: jsonText({
            error: error.message,
            code: error.code
          })
        }
      ]
    };
  }

  if (error instanceof ServiceError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: jsonText({
            error: error.message,
            code: error.code
          })
        }
      ]
    };
  }

  if (error instanceof WhoopSyncError) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: jsonText({ error: error.message, code: error.code })
        }
      ]
    };
  }

  console.error(error);
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: jsonText({ error: "Internal server error" })
      }
    ]
  };
}

async function callTool<T>(callback: () => Promise<T>) {
  try {
    return ok(await callback());
  } catch (error) {
    return errorResult(error);
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_current_time",
      {
        title: "Get Current Time",
        description: "Return database time and the user's configured timezone.",
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      () => callTool(async () => ({
        dbNow: await getDatabaseTime(),
        timezone: DEFAULT_USER_TIMEZONE
      }))
    );

    server.registerTool(
      "get_training_context",
      {
        title: "Get Training Context",
        description:
          "Return bounded workout, set, activity, persisted WHOOP recovery, and WHOOP status context for planning. Does not sync WHOOP.",
        inputSchema: {
          sessionLimit: z.number().int().min(1).max(10).optional(),
          activityLimit: z.number().int().min(1).max(20).optional(),
          exerciseNames: z.array(z.string().trim().min(1)).max(5).optional(),
          recoveryDays: z.number().int().min(1).max(14).optional()
        },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      (args) => callTool(() => getTrainingContext(args))
    );

    server.registerTool(
      "get_current_week_plan",
      {
        title: "Get Current Week Plan",
        description:
          "Read the current weekly plan, planned exercise names, slot progress, and workouts logged in the same week.",
        inputSchema: {
          weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
        },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      (args) => callTool(() => getTrainingPlan(args))
    );

    server.registerTool(
      "save_training_plan",
      {
        title: "Save Training Plan",
        description:
          "Create or update one weekly plan. Store exercise names only; choose loads and substitutions from current recovery and logged history on the training day.",
        inputSchema: { ...saveTrainingPlanSchema.shape, clientEventId },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ clientEventId: eventId, ...body }) => callTool(async () => {
        const parsed = saveTrainingPlanSchema.parse(body);
        const result = await saveTrainingPlan(parsed, {
          clientEventId: eventId,
          source: "mcp"
        });
        return { plan: result.value, receipt: result.receipt };
      })
    );

    server.registerTool(
      "get_workout_session",
      {
        title: "Get Workout Session",
        description: "Read one workout session and its logged sets.",
        inputSchema: { sessionId: id },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      ({ sessionId }) => callTool(async () => ({ session: await getWorkoutSession(sessionId) }))
    );

    server.registerTool(
      "get_exercise_history",
      {
        title: "Get Exercise History",
        description: "Read recent logged sets matching an exercise name.",
        inputSchema: { name: z.string().trim().min(1), limit },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      ({ name, limit: requestedLimit }) => callTool(async () => ({
        query: name.trim(),
        sets: (await getExerciseHistory(name, requestedLimit)).map((set) => ({
          id: set.id,
          exerciseName: set.exercise.name,
          session: set.session,
          setNumber: set.setNumber,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          rir: set.rir,
          painFlag: set.painFlag,
          painNotes: set.painNotes,
          notes: set.notes,
          completedAt: set.completedAt
        }))
      }))
    );

    server.registerTool(
      "start_workout_session",
      {
        title: "Start Workout Session",
        description:
          "Create a workout session. Supply a new clientEventId for each logical session and retain the receipt.",
        inputSchema: { ...createSessionSchema.shape, clientEventId },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ clientEventId: eventId, ...body }) => callTool(async () => {
        const result = await createWorkoutSession(body, {
          clientEventId: eventId,
          source: "mcp"
        });
        return { session: result.value, receipt: result.receipt };
      })
    );

    server.registerTool(
      "log_completed_set",
      {
        title: "Log Completed Set",
        description:
          "Persist one completed exercise set with canonical exercise normalization. Supply a unique clientEventId and retain the receipt.",
        inputSchema: { ...createSetSchema.shape, clientEventId },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ clientEventId: eventId, ...body }) => callTool(async () => {
        const result = await createCompletedSet(body, {
          clientEventId: eventId,
          source: "mcp"
        });
        return { set: result.value, receipt: result.receipt };
      })
    );

    server.registerTool(
      "update_workout_session",
      {
        title: "Update Workout Session",
        description: "Update workout metadata, signals, or completion time.",
        inputSchema: { sessionId: id, ...updateSessionSchema.shape },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ sessionId, ...body }) => callTool(async () => {
        const session = await updateWorkoutSession(sessionId, body);
        return {
          session,
          receipt: updatedReceipt("update_workout_session", "WorkoutSession", session.id)
        };
      })
    );

    server.registerTool(
      "update_workout_signals",
      {
        title: "Update Workout Signals",
        description: "Update readiness, pain, soreness, fatigue, and WHOOP signal fields.",
        inputSchema: { sessionId: id, ...sessionSignalsSchema.shape },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ sessionId, ...body }) => callTool(async () => {
        const signals = await updateWorkoutSignals(sessionId, body);
        return {
          signals,
          receipt: updatedReceipt("update_workout_signals", "WorkoutSession", signals.id)
        };
      })
    );

    server.registerTool(
      "update_exercise_set",
      {
        title: "Update Exercise Set",
        description: "Correct an existing set, including exercise name and execution notes.",
        inputSchema: { setId: id, ...updateSetSchema.shape },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ setId, ...body }) => callTool(async () => {
        const set = await updateExerciseSet(setId, body);
        return {
          set,
          receipt: updatedReceipt("update_exercise_set", "ExerciseSet", set.id)
        };
      })
    );

    server.registerTool(
      "patch_session_exercise_sets",
      {
        title: "Patch Session Exercise Sets",
        description: "Correct an exercise name or append qualitative notes to all matching sets in a session.",
        inputSchema: {
          sessionId: id,
          exerciseId: id,
          ...patchSessionExerciseSetsSchema.shape
        },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ sessionId, exerciseId, ...body }) => callTool(async () => {
        const sets = await patchSessionExerciseSets(sessionId, exerciseId, body);
        return {
          sessionId,
          exerciseId: sets[0]?.exerciseId ?? exerciseId,
          sets,
          receipt: updatedReceipt(
            "patch_session_exercise_sets",
            "ExerciseSet",
            sets[0]?.exerciseId ?? exerciseId
          )
        };
      })
    );

    server.registerTool(
      "finish_workout_session",
      {
        title: "Finish Workout Session",
        description: "Set the workout's endedAt timestamp; defaults to the current server time.",
        inputSchema: { sessionId: id, endedAt: z.string().datetime({ offset: true }).optional() },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ sessionId, endedAt }) => callTool(async () => {
        const session = await updateWorkoutSession(sessionId, {
          endedAt: endedAt ?? new Date().toISOString()
        });
        return {
          session,
          receipt: updatedReceipt("finish_workout_session", "WorkoutSession", session.id)
        };
      })
    );

    server.registerTool(
      "get_recent_activity_sessions",
      {
        title: "Get Recent Activity Sessions",
        description: "Read recent standalone activity sessions, optionally filtered by canonical type.",
        inputSchema: { limit, type: activityTypeSchema.optional() },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      ({ limit: requestedLimit, type }) => callTool(async () => ({
        activities: await listRecentActivitySessions({ limit: requestedLimit, type })
      }))
    );

    server.registerTool(
      "get_activity_session",
      {
        title: "Get Activity Session",
        description: "Read one activity session and its related workout summary, if linked.",
        inputSchema: { activityId: id },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      ({ activityId }) => callTool(async () => ({ activity: await getActivitySession(activityId) }))
    );

    server.registerTool(
      "record_activity_session",
      {
        title: "Record Activity Session",
        description:
          "Persist a manually recorded activity. Supply a unique clientEventId and retain the receipt.",
        inputSchema: { ...createActivitySessionSchema.shape, clientEventId },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ clientEventId: eventId, ...body }) => callTool(async () => {
        const result = await createActivitySession(body, {
          clientEventId: eventId,
          source: "mcp",
          mode: "manual"
        });
        return { activity: result.value, receipt: result.receipt };
      })
    );

    server.registerTool(
      "update_activity_session",
      {
        title: "Update Activity Session",
        description: "Correct or enrich an existing activity session.",
        inputSchema: { activityId: id, ...updateActivitySessionSchema.shape },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ activityId, ...body }) => callTool(async () => {
        const activity = await updateActivitySession(activityId, body);
        return {
          activity,
          receipt: updatedReceipt("update_activity_session", "ActivitySession", activity.id)
        };
      })
    );

    server.registerTool(
      "delete_activity_session",
      {
        title: "Delete Activity Session",
        description: "Delete one activity session. Requires confirm=true and should require explicit client approval.",
        inputSchema: { activityId: id, confirm: z.literal(true) },
        annotations: { destructiveHint: true, openWorldHint: false }
      },
      ({ activityId }) => callTool(async () => {
        await deleteActivitySession(activityId);
        return {
          ok: true,
          activityId,
          receipt: deletedReceipt("delete_activity_session", "ActivitySession", activityId)
        };
      })
    );

    server.registerTool(
      "get_recovery_context",
      {
        title: "Get Recovery Context",
        description: "Read persisted WHOOP sleep and recovery rows by Los Angeles calendar date. Does not sync WHOOP.",
        inputSchema: {
          anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          days: z.number().int().min(1).max(14).optional()
        },
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      (args) => callTool(() => getRecoveryContext(args))
    );

    server.registerTool(
      "get_whoop_status",
      {
        title: "Get WHOOP Status",
        description: "Read WHOOP connection, scopes, and persisted sync status without exposing tokens.",
        annotations: { readOnlyHint: true, openWorldHint: false }
      },
      () => callTool(async () => ({ whoop: await getWhoopStatus() }))
    );

    server.registerTool(
      "sync_whoop_workouts",
      {
        title: "Sync WHOOP Workouts",
        description: "Explicitly synchronize WHOOP workouts into idempotent ActivitySession records. Never creates exercise sets.",
        inputSchema: syncInput,
        annotations: { idempotentHint: true, openWorldHint: true }
      },
      (args) => callTool(async () => ({
        result: await syncWhoopWorkouts({
          ...args,
          log: createWhoopSyncLogger({ userId: null })
        })
      }))
    );

    server.registerTool(
      "sync_whoop_recovery",
      {
        title: "Sync WHOOP Recovery",
        description: "Explicitly synchronize WHOOP sleep and recovery context. Call get_recovery_context afterward.",
        inputSchema: syncInput,
        annotations: { idempotentHint: true, openWorldHint: true }
      },
      (args) => callTool(async () => ({
        result: await syncWhoopRecovery({
          ...args,
          log: createWhoopSyncLogger({ userId: null })
        }),
        whoop: await getWhoopStatus()
      }))
    );

    server.registerTool(
      "import_whoop_activity_fallback",
      {
        title: "Import WHOOP Activity Fallback",
        description:
          "Fallback for screenshot or historical WHOOP activity import when OAuth sync is unavailable. Never creates exercise sets.",
        inputSchema: { ...createActivitySessionSchema.shape, clientEventId },
        annotations: { idempotentHint: true, openWorldHint: false }
      },
      ({ clientEventId: eventId, ...rawBody }) => callTool(async () => {
        const body = createActivitySessionSchema.parse({
          ...rawBody,
          source: rawBody.source ?? "whoop_screenshot"
        });
        const result = await createActivitySession(body, {
          clientEventId: eventId,
          source: "mcp",
          mode: "whoop"
        });
        return { activity: result.value, receipt: result.receipt };
      })
    );
  },
  {
    serverInfo: { name: "workout-bot", version: "0.1.0" },
    instructions:
      "Use receipts to confirm writes. Log completed sets before replying. Use history when planning. WHOOP recovery is advisory and WHOOP never invents exercise sets.",
    capabilities: { logging: {} }
  }
);

async function authenticatedHandler(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;
  return handler(request);
}

export { authenticatedHandler as GET, authenticatedHandler as POST, authenticatedHandler as DELETE };
