import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlannedExerciseProgress,
  selectDashboardExerciseNames,
  selectDashboardSlot,
  summarizeWeek,
  type DashboardPlanSlot,
  type ExerciseHistorySet
} from "./plan-progress.ts";

function slot(
  id: string,
  plannedDate: string,
  status: DashboardPlanSlot["status"] = "planned"
): DashboardPlanSlot {
  return {
    id,
    plannedDate,
    status,
    focus: id,
    exerciseNames: ["Pull-Up"],
    actualExerciseNames: [],
    notes: null,
    workoutSessionId: null,
    workoutSessionEnded: status === "completed"
  };
}

test("shows logged exercises once a session has actual sets", () => {
  const selected = selectDashboardExerciseNames({
    exerciseNames: ["One-Arm Dumbbell Row"],
    actualExerciseNames: ["Chest-Supported Dumbbell Row"],
    workoutSessionEnded: true
  });

  assert.deepEqual(selected, {
    exerciseNames: ["Chest-Supported Dumbbell Row"],
    source: "actual"
  });
});

test("shows planned exercises before any actual sets are logged", () => {
  const selected = selectDashboardExerciseNames({
    exerciseNames: ["One-Arm Dumbbell Row"],
    actualExerciseNames: [],
    workoutSessionEnded: false
  });

  assert.deepEqual(selected, {
    exerciseNames: ["One-Arm Dumbbell Row"],
    source: "planned"
  });
});

test("does not present planned exercises as completed when no sets were logged", () => {
  const selected = selectDashboardExerciseNames({
    exerciseNames: ["One-Arm Dumbbell Row"],
    actualExerciseNames: [],
    workoutSessionEnded: true
  });

  assert.deepEqual(selected, { exerciseNames: [], source: "actual" });
});

function history(
  id: string,
  sessionId: string,
  sessionDateKey: string,
  weight: number | null,
  reps: number | null,
  setNumber: number
): ExerciseHistorySet {
  return { id, sessionId, sessionDateKey, weight, reps, setNumber };
}

test("selects today's slot, including a completed workout", () => {
  const selected = selectDashboardSlot({
    planIsActive: true,
    today: "2026-08-19",
    slots: [
      slot("monday", "2026-08-17", "completed"),
      slot("today", "2026-08-19", "completed"),
      slot("friday", "2026-08-21")
    ]
  });
  assert.equal(selected?.slot.id, "today");
  assert.equal(selected?.source, "today");
});

test("ignores skipped and replaced days and selects the next planned slot", () => {
  const selected = selectDashboardSlot({
    planIsActive: true,
    today: "2026-08-19",
    slots: [
      slot("skipped", "2026-08-19", "skipped"),
      slot("replaced", "2026-08-20", "replaced"),
      slot("friday", "2026-08-21")
    ]
  });
  assert.equal(selected?.slot.id, "friday");
  assert.equal(selected?.source, "next");
});

test("prefers an unfinished in-progress slot before a future slot", () => {
  const selected = selectDashboardSlot({
    planIsActive: true,
    today: "2026-08-19",
    slots: [
      slot("unfinished", "2026-08-18", "in_progress"),
      slot("friday", "2026-08-21")
    ]
  });
  assert.equal(selected?.slot.id, "unfinished");
});

test("falls back to a missed planned slot and returns null for inactive plans", () => {
  const slots = [slot("monday", "2026-08-17")];
  assert.equal(
    selectDashboardSlot({ planIsActive: true, today: "2026-08-19", slots })?.slot.id,
    "monday"
  );
  assert.equal(
    selectDashboardSlot({ planIsActive: false, today: "2026-08-19", slots }),
    null
  );
});

test("weekly completion excludes replaced slots and keeps skipped slots in the target", () => {
  const summary = summarizeWeek([
    slot("one", "2026-08-17", "completed"),
    slot("two", "2026-08-19", "in_progress"),
    slot("three", "2026-08-21", "skipped"),
    slot("old", "2026-08-20", "replaced")
  ]);
  assert.deepEqual(
    {
      total: summary.total,
      completed: summary.completed,
      inProgress: summary.inProgress,
      remaining: summary.remaining,
      skipped: summary.skipped
    },
    { total: 3, completed: 1, inProgress: 1, remaining: 1, skipped: 1 }
  );
});

