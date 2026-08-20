export function timestampIsStale(
  value: string | null,
  now: Date,
  maxAgeMinutes: number
) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return now.getTime() - timestamp >= maxAgeMinutes * 60_000;
}
