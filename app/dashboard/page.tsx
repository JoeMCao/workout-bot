import Link from "next/link";
import { ProgressSparkline } from "@/components/dashboard/ProgressSparkline";
import { SiteChrome } from "@/components/dashboard/SiteChrome";
import { getPlanDrivenOverview } from "@/lib/dashboard/plan-driven-overview";
import {
  isOverviewLookbackWeeks,
  overviewLookbackOptions
} from "@/lib/dashboard/plan-progress";

export const dynamic = "force-dynamic";

function planDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "America/Los_Angeles",
    ...options
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatPlanDate(value: string) {
  return planDate(value, { weekday: "long", month: "short", day: "numeric" });
}

function formatShortPlanDate(value: string) {
  return planDate(value, { month: "short", day: "numeric" });
}

function formatWeekday(value: string) {
  return planDate(value, { weekday: "short" });
}

function weekDescription(completed: number, total: number) {
  if (total === 0) return "No active weekly plan.";
  return `${completed} of ${total} planned sessions completed this week.`;
}

function percentLabel(value: number | null) {
  if (value == null) return null;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}%`;
}

function weeklyTargetRows(
  targets: {
    strengthSessions?: number;
    cardioSessions?: number;
    zone2Minutes?: number;
    heatSessions?: number;
    heatMinutes?: number;
  } | null,
  actual: {
    strengthSessions: number;
    cardioSessions: number;
    zone2Minutes: number;
    heatSessions: number;
    heatMinutes: number;
  }
) {
  if (!targets) return [];
  return [
    targets.strengthSessions == null
      ? null
      : {
          label: "Gym",
          actual: actual.strengthSessions,
          target: targets.strengthSessions,
          unit: "sessions"
        },
    targets.cardioSessions == null
      ? null
      : {
          label: "Cardio",
          actual: actual.cardioSessions,
          target: targets.cardioSessions,
          unit: "sessions"
        },
    targets.zone2Minutes == null
      ? null
      : {
          label: "Zone 2",
          actual: actual.zone2Minutes,
          target: targets.zone2Minutes,
          unit: "minutes"
        },
    targets.heatSessions == null
      ? null
      : {
          label: "Heat",
          actual: actual.heatSessions,
          target: targets.heatSessions,
          unit: "sessions"
        },
    targets.heatMinutes == null
      ? null
      : {
          label: "Heat",
          actual: actual.heatMinutes,
          target: targets.heatMinutes,
          unit: "minutes"
        }
  ].filter((row): row is NonNullable<typeof row> => row != null);
}

function formatVolume(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function activityLabel({
  type,
  modality,
  sourceActivityType
}: {
  type: string;
  modality: string | null;
  sourceActivityType: string | null;
}) {
  const value = modality ?? sourceActivityType ?? type;
  if (value.toLowerCase() === "stairmaster") return "StairMaster";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const requestedRange = Number(params?.range ?? 8);
  const lookbackWeeks = isOverviewLookbackWeeks(requestedRange) ? requestedRange : 8;
  const overview = await getPlanDrivenOverview({ lookbackWeeks });
  const targetRows = weeklyTargetRows(
    overview.weeklyTargets.targets,
    overview.weeklyTargets.actual
  );
  const slot = overview.displayedSlot;
  const displayedExerciseNames = slot
    ? overview.exerciseSource === "actual"
      ? slot.actualExerciseNames
      : slot.exerciseNames
    : [];
  const exerciseListLabel =
    overview.exerciseSource === "actual"
      ? slot?.status === "completed"
        ? "Performed"
        : "Performed so far"
      : "Planned";

  return (
    <SiteChrome
      compact
      eyebrow="Workout Bot"
      title="Training"
      description={weekDescription(overview.week.completed, overview.week.total)}
    >
      <section className="weekly-scoreboard" aria-label="This week at a glance">
        <div className="weekly-scoreboard-heading">
          <span>This week</span>
        </div>
        <div className="weekly-score">
          <strong>
            {overview.week.completed}/{overview.week.total}
          </strong>
          <span>plan completed</span>
        </div>
        <div className="weekly-score">
          <strong>{overview.weeklyTargets.actual.strengthSessions}</strong>
          <span>training sessions</span>
        </div>
        <div className="weekly-score">
          <strong>{overview.weeklyTargets.actual.cardioSessions}</strong>
          <span>cardio sessions</span>
        </div>
        <div className="weekly-score">
          <strong>{overview.weeklyTargets.actual.zone2Minutes}</strong>
          <span>Zone 2 minutes</span>
        </div>
        <div className="weekly-score">
          <strong>{overview.weeklyTargets.actual.heatSessions}</strong>
          <span>sauna sessions</span>
        </div>
      </section>

      <section className="session-focus" aria-labelledby="session-focus-title">
        {slot ? (
          <>
            <div className="session-focus-copy">
              <div className="session-focus-labels">
                <p className="eyebrow">
                  {overview.slotSource === "today"
                    ? slot.status === "completed"
                      ? "Today · completed"
                      : "Today’s workout"
                    : overview.slotSource === "next"
                      ? "Next planned workout"
                      : "Latest completed workout"}
                </p>
                <span className={`status-badge status-${slot.status}`}>
                  {slot.status.replace("_", " ")}
                </span>
              </div>
              <h2 id="session-focus-title">{slot.focus}</h2>
              <p className="session-focus-date">
                {formatPlanDate(slot.plannedDate)}
                {overview.noUpcomingWorkout ? " · No upcoming workout planned" : ""}
              </p>
              {displayedExerciseNames.length > 0 ? (
                <div className="session-exercise-list">
                  <p className="session-exercise-label">{exerciseListLabel}</p>
                  <div
                    className="exercise-chip-list"
                    aria-label={`${exerciseListLabel} exercises`}
                  >
                    {displayedExerciseNames.map((exerciseName, index) => (
                      <span
                        className={`exercise-chip ${
                          overview.exerciseSource === "actual" ? "exercise-chip-actual" : ""
                        }`}
                        key={`${exerciseName}-${index}`}
                      >
                        {exerciseName}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted">
                  {overview.exerciseSource === "actual"
                    ? "No exercises were logged for this session."
                    : "No exercise names are saved for this slot yet."}
                </p>
              )}
              {overview.todayActivities.length > 0 ? (
                <div className="session-exercise-list session-activity-list">
                  <p className="session-exercise-label">Also today</p>
                  <div className="exercise-chip-list" aria-label="Other activities today">
                    {overview.todayActivities.map((activity) => (
                      <span className="exercise-chip activity-chip" key={activity.id}>
                        <strong>{activityLabel(activity)}</strong>
                        {activity.durationMinutes != null ? (
                          <span>{Math.round(activity.durationMinutes)} min</span>
                        ) : null}
                        {activity.avgHeartRate != null ? (
                          <span>{activity.avgHeartRate} avg HR</span>
                        ) : null}
                        {activity.source === "whoop_api" ? <small>WHOOP</small> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {overview.recoveryContext ? (
              <div className="recovery-context" aria-label="Today’s recovery context">
                <p className="eyebrow">Today’s context</p>
                <div className="recovery-context-values">
                  <div>
                    <strong>{overview.recoveryContext.recoveryScore ?? "—"}</strong>
                    <span>recovery</span>
                  </div>
                  <div>
                    <strong>
                      {overview.recoveryContext.sleepPerformancePercentage != null
                        ? `${Math.round(
                            overview.recoveryContext.sleepPerformancePercentage
                          )}%`
                        : "—"}
                    </strong>
                    <span>sleep</span>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="session-focus-copy">
            <p className="eyebrow">No training history yet</p>
            <h2 id="session-focus-title">Set this week’s plan to begin.</h2>
            <p className="muted">
              Planned exercise names will determine which progress appears here.
            </p>
          </div>
        )}
      </section>

      <section className="progress-section" id="evidence" aria-labelledby="progress-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              {overview.exerciseSource === "actual" ? "Actual session" : "Exercise progress"}
            </p>
            <h2 id="progress-title">
              {overview.exerciseSource === "actual"
                ? "Progress for what you performed"
                : overview.slotSource === "next"
                ? "What you’re training next"
                : "Progress for this session"}
            </h2>
          </div>
          <nav className="range-control" aria-label="Progress range">
            {overviewLookbackOptions.map((weeks) => (
              <Link
                aria-current={weeks === lookbackWeeks ? "page" : undefined}
                className={weeks === lookbackWeeks ? "active" : undefined}
                href={`/dashboard?range=${weeks}#evidence`}
                key={weeks}
              >
                {weeks}w
              </Link>
            ))}
          </nav>
        </div>

        {overview.exercises.length > 0 ? (
          <div className="exercise-progress-list">
            {overview.exercises.map((exercise, index) => {
              const change = percentLabel(exercise.comparison?.percentChange ?? null);
              const volumeChange = percentLabel(
                exercise.volumeComparison?.percentChange ?? null
              );
              const displayedResult = exercise.actual ?? exercise.latest;

              return (
                <article
                  className="exercise-progress-card"
                  key={`${exercise.exerciseName}-${index}`}
                >
                  <div className="exercise-progress-summary">
                    <div className="exercise-progress-title">
                      <div>
                        <h3>{exercise.exerciseName}</h3>
                        <p className="row-meta">
                          {exercise.metricLabel ?? "Recent logged history"}
                        </p>
                      </div>
                      {exercise.latestIsPersonalBest ? (
                        <span className="tag progress-best">Personal best</span>
                      ) : null}
                    </div>

                    {exercise.comparison ? (
                      <div className="then-now">
                        <div>
                          <span>Then · {formatShortPlanDate(exercise.comparison.from.dateKey)}</span>
                          <strong>{exercise.comparison.from.resultLabel}</strong>
                        </div>
                        <span className="then-now-arrow" aria-hidden="true">
                          →
                        </span>
                        <div>
                          <span>Now · {formatShortPlanDate(exercise.comparison.to.dateKey)}</span>
                          <strong>{exercise.comparison.to.resultLabel}</strong>
                        </div>
                        {change ? <span className="progress-change">{change}</span> : null}
                      </div>
                    ) : exercise.state === "empty" ? (
                      <p className="progress-message">
                        No logged history under this exact exercise name yet.
                      </p>
                    ) : exercise.state === "mixed" ? (
                      <p className="progress-message">
                        Logged sets are shown below, but this history does not support one
                        consistent strength comparison.
                      </p>
                    ) : exercise.metricKind === "history_only" && displayedResult ? (
                      <p className="progress-message">
                        Logged sets are shown below without a percentage comparison.
                      </p>
                    ) : (
                      <p className="progress-message">
                        More comparable sessions are needed for a then-versus-now view.
                      </p>
                    )}

                    {exercise.volumeComparison ? (
                      <div className="volume-comparison">
                        <span>Logged volume</span>
                        <strong>
                          {formatVolume(exercise.volumeComparison.from.value)} →{" "}
                          {formatVolume(exercise.volumeComparison.to.value)}
                        </strong>
                        {volumeChange ? (
                          <span className="progress-change">{volumeChange}</span>
                        ) : null}
                        <small>
                          {formatShortPlanDate(exercise.volumeComparison.from.dateKey)} →{" "}
                          {formatShortPlanDate(exercise.volumeComparison.to.dateKey)}
                        </small>
                      </div>
                    ) : null}

                    {displayedResult ? (
                      <p className="latest-sets">
                        <span>{exercise.actual ? "This session" : "Latest session"}</span>
                        {displayedResult.setsLabel}
                      </p>
                    ) : exercise.lastTrainedDate ? (
                      <p className="latest-sets">
                        <span>Last trained</span>
                        {formatShortPlanDate(exercise.lastTrainedDate)}
                      </p>
                    ) : null}
                  </div>

                  {exercise.points.length >= 2 ? (
                    <div className="exercise-progress-chart">
                      <ProgressSparkline
                        label={`${exercise.exerciseName} ${exercise.metricLabel} over ${lookbackWeeks} weeks`}
                        values={exercise.points.map((point) => point.value)}
                      />
                      <div className="sparkline-range" aria-hidden="true">
                        <span>{formatShortPlanDate(exercise.points[0].dateKey)}</span>
                        <span>{formatShortPlanDate(exercise.points.at(-1)!.dateKey)}</span>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty compact-empty">
            {slot
              ? overview.exerciseSource === "actual"
                ? "No exercises were logged for this session."
                : "Add exercise names to this plan slot to see their progress."
              : "No planned exercises to show yet."}
          </div>
        )}
      </section>

      {targetRows.length > 0 ? (
        <section className="week-status" aria-labelledby="weekly-targets-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Weekly prescription</p>
              <h2 id="weekly-targets-title">Targets and actuals</h2>
            </div>
            {overview.weeklyTargets.actual.surfSessions > 0 ? (
              <span className="tag">
                Surf · {overview.weeklyTargets.actual.surfSessions} session
                {overview.weeklyTargets.actual.surfSessions === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="week-slot-list">
            {targetRows.map((row) => {
              const met = row.actual >= row.target;
              return (
                <div className={`week-slot ${met ? "week-slot-completed" : ""}`} key={`${row.label}-${row.unit}`}>
                  <span>{row.label}</span>
                  <strong>
                    {row.actual} / {row.target} {row.unit}
                  </strong>
                  <small>{met ? "target met" : `${row.target - row.actual} remaining`}</small>
                </div>
              );
            })}
          </div>
          <p className="row-meta" style={{ marginTop: 12 }}>
            Surf is synced and shown separately; it does not automatically satisfy the Zone 2 prescription.
          </p>
        </section>
      ) : null}

      {overview.week.total > 0 ? (
        <section className="week-status" aria-labelledby="week-status-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Week status</p>
              <h2 id="week-status-title">
                {overview.week.completed} of {overview.week.total} completed
              </h2>
            </div>
            {overview.week.inProgress > 0 ? (
              <span className="tag">{overview.week.inProgress} in progress</span>
            ) : null}
          </div>
          <div className="week-slot-list">
            {overview.week.slots.map((weekSlot) => (
              <div className={`week-slot week-slot-${weekSlot.status}`} key={weekSlot.id}>
                <span>{formatWeekday(weekSlot.plannedDate)}</span>
                <strong>{weekSlot.focus}</strong>
                <small>{weekSlot.status.replace("_", " ")}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </SiteChrome>
  );
}
