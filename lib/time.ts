/** IANA timezone used when interpreting user-facing times (all DB instants are UTC). */
export const DEFAULT_USER_TIMEZONE = "America/Los_Angeles";

export const workoutSessionTimeSource = {
  apiDefault: "api_default",
  userProvided: "user_provided"
} as const;

export const activitySessionTimeSource = {
  ...workoutSessionTimeSource,
  whoopScreenshot: "whoop_screenshot",
  whoopApi: "whoop_api"
} as const;

export type WorkoutSessionTimeSource =
  (typeof workoutSessionTimeSource)[keyof typeof workoutSessionTimeSource];

export type ActivitySessionTimeSource =
  (typeof activitySessionTimeSource)[keyof typeof activitySessionTimeSource];

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

function getLocalDateParts(
  date: Date,
  timeZone = DEFAULT_USER_TIMEZONE
): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const valueFor = (type: keyof LocalDateParts) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Could not resolve ${type} for ${timeZone}`);
    }
    return Number(value);
  };

  return {
    year: valueFor("year"),
    month: valueFor("month"),
    day: valueFor("day")
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone = DEFAULT_USER_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const valueFor = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) {
      throw new Error(`Could not resolve ${type} for ${timeZone}`);
    }
    return Number(value);
  };

  const localAsUtc = Date.UTC(
    valueFor("year"),
    valueFor("month") - 1,
    valueFor("day"),
    valueFor("hour"),
    valueFor("minute"),
    valueFor("second")
  );

  return localAsUtc - date.getTime();
}

export function getServerNow() {
  return new Date();
}

export function getLocalDateKey(date: Date, timeZone = DEFAULT_USER_TIMEZONE) {
  const { year, month, day } = getLocalDateParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Resolve local midnight for a `YYYY-MM-DD` calendar day to its UTC instant. */
export function getStartOfLocalDateUtc(
  ymd: string,
  timeZone = DEFAULT_USER_TIMEZONE
) {
  const [year, month, day] = ymd.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid YYYY-MM-DD: ${ymd}`);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const offsetMs = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMs);
}

/** Shift a calendar day label `YYYY-MM-DD` by whole days in the given timezone (noon anchor avoids DST edge cases). */
export function shiftLocalDateKey(
  ymd: string,
  deltaDays: number,
  timeZone = DEFAULT_USER_TIMEZONE
) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid YYYY-MM-DD: ${ymd}`);
  const localNoon = new Date(y, m - 1, d, 12, 0, 0, 0);
  localNoon.setDate(localNoon.getDate() + deltaDays);
  return getLocalDateKey(localNoon, timeZone);
}

export function formatLocalDate(
  value: string | Date,
  timeZone = DEFAULT_USER_TIMEZONE
) {
  return new Intl.DateTimeFormat("en", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export function formatLocalShortDate(
  value: string | Date,
  timeZone = DEFAULT_USER_TIMEZONE
) {
  return new Intl.DateTimeFormat("en", {
    timeZone,
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function getStartOfLocalWeekUtc(
  date = getServerNow(),
  timeZone = DEFAULT_USER_TIMEZONE
) {
  const { year, month, day } = getLocalDateParts(date, timeZone);
  const localNoonAsUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const dayOfWeek = localNoonAsUtc.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const mondayUtcGuess = new Date(
    Date.UTC(year, month - 1, day - daysFromMonday, 0, 0, 0, 0)
  );
  const offsetMs = getTimeZoneOffsetMs(mondayUtcGuess, timeZone);

  return new Date(mondayUtcGuess.getTime() - offsetMs);
}