test("builds weighted estimated-strength progress and detects a personal best", () => {
  const progress = buildPlannedExerciseProgress({
    exerciseName: "Dumbbell Row",
    startDateKey: "2026-07-01",
    endDateKey: "2026-08-19",
    currentSessionId: "current",
    rows: [
      history("a1", "old", "2026-07-10", 60, 10, 1),
      history("a2", "old", "2026-07-10", 60, 9, 2),
      history("b1", "current", "2026-08-19", 65, 10, 1),
      history("b2", "current", "2026-08-19", 65, 9, 2),
      history("c1", "future", "2026-08-20", 100, 10, 1)
    ]
  });
  assert.equal(progress.metricKind, "estimated_1rm");
  assert.equal(progress.state, "ready");
  assert.equal(progress.comparison?.from.resultLabel, "60 × 10");
  assert.equal(progress.comparison?.to.resultLabel, "65 × 10");
  assert.equal(progress.comparison?.percentChange, 8.4);
  assert.equal(progress.volumeComparison?.percentChange, 8.3);
  assert.equal(progress.actual?.sessionId, "current");
  assert.equal(progress.latestIsPersonalBest, true);
});

test("builds bodyweight progress from total session reps", () => {
  const progress = buildPlannedExerciseProgress({
    exerciseName: "Pull-Up",
    startDateKey: "2026-07-01",
    endDateKey: "2026-08-19",
    rows: [
      history("a1", "old", "2026-07-10", null, 8, 1),
      history("a2", "old", "2026-07-10", null, 8, 2),
      history("a3", "old", "2026-07-10", null, 7, 3),
      history("b1", "new", "2026-08-19", null, 10, 1),
      history("b2", "new", "2026-08-19", null, 10, 2),
      history("b3", "new", "2026-08-19", null, 10, 3)
    ]
  });
  assert.equal(progress.metricKind, "total_reps");
  assert.equal(progress.comparison?.from.value, 23);
  assert.equal(progress.comparison?.to.value, 30);
  assert.match(progress.latest?.setsLabel ?? "", /best set 10/);
});

test("does not fabricate a trend for mixed, sparse, or out-of-window history", () => {
  const mixed = buildPlannedExerciseProgress({
    exerciseName: "Pull-Up",
    startDateKey: "2026-07-01",
    endDateKey: "2026-08-19",
    rows: [
      history("a", "old", "2026-07-10", null, 10, 1),
      history("b", "new", "2026-08-19", 25, 5, 1)
    ]
  });
  assert.equal(mixed.metricKind, "history_only");
  assert.equal(mixed.state, "mixed");
  assert.equal(mixed.comparison, null);

  const limited = buildPlannedExerciseProgress({
    exerciseName: "Row",
    startDateKey: "2026-08-01",
    endDateKey: "2026-08-19",
    rows: [history("a", "old", "2026-07-10", 60, 10, 1)]
  });
  assert.equal(limited.state, "limited");
  assert.equal(limited.comparison, null);
  assert.equal(limited.lastTrainedDate, "2026-07-10");

  const firstSession = buildPlannedExerciseProgress({
    exerciseName: "Squat",
    startDateKey: "2026-07-01",
    endDateKey: "2026-08-19",
    rows: [history("one", "only", "2026-08-19", 90, 10, 1)]
  });
  assert.equal(firstSession.latestIsPersonalBest, false);

  const incompatible = buildPlannedExerciseProgress({
    exerciseName: "Carry",
    startDateKey: "2026-07-01",
    endDateKey: "2026-08-19",
    rows: [history("one", "only", "2026-08-19", 50, null, 1)]
  });
  assert.equal(incompatible.metricKind, "history_only");
  assert.equal(incompatible.state, "limited");
});

test("uses logged volume for high-rep weighted sessions", () => {
  const progress = buildPlannedExerciseProgress({
    exerciseName: "Dumbbell Hip Thrust",
    startDateKey: "2026-07-22",
    endDateKey: "2026-08-19",
    currentSessionId: "current",
    rows: [
      history("old-1", "old", "2026-08-05", 50, 10, 1),
      history("old-2", "old", "2026-08-05", 70, 12, 2),
      history("old-3", "old", "2026-08-05", 70, 12, 3),
      history("partial-1", "partial", "2026-08-14", 70, 15, 1),
      history("partial-2", "partial", "2026-08-14", 80, null, 2),
      history("a", "current", "2026-08-19", 70, 18, 1),
      history("b", "current", "2026-08-19", 70, 18, 2),
      history("c", "current", "2026-08-19", 70, 18, 3)
    ]
  });

  assert.equal(progress.metricKind, "session_volume");
  assert.equal(progress.metricLabel, "logged volume");
  assert.equal(progress.comparison?.from.value, 2180);
  assert.equal(progress.comparison?.to.value, 3780);
  assert.equal(progress.comparison?.percentChange, 73.4);
  assert.equal(progress.comparison?.from.resultLabel, "70 × 12");
  assert.equal(progress.comparison?.to.resultLabel, "70 × 18");
  assert.equal(progress.actual?.setsLabel, "70 × 18 · 70 × 18 · 70 × 18");
});
