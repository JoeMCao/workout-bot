import { SiteChrome } from "@/components/dashboard/SiteChrome";
import {
  formatDate,
  formatDuration,
  getOverviewData,
  labelForTag
} from "@/lib/analytics";

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
              <span className="muted">strength</span>
            </div>
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

      <section className="grid grid-2">
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
