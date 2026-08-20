import { SiteChrome } from "@/components/dashboard/SiteChrome";
import { WhoopSyncPanel } from "@/components/dashboard/WhoopSyncPanel";
import { getDataHealthData } from "@/lib/dashboard/plan-driven-overview";
import { formatLocalDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function formatOptionalDate(value: string | null) {
  return value ? formatLocalDate(value) : "Never";
}

export default async function DataHealthPage() {
  const data = await getDataHealthData();
  const links = data.workoutActivityLinks;

  return (
    <SiteChrome
      eyebrow="Operations"
      title="Data health"
      description="WHOOP connection, synchronization, and workout-data linkage maintenance."
    >
      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <p className="eyebrow">WHOOP connection</p>
          <h2>{data.whoop.connected ? "Connected" : "Not connected"}</h2>
          <div className="data-health-list">
            <div>
              <span>Last workout sync</span>
              <strong>{formatOptionalDate(data.whoop.lastSyncAt)}</strong>
            </div>
            <div>
              <span>Token expires</span>
              <strong>{formatOptionalDate(data.whoop.expiresAt)}</strong>
            </div>
            <div>
              <span>WHOOP activity rows</span>
              <strong>{data.whoop.whoopActivitySessionCount}</strong>
            </div>
          </div>
          {data.whoop.lastSyncError ? (
            <p className="data-health-error">Last sync error: {data.whoop.lastSyncError}</p>
          ) : null}
          <p style={{ marginTop: 16, marginBottom: 0 }}>
            <a className="button" href="/api/auth/whoop/start">
              {data.whoop.connected ? "Reconnect WHOOP" : "Connect WHOOP"}
            </a>
          </p>
        </div>

        <div className="card">
          <p className="eyebrow">Review queue</p>
          <span className="data-health-value">{data.whoop.needsReviewActivityCount}</span>
          <p className="muted">
            Strength activities need manual review when they cannot be linked to one workout.
          </p>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">Workout linkage</p>
        <h2>
          {links.withLinkedActivity} of {links.workoutSessionsTotal} strength sessions linked
        </h2>
        <p className="muted">
          {links.withoutLinkedActivity === 0
            ? "Every strength WorkoutSession has a linked ActivitySession."
            : `${links.withoutLinkedActivity} strength session${
                links.withoutLinkedActivity === 1 ? "" : "s"
              } still need an ActivitySession link.`}
        </p>
      </section>

      <section className="card">
        <p className="eyebrow">Maintenance</p>
        <h2>Sync WHOOP workouts</h2>
        <WhoopSyncPanel whoopConnected={data.whoop.connected} />
      </section>
    </SiteChrome>
  );
}
