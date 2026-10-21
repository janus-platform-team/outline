import type { DateString } from "./types";

const DayMs = 24 * 60 * 60 * 1000;

/** Matches a date in the form YYYY-MM-DD. */
export const DateStringRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts a date string to the number of days since the unix epoch.
 *
 * @param date the date in the form YYYY-MM-DD.
 * @returns the day number.
 */
export function toDayNumber(date: DateString): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / DayMs);
}

/**
 * Converts a number of days since the unix epoch to a date string.
 *
 * @param dayNumber the day number.
 * @returns the date in the form YYYY-MM-DD.
 */
export function fromDayNumber(dayNumber: number): DateString {
  return new Date(dayNumber * DayMs).toISOString().slice(0, 10);
}

/**
 * Returns whether a string is a valid calendar date in the form YYYY-MM-DD.
 *
 * @param date the string to check.
 * @returns true if the string is a valid date.
 */
export function isValidDate(date: string): boolean {
  if (!DateStringRegex.test(date)) {
    return false;
  }
  return fromDayNumber(toDayNumber(date)) === date;
}

/**
 * Adds a number of days to a date.
 *
 * @param date the date to add to.
 * @param days the number of days to add, may be negative.
 * @returns the resulting date.
 */
export function addDays(date: DateString, days: number): DateString {
  return fromDayNumber(toDayNumber(date) + days);
}

/**
 * Returns the number of days from one date to another.
 *
 * @param from the start date.
 * @param to the end date.
 * @returns the number of days, negative if `to` is before `from`.
 */
export function daysBetween(from: DateString, to: DateString): number {
  return toDayNumber(to) - toDayNumber(from);
}

/**
 * Returns the day of the week of a date.
 *
 * @param date the date.
 * @returns the day of the week, where 0 is Sunday.
 */
export function dayOfWeek(date: DateString): number {
  // The unix epoch was a Thursday.
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/**
 * Returns the first date on or after the given date that falls on a weekday.
 *
 * @param date the date to start from.
 * @param weekday the day of the week, where 0 is Sunday.
 * @returns the matching date.
 */
export function nextWeekday(date: DateString, weekday: number): DateString {
  return addDays(date, (weekday - dayOfWeek(date) + 7) % 7);
}

/**
 * Returns the current local date and hour in a timezone.
 *
 * @param timeZone the IANA timezone.
 * @param now the instant to convert, defaults to the current time.
 * @returns the local date and hour.
 */
export function getLocalDateTime(
  timeZone: string,
  now: Date = new Date()
): { date: DateString; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
  };
}

/**
 * Returns whether a string is a timezone supported by the runtime.
 *
 * @param timeZone the IANA timezone to check.
 * @returns true if the timezone is valid.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
