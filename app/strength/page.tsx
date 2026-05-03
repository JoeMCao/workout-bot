import { StrengthProgressChart } from "@/components/dashboard/Charts";
import { SiteChrome } from "@/components/dashboard/SiteChrome";
import { formatDate, getStrengthProgress } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function StrengthPage({
  searchParams
}: {
  searchParams?: Promise<{ exercise?: string }>;
}) {
  const params = await searchParams;
  const { exercises, selectedExercise, points } = await getStrengthProgress(params?.exercise);
  const recent = [...points].reverse().slice(0, 12);

  return (
    <SiteChrome
      eyebrow="Strength"
      title="Progress by exercise"
      description="Weight, reps, set history, and estimated 1RM derived from logged exercise sets."
    >
      <section className="card" style={{ marginBottom: 16 }}>
        <form className="filter-bar">
          <label className="muted" htmlFor="exercise">
            Exercise
          </label>
          <select id="exercise" name="exercise" defaultValue={selectedExercise?.id}>
            {exercises.map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name}
              </option>
            ))}
          </select>
          <button className="button" type="submit">
            Update
          </button>
        </form>
        <StrengthProgressChart points={points} />
      </section>

      <section className="card">
        <h2>{selectedExercise ? `${selectedExercise.name} recent performances` : "Recent performances"}</h2>
        {recent.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Set</th>
                <th>Weight</th>
                <th>Reps</th>
                <th>Est. 1RM</th>
                <th>RPE</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((point) => (
                <tr key={point.id}>
                  <td>{formatDate(point.date)}</td>
                  <td>{point.setNumber ?? "-"}</td>
                  <td>{point.weight ?? "-"}</td>
                  <td>{point.reps ?? "-"}</td>
                  <td>{point.estimatedOneRepMax ?? "-"}</td>
                  <td>{point.rpe ?? "-"}</td>
                  <td>
                    <div className="tag-list">
                      {point.isBestWeight ? <span className="tag">Best weight</span> : null}
                      {point.isBestEstimatedOneRepMax ? (
                        <span className="tag">Best est. 1RM</span>
                      ) : null}
                      {point.notes ? <span className="tag">{point.notes}</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">No set history found yet.</div>
        )}
      </section>
    </SiteChrome>
  );
}
