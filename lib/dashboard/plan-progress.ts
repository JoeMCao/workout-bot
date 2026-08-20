export const overviewLookbackOptions = [4, 8, 12] as const;

export type OverviewLookbackWeeks = (typeof overviewLookbackOptions)[number];

export type DashboardSlotStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "skipped"
  | "replaced";

export type DashboardPlanSlot = {
  id: string;
  plannedDate: string;
  focus: string;
  status: DashboardSlotStatus;
  exerciseNames: string[];
  actualExerciseNames: string[];
  notes: string | null;
  workoutSessionId: string | null;
  workoutSessionEnded: boolean;
};

export type DashboardExerciseSelection = {
  exerciseNames: string[];
  source: "planned" | "actual";
};

export type DashboardSlotSelection = {
  slot: DashboardPlanSlot;
  source: "today" | "next";
};

export type WeekStatus = {
  total: number;
  completed: number;
  inProgress: number;
  remaining: number;
  skipped: number;
  slots: DashboardPlanSlot[];
};

export type ExerciseHistorySet = {
  id: string;
  sessionId: string;
  sessionDateKey: string;
  setNumber: number | null;
  weight: number | null;
  reps: number | null;
};

export type ExerciseProgressPoint = {
  sessionId: string;
  dateKey: string;
  value: number;
  resultLabel: string;
  setsLabel: string;
};

export type PlannedExerciseProgress = {
  exerciseName: string;
  metricKind: "estimated_1rm" | "session_volume" | "total_reps" | "history_only";
  metricLabel: string | null;
  state: "empty" | "limited" | "ready" | "mixed";
  points: ExerciseProgressPoint[];
  comparison: {
    from: ExerciseProgressPoint;
    to: ExerciseProgressPoint;
    percentChange: number | null;
  } | null;
  volumeComparison: {
    from: ExerciseProgressPoint;
    to: ExerciseProgressPoint;
    percentChange: number | null;
  } | null;
  latest: ExerciseProgressPoint | null;
  actual: ExerciseProgressPoint | null;
  latestIsPersonalBest: boolean;
  lastTrainedDate: string | null;
};

const activeTodayStatuses = new Set<DashboardSlotStatus>([
  "planned",
  "in_progress",
  "completed"
]);

function byPlannedDate(a: DashboardPlanSlot, b: DashboardPlanSlot) {
  return a.plannedDate.localeCompare(b.plannedDate);
}

export function isOverviewLookbackWeeks(value: number): value is OverviewLookbackWeeks {
  return overviewLookbackOptions.includes(value as OverviewLookbackWeeks);
}

export function selectDashboardExerciseNames(
  slot: Pick<
    DashboardPlanSlot,
    "exerciseNames" | "actualExerciseNames" | "workoutSessionEnded"
  >
): DashboardExerciseSelection {
  if (slot.workoutSessionEnded || slot.actualExerciseNames.length > 0) {
    return { exerciseNames: slot.actualExerciseNames, source: "actual" };
  }
  return { exerciseNames: slot.exerciseNames, source: "planned" };
}

export function selectDashboardSlot({
  planIsActive,
  slots,
  today
}: {
  planIsActive: boolean;
  slots: DashboardPlanSlot[];
  today: string;
}): DashboardSlotSelection | null {
  if (!planIsActive) return null;

  const ordered = [...slots].sort(byPlannedDate);
  const todaySlot = ordered.find(
    (slot) => slot.plannedDate === today && activeTodayStatuses.has(slot.status)
  );
  if (todaySlot) return { slot: todaySlot, source: "today" };

  const inProgress = ordered.find((slot) => slot.status === "in_progress");
  if (inProgress) return { slot: inProgress, source: "next" };

  const nextPlanned = ordered.find(
    (slot) => slot.status === "planned" && slot.plannedDate >= today
  );
  if (nextPlanned) return { slot: nextPlanned, source: "next" };

  const missedPlanned = ordered.find((slot) => slot.status === "planned");
  return missedPlanned ? { slot: missedPlanned, source: "next" } : null;
}

