import { SiteChrome } from "@/components/dashboard/SiteChrome";
import { WhoopSyncPanel } from "@/components/dashboard/WhoopSyncPanel";
import {
  formatDate,
  formatDuration,
  getOverviewData,
  labelForTag
} from "@/lib/analytics";

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "Never";
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const overview = await getOverviewData();

  return (
    <SiteChrome
      eyebrow="Workout Bot"
      title="Training intelligence"
      description="A read-only layer over your Postgres workout database: history, volume, recovery context, and simple signals."
    >
      <section className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="eyebrow">Latest Session</p>
          {overview.latest ? (
            <>
              <h2>{overview.latest.title}</h2>
              <p className="muted">
                {formatDate(overview.latest.date)} / {formatDuration(overview.latest.durationMinutes)}
              </p>
              <p>{overview.latest.details}</p>
              {overview.latest.tags.length > 0 ? (
                <div className="tag-list">
                  {overview.latest.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {labelForTag(tag)}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">No sessions logged yet.</p>
          )}
        </div>

        <div className="card">
          <p className="eyebrow">This Week</p>
          <div className="grid grid-2">
            <div className="metric">
              <span className="metric-value">{overview.week.total}</span>
              <span className="muted">sessions</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.week.minutes}</span>
              <span className="muted">logged minutes</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.week.strength}</span>
              <span className="muted">strength</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.week.cardio}</span>
              <span className="muted">cardio</span>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">All Time</p>
          <div className="grid grid-2">
            <div className="metric">
              <span className="metric-value">{overview.totals.sessions}</span>
              <span className="muted">total sessions</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.totals.strength}</span>
              <span className="muted">strength (WorkoutSession)</span>
            </div>
            <div className="metric" style={{ gridColumn: "1 / -1" }}>
              <span className="metric-value">
                {overview.workoutActivityLinks.withLinkedActivity} /{" "}
                {overview.workoutActivityLinks.workoutSessionsTotal}
              </span>
              <span className="muted">
                strength sessions with a linked ActivitySession (shell or WHOOP)
              </span>
            </div>
            {overview.workoutActivityLinks.withoutLinkedActivity > 0 ? (
              <div className="metric" style={{ gridColumn: "1 / -1" }}>
                <span className="metric-value" style={{ color: "#b45309" }}>
                  {overview.workoutActivityLinks.withoutLinkedActivity}
                </span>
                <span className="muted">
                  strength sessions with no ActivitySession yet (use backfill / WHOOP sync to link)
                </span>
              </div>
            ) : null}
            <div className="metric">
              <span className="metric-value">{overview.totals.cardio}</span>
              <span className="muted">cardio</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {overview.totals.sauna + overview.totals.coldPlunge + overview.totals.mobility}
              </span>
              <span className="muted">recovery context</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-3">
        <div className="card">
          <h2>WHOOP today (sleep / recovery)</h2>
          <p className="muted" style={{ marginBottom: 8 }}>
            Local day {overview.whoopHealth.localDate}. Sync via{" "}
            <code style={{ fontSize: 12 }}>POST /api/whoop/health-context/sync</code> or your GPT tools.
          </p>
          <div className="grid grid-2">
            <div className="metric">
              <span className="metric-value">
                {overview.whoopHealth.recoveryScore ?? "—"}
              </span>
              <span className="muted">recovery score</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {overview.whoopHealth.sleepPerformancePercentage != null
                  ? `${Math.round(overview.whoopHealth.sleepPerformancePercentage)}%`
                  : "—"}
              </span>
              <span className="muted">sleep performance</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {overview.whoopHealth.hrvRmssdMilli != null
                  ? overview.whoopHealth.hrvRmssdMilli.toFixed(1)
                  : "—"}
              </span>
              <span className="muted">HRV RMSSD (ms)</span>
            </div>
            <div className="metric">
              <span className="metric-value">
                {overview.whoopHealth.restingHeartRate != null
                  ? overview.whoopHealth.restingHeartRate.toFixed(0)
                  : "—"}
              </span>
              <span className="muted">resting HR</span>
            </div>
            <div className="metric" style={{ gridColumn: "1 / -1" }}>
              <span className="row-title">
                {formatOptionalDate(overview.whoopHealth.lastHealthContextAt)}
              </span>
              <span className="muted">last health row update (sleep or recovery)</span>
            </div>
            <div className="metric" style={{ gridColumn: "1 / -1" }}>
              <span className="row-meta">
                Scopes: sleep {overview.whoopHealth.readSleep ? "yes" : "no"}, recovery{" "}
                {overview.whoopHealth.readRecovery ? "yes" : "no"}
              </span>
            </div>
          </div>
          {overview.whoopHealth.lastSyncError ? (
            <p className="row-meta" style={{ color: "#b91c1c", marginTop: 12 }}>
              WHOOP connection error: {overview.whoopHealth.lastSyncError}
            </p>
          ) : null}
        </div>

        <div className="card">
          <h2>Recovery Modalities</h2>
          <div className="grid grid-3">
            <div className="metric">
              <span className="metric-value">{overview.totals.sauna}</span>
              <span className="muted">sauna</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.totals.coldPlunge}</span>
              <span className="muted">cold plunge</span>
            </div>
            <div className="metric">
              <span className="metric-value">{overview.totals.mobility}</span>
              <span className="muted">mobility</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>WHOOP Sync</h2>
          <p className="muted">
            {overview.whoop.connected ? "Connected" : "Not connected"}
          </p>
          <div className="grid grid-2">
            <div className="metric">
              <span className="metric-value">{overview.whoop.whoopActivitySessionCount}</span>
              <span className="muted">ActivitySession rows from WHOOP</span>
            </div>
            <div className="metric">
              <span className="row-title">{formatOptionalDate(overview.whoop.lastSyncAt)}</span>
              <span className="muted">last workout sync</span>
            </div>
            {overview.whoop.needsReviewActivityCount > 0 ? (
              <div className="metric" style={{ gridColumn: "1 / -1" }}>
                <span className="metric-value" style={{ color: "#b45309" }}>
                  {overview.whoop.needsReviewActivityCount}
                </span>
                <span className="muted">
                  strength WHOOP activities need a manual link (no single matching workout)
                </span>
              </div>
            ) : null}
          </div>
          {overview.whoop.expiresAt ? (
            <p className="row-meta" style={{ marginTop: 12 }}>
              Token expires {formatDate(overview.whoop.expiresAt)}
            </p>
          ) : null}
          {overview.whoop.lastSyncError ? (
            <p className="row-meta" style={{ color: "#b91c1c", marginTop: 12 }}>
              Last sync error: {overview.whoop.lastSyncError}
            </p>
          ) : null}
          <p style={{ marginTop: 16 }}>
            <a className="button" href="/api/auth/whoop/start">
              {overview.whoop.connected ? "Reconnect WHOOP" : "Connect WHOOP"}
            </a>
          </p>
          <WhoopSyncPanel whoopConnected={overview.whoop.connected} />
        </div>
      </section>

      <section className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Recent Notes / Flags</h2>
          {overview.recentContext.length > 0 ? (
            <div className="list">
              {overview.recentContext.map((event) => (
                <div className="row" key={`${event.source}-${event.id}`}>
                  <div className="row-meta">{formatDate(event.date)}</div>
                  <div>
                    <div className="row-title">{event.label}</div>
                    <div className="row-meta">{event.notes ?? "Context tag"}</div>
                  </div>
                  <div className="tag-list">
                    {event.tags.map((tag) => (
                      <span className="tag" key={tag}>
                        {labelForTag(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No soreness, fatigue, pain, sauna, or cold plunge notes found yet.</p>
          )}
        </div>
      </section>
    </SiteChrome>
  );
}
