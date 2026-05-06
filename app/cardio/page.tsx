import { CardioTrendChart, ZoneMinutesChart } from "@/components/dashboard/Charts";
import { SiteChrome } from "@/components/dashboard/SiteChrome";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatElevation,
  formatPace,
  getCardioTrends,
  labelForTag
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function CardioPage() {
  const points = await getCardioTrends();
  const recent = [...points].reverse().slice(0, 12);

  return (
    <SiteChrome
      eyebrow="Cardio"
      title="Cardio trends"
      description="Duration, HR, calories, distance, zones, and session notes from logged activity sessions."
    >
      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Duration and heart rate</h2>
          <CardioTrendChart points={points} />
        </div>
        <div className="card">
          <h2>Latest zone minutes</h2>
          <ZoneMinutesChart points={points} />
        </div>
      </section>

      <section className="card">
        <h2>Recent cardio sessions</h2>
        {recent.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Modality</th>
                <th>Duration</th>
                <th>Avg / Max HR</th>
                <th>Calories</th>
                <th>Distance</th>
                <th>Pace</th>
                <th>Elevation</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((point) => (
                <tr key={point.id}>
                  <td>{formatDate(point.date)}</td>
                  <td>{point.modality}</td>
                  <td>{formatDuration(point.durationMinutes)}</td>
                  <td>
                    {point.avgHeartRate ?? "-"} / {point.maxHeartRate ?? "-"}
                  </td>
                  <td>{point.calories ?? "-"}</td>
                  <td>{formatDistance(point.distanceMeters) ?? "-"}</td>
                  <td>{formatPace(point.paceSecondsPerKm) ?? "-"}</td>
                  <td>
                    {[
                      point.elevationGainMeters != null
                        ? `+${formatElevation(point.elevationGainMeters)}`
                        : null,
                      point.elevationLossMeters != null
                        ? `-${formatElevation(point.elevationLossMeters)}`
                        : null
                    ]
                      .filter(Boolean)
                      .join(" / ") || "-"}
                  </td>
                  <td>
                    {point.notes ? <p>{point.notes}</p> : <span className="muted">No notes</span>}
                    {point.tags.length > 0 ? (
                      <div className="tag-list">
                        {point.tags.map((tag) => (
                          <span className="tag" key={tag}>
                            {labelForTag(tag)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No cardio sessions logged yet.</div>
        )}
      </section>
    </SiteChrome>
  );
}
