export function normalizeExerciseLookupName(name: string) {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/\bdumbell\b/g, "dumbbell")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/[-_/()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(query: string, candidate: string) {
  const queryTokens = new Set(normalizeExerciseLookupName(query).split(" ").filter(Boolean));
  const candidateTokens = new Set(
    normalizeExerciseLookupName(candidate).split(" ").filter(Boolean)
  );
  if (queryTokens.size === 0 || candidateTokens.size === 0) return 0;

  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  const union = new Set([...queryTokens, ...candidateTokens]).size;
  return overlap / union;
}

export function rankExerciseSuggestions<T extends { id: string; name: string }>(
  query: string,
  exercises: T[],
  limit = 3
) {
  const ranked = exercises
    .map((exercise) => ({ exercise, score: tokenScore(query, exercise.name) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
  const threshold = (ranked[0]?.score ?? 0) * 0.75;

  return ranked
    .filter(({ score }) => score >= threshold)
    .slice(0, limit)
    .map(({ exercise }) => exercise);
}
