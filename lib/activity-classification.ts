export const intentionalCardioActivityTypes = [
  "zone2",
  "hiit",
  "stairmaster",
  "run",
  "hike",
  "swim",
  "bike"
] as const;

const intentionalCardioTypes = new Set<string>(intentionalCardioActivityTypes);

export function isIntentionalCardioActivity(type: string) {
  return intentionalCardioTypes.has(type);
}