export function summarizeWeek(slots: DashboardPlanSlot[]): WeekStatus {
  const counted = [...slots]
    .filter((slot) => slot.status !== "replaced")
    .sort(byPlannedDate);
  const completed = counted.filter((slot) => slot.status === "completed").length;
  const inProgress = counted.filter((slot) => slot.status === "in_progress").length;
  const skipped = counted.filter((slot) => slot.status === "skipped").length;

  return {
    total: counted.length,
    completed,
    inProgress,
    skipped,
    remaining: counted.length - completed - skipped,
    slots: counted
  };
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function estimatedOneRepMax(weight: number, reps: number) {
  return roundOne(weight * (1 + reps / 30));
}

function formatSet(set: ExerciseHistorySet) {
  if (set.weight != null && set.weight > 0 && set.reps != null) {
    return `${formatNumber(set.weight)} × ${set.reps}`;
  }
  if (set.reps != null) return `${set.reps} reps`;
  if (set.weight != null && set.weight > 0) return `${formatNumber(set.weight)} load`;
  return "Set logged";
}

function setsLabel(sets: ExerciseHistorySet[]) {
  const ordered = [...sets].sort((a, b) => {
    if (a.setNumber == null && b.setNumber == null) return a.id.localeCompare(b.id);
    if (a.setNumber == null) return 1;
    if (b.setNumber == null) return -1;
    return a.setNumber - b.setNumber;
  });
  const labels = ordered.slice(0, 5).map(formatSet);
  if (ordered.length > 5) labels.push(`+${ordered.length - 5} more`);
  return labels.join(" · ");
}

type SessionGroup = {
  sessionId: string;
  dateKey: string;
  sets: ExerciseHistorySet[];
};

function groupBySession(rows: ExerciseHistorySet[]) {
  const groups = new Map<string, SessionGroup>();
  for (const row of rows) {
    const existing = groups.get(row.sessionId);
    if (existing) {
      existing.sets.push(row);
    } else {
      groups.set(row.sessionId, {
        sessionId: row.sessionId,
        dateKey: row.sessionDateKey,
        sets: [row]
      });
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.dateKey === b.dateKey
      ? a.sessionId.localeCompare(b.sessionId)
      : a.dateKey.localeCompare(b.dateKey)
  );
}

function sessionMode(group: SessionGroup) {
  const weighted = group.sets.filter(
    (set) =>
      set.weight != null &&
      set.weight > 0 &&
      set.reps != null &&
      set.reps >= 1 &&
      set.reps <= 15
  );
  const bodyweight = group.sets.filter(
    (set) => (set.weight == null || set.weight <= 0) && set.reps != null && set.reps > 0
  );

  if (weighted.length > 0 && bodyweight.length === 0) return "weighted" as const;
  if (bodyweight.length > 0 && weighted.length === 0) return "bodyweight" as const;
  if (weighted.length > 0 || bodyweight.length > 0) return "mixed" as const;
  return "history" as const;
}

function pointForGroup(
  group: SessionGroup,
  metricKind: "estimated_1rm" | "total_reps"
): ExerciseProgressPoint | null {
  if (metricKind === "estimated_1rm") {
    const eligible = group.sets.filter(
      (set) =>
        set.weight != null &&
        set.weight > 0 &&
        set.reps != null &&
        set.reps >= 1 &&
        set.reps <= 15
    );
    let best: ExerciseHistorySet | null = null;
    let bestEstimate = -Infinity;
    for (const set of eligible) {
      const estimate = estimatedOneRepMax(set.weight!, set.reps!);
      if (estimate > bestEstimate) {
        best = set;
        bestEstimate = estimate;
      }
    }
    if (!best) return null;
    return {
      sessionId: group.sessionId,
      dateKey: group.dateKey,
      value: bestEstimate,
      resultLabel: `${formatNumber(best.weight!)} × ${best.reps}`,
      setsLabel: setsLabel(group.sets)
    };
  }

  const reps = group.sets
    .filter((set) => (set.weight == null || set.weight <= 0) && set.reps != null)
    .map((set) => set.reps!);
  if (reps.length === 0) return null;
  const total = reps.reduce((sum, value) => sum + value, 0);
  const best = Math.max(...reps);
  return {
    sessionId: group.sessionId,
    dateKey: group.dateKey,
    value: total,
    resultLabel: `${total} total reps`,
    setsLabel: `${setsLabel(group.sets)} · best set ${best}`
  };
}

function historyPointForGroup(group: SessionGroup): ExerciseProgressPoint {
  const label = setsLabel(group.sets);
  return {
    sessionId: group.sessionId,
    dateKey: group.dateKey,
    value: 0,
    resultLabel: label,
    setsLabel: label
  };
}

function volumePointForGroup(group: SessionGroup): ExerciseProgressPoint | null {
  if (
    group.sets.length === 0 ||
    group.sets.some(
      (set) =>
        set.weight == null ||
        set.weight <= 0 ||
        set.reps == null ||
        set.reps <= 0
    )
  ) {
    return null;
  }

  const best = group.sets.reduce((current, set) => {
    if (set.weight! > current.weight!) return set;
    if (set.weight === current.weight && set.reps! > current.reps!) return set;
    return current;
  });
  const volume = roundOne(
    group.sets.reduce((total, set) => total + set.weight! * set.reps!, 0)
  );

  return {
    sessionId: group.sessionId,
    dateKey: group.dateKey,
    value: volume,
    resultLabel: `${formatNumber(best.weight!)} × ${best.reps}`,
    setsLabel: setsLabel(group.sets)
  };
}

function compareLatestPoints(points: ExerciseProgressPoint[]) {
  const to = points.at(-1) ?? null;
  const from = points.at(-2) ?? null;
  if (!from || !to || from.sessionId === to.sessionId) return null;
  return {
    from,
    to,
    percentChange:
      from.value === 0 ? null : roundOne(((to.value - from.value) / from.value) * 100)
  };
}

export function buildPlannedExerciseProgress({
  exerciseName,
  rows,
  startDateKey,
  endDateKey,
  currentSessionId
}: {
  exerciseName: string;
  rows: ExerciseHistorySet[];
  startDateKey: string;
  endDateKey: string;
  currentSessionId?: string | null;
}): PlannedExerciseProgress {
  const allGroups = groupBySession(rows);
  const historicalGroups = allGroups.filter((group) => group.dateKey <= endDateKey);
  const recentGroups = historicalGroups.filter((group) => group.dateKey >= startDateKey);
  const modes = recentGroups.map(sessionMode);
  const recentModes = new Set(
    modes.filter((mode) => mode !== "history")
  );
  const lastGroup = recentGroups.at(-1) ?? historicalGroups.at(-1) ?? null;
  const allVolumePoints = historicalGroups
    .map(volumePointForGroup)
    .filter((point): point is ExerciseProgressPoint => point != null);
  const volumePoints = allVolumePoints.filter((point) => point.dateKey >= startDateKey);
  const volumeComparison = compareLatestPoints(volumePoints);

  if (historicalGroups.length === 0) {
    return {
      exerciseName,
      metricKind: "history_only",
      metricLabel: null,
      state: "empty",
      points: [],
      comparison: null,
      volumeComparison: null,
      latest: null,
      actual: null,
      latestIsPersonalBest: false,
      lastTrainedDate: null
    };
  }

  if (
    modes.includes("history") ||
    recentModes.size !== 1 ||
    recentModes.has("mixed")
  ) {
    if (volumeComparison) {
      const latest = volumePoints.at(-1)!;
      const latestIndex = allVolumePoints.findIndex(
        (point) => point.sessionId === latest.sessionId
      );
      const previousPoints =
        latestIndex > 0 ? allVolumePoints.slice(0, latestIndex) : [];
      const previousBest = Math.max(
        -Infinity,
        ...previousPoints.map((point) => point.value)
      );
      return {
        exerciseName,
        metricKind: "session_volume",
        metricLabel: "logged volume",
        state: "ready",
        points: volumePoints,
        comparison: volumeComparison,
        volumeComparison,
        latest,
        actual: currentSessionId
          ? allVolumePoints.find((point) => point.sessionId === currentSessionId) ?? null
          : null,
        latestIsPersonalBest:
          previousPoints.length > 0 && latest.value > previousBest,
        lastTrainedDate: latest.dateKey
      };
    }

    const latestRecentGroup = recentGroups.at(-1) ?? null;
    const actualGroup = currentSessionId
      ? historicalGroups.find((group) => group.sessionId === currentSessionId) ?? null
      : null;
    return {
      exerciseName,
      metricKind: "history_only",
      metricLabel: null,
      state:
        recentModes.size > 1 || recentModes.has("mixed") ? "mixed" : "limited",
      points: [],
      comparison: null,
      volumeComparison: null,
      latest: latestRecentGroup ? historyPointForGroup(latestRecentGroup) : null,
      actual: actualGroup ? historyPointForGroup(actualGroup) : null,
      latestIsPersonalBest: false,
      lastTrainedDate: lastGroup?.dateKey ?? null
    };
  }

  const mode = [...recentModes][0];
  if (mode !== "weighted" && mode !== "bodyweight") {
    return {
      exerciseName,
      metricKind: "history_only",
      metricLabel: null,
      state: "limited",
      points: [],
      comparison: null,
      volumeComparison: null,
      latest: null,
      actual: null,
      latestIsPersonalBest: false,
      lastTrainedDate: lastGroup?.dateKey ?? null
    };
  }

  const metricKind = mode === "weighted" ? "estimated_1rm" : "total_reps";
  const allPoints = historicalGroups
    .filter((group) => sessionMode(group) === mode)
    .map((group) => pointForGroup(group, metricKind))
    .filter((point): point is ExerciseProgressPoint => point != null);
  const points = allPoints.filter((point) => point.dateKey >= startDateKey);
  const latest = points.at(-1) ?? null;
  const latestIndex = latest
    ? allPoints.findIndex((point) => point.sessionId === latest.sessionId)
    : -1;
  const previousPoints = latestIndex > 0 ? allPoints.slice(0, latestIndex) : [];
  const previousBest = Math.max(-Infinity, ...previousPoints.map((point) => point.value));
  const from = points[0] ?? null;
  const to = points.at(-1) ?? null;
  const comparison =
    from && to && from.sessionId !== to.sessionId
      ? {
          from,
          to,
          percentChange:
            from.value === 0 ? null : roundOne(((to.value - from.value) / from.value) * 100)
        }
      : null;

  return {
    exerciseName,
    metricKind,
    metricLabel: metricKind === "estimated_1rm" ? "estimated strength" : "session reps",
    state: points.length >= 2 ? "ready" : "limited",
    points,
    comparison,
    volumeComparison,
    latest,
    actual: currentSessionId
      ? allPoints.find((point) => point.sessionId === currentSessionId) ?? null
      : null,
    latestIsPersonalBest:
      latest != null && previousPoints.length > 0 && latest.value > previousBest,
    lastTrainedDate: latest?.dateKey ?? lastGroup?.dateKey ?? null
  };
}
