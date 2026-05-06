/** Append qualitative notes without duplicating the same fragment. */
export function appendNotesDedupe(
  existing: string | null | undefined,
  addition: string
): string {
  const a = (existing ?? "").trim();
  const b = addition.trim();
  if (!b) return a;
  if (!a) return b;
  if (a.includes(b)) return a;
  return `${a}\n\n${b}`;
}
