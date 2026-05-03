import Link from "next/link";
import { SiteChrome } from "@/components/dashboard/SiteChrome";
import {
  activityFilters,
  formatDate,
  formatDuration,
  getTrainingLog,
  isActivityFilter,
  labelForTag
} from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function TrainingLogPage({
  searchParams
}: {
  searchParams?: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const filter = isActivityFilter(params?.type) ? params?.type : "all";
  const items = await getTrainingLog(filter);

  return (
    <SiteChrome
      eyebrow="History"
      title="Training log"
      description="Chronological sessions from the existing workout and activity tables."
    >
      <div className="filter-bar">
        {activityFilters.map((activityFilter) => (
          <Link
            className="pill"
            href={
              activityFilter === "all"
                ? "/training-log"
                : `/training-log?type=${activityFilter}`
            }
            key={activityFilter}
          >
            {activityFilter.replace("_", " ")}
          </Link>
        ))}
      </div>

      <section className="card">
        {items.length > 0 ? (
          <div className="list">
            {items.map((item) => (
              <article className="row" key={`${item.kind}-${item.id}`}>
                <div>
                  <div className="row-title">{formatDate(item.date)}</div>
                  <div className="row-meta">{formatDuration(item.durationMinutes)}</div>
                </div>
                <div>
                  <h2>{item.title}</h2>
                  <p className="muted">
                    {item.type} / {item.details || "No details"} / {item.source}
                  </p>
                  {item.notes ? <p>{item.notes}</p> : null}
                </div>
                <div className="tag-list">
                  {item.intensity ? <span className="tag">{item.intensity}</span> : null}
                  {item.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {labelForTag(tag)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty">No sessions match this filter.</div>
        )}
      </section>
    </SiteChrome>
  );
}
