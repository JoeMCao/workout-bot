import { SiteChrome } from "@/components/dashboard/SiteChrome";
import { getInsights } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const insights = await getInsights();

  return (
    <SiteChrome
      eyebrow="Deterministic"
      title="Insights"
      description="Rule-based observations only. No LLM interpretation is used in this v1."
    >
      <section className="card">
        {insights.length > 0 ? (
          <div className="list">
            {insights.map((insight) => (
              <article className="row" key={insight}>
                <div className="row-meta">Signal</div>
                <div>
                  <h2>{insight}</h2>
                  <p className="muted">Derived from logged sessions, activity metrics, and notes.</p>
                </div>
                <span className="tag">read-only</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No deterministic insights available yet.</div>
        )}
      </section>
    </SiteChrome>
  );
}
