import { SiteChrome } from "@/components/dashboard/SiteChrome";
import type { ContextTag } from "@/lib/analytics";
import { formatDate, getContextTimeline, labelForTag } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function RecoveryPage() {
  const events = await getContextTimeline();
  const tagCounts = events.reduce<Record<string, number>>((counts, event) => {
    for (const tag of event.tags) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
    return counts;
  }, {});

  return (
    <SiteChrome
      eyebrow="Context"
      title="Recovery layer"
      description="Simple tags parsed from session metadata and notes. This is training context, not medical diagnosis."
    >
      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Tag summary</h2>
          {Object.entries(tagCounts).length > 0 ? (
            <div className="grid grid-3">
              {Object.entries(tagCounts).map(([tag, count]) => (
                <div className="metric" key={tag}>
                  <span className="metric-value">{count}</span>
                  <span className="muted">{labelForTag(tag as ContextTag)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No recovery/context tags found yet.</div>
          )}
        </div>

        <div className="card">
          <h2>Tracked signals</h2>
          <p className="muted">
            Tags include soreness, tiredness, neck, hamstring, low back, cold plunge,
            sauna, poor sleep, high fatigue, and pain when those terms or fields are present.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Context over time</h2>
        {events.length > 0 ? (
          <div className="list">
            {events.map((event) => (
              <article className="row" key={`${event.source}-${event.id}`}>
                <div>
                  <div className="row-title">{formatDate(event.date)}</div>
                  <div className="row-meta">{event.source.replace("_", " ")}</div>
                </div>
                <div>
                  <h3>{event.label}</h3>
                  <p className="muted">{event.notes ?? "Metadata-derived context"}</p>
                </div>
                <div className="tag-list">
                  {event.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {labelForTag(tag)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No context events logged yet.</div>
        )}
      </section>
    </SiteChrome>
  );
}
