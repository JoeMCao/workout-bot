/** IANA timezone used when interpreting user-facing times (all DB instants are UTC). */
export const DEFAULT_USER_TIMEZONE = "America/Los_Angeles";

export const workoutSessionTimeSource = {
  apiDefault: "api_default",
  userProvided: "user_provided"
} as const;

export const activitySessionTimeSource = {
  ...workoutSessionTimeSource,
  whoopScreenshot: "whoop_screenshot"
} as const;

export type WorkoutSessionTimeSource =
  (typeof workoutSessionTimeSource)[keyof typeof workoutSessionTimeSource];

export type ActivitySessionTimeSource =
  (typeof activitySessionTimeSource)[keyof typeof activitySessionTimeSource];
