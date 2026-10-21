import {
  addDays,
  dayOfWeek,
  daysBetween,
  fromDayNumber,
  toDayNumber,
} from "../shared/dates";
import type { DateString, OnCallCalendarData } from "../shared/types";

/** Commonly used timezones offered when configuring a calendar. */
const CommonTimeZones = [
  "UTC",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Halifax",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Returns the timezones to offer when configuring a calendar, including the
 * browser's timezone and the currently selected one.
 *
 * @param current the currently selected timezone, if any.
 * @returns a sorted list of timezones.
 */
export function getTimeZoneOptions(current?: string): string[] {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [
    ...new Set(
      [...CommonTimeZones, local, current].filter((tz): tz is string => !!tz)
    ),
  ].sort();
}

/**
 * Returns the browser's timezone.
 *
 * @returns the IANA timezone.
 */
export function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Formats a date for display.
 *
 * @param date the date to format.
 * @param locale the locale to format in.
 * @param options the formatting options.
 * @returns the formatted date.
 */
export function formatDate(
  date: DateString,
  locale: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
    ...options,
    timeZone: "UTC",
  });
}

/**
 * Formats a date range for display.
 *
 * @param startDate the first day of the range.
 * @param endDate the last day of the range, inclusive.
 * @param locale the locale to format in.
 * @returns the formatted range.
 */
export function formatDateRange(
  startDate: DateString,
  endDate: DateString,
  locale: string
): string {
  if (startDate === endDate) {
    return formatDate(startDate, locale);
  }
  return `${formatDate(startDate, locale)} – ${formatDate(endDate, locale)}`;
}

/**
 * Returns the names of the days of the week in order.
 *
 * @param locale the locale to format in.
 * @param weekStartsOn the first day of the week, where 0 is Sunday.
 * @param format the width of the names.
 * @returns the names.
 */
export function getWeekdayNames(
  locale: string,
  weekStartsOn: number,
  format: "short" | "long" = "short"
): string[] {
  // 2026-10-18 is a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    formatDate(addDays("2026-10-18", (weekStartsOn + i) % 7), locale, {
      weekday: format,
    })
  );
}

/**
 * Returns the first day of the week containing a date.
 *
 * @param date the date.
 * @param weekStartsOn the first day of the week, where 0 is Sunday.
 * @returns the first day of the week.
 */
export function startOfWeek(
  date: DateString,
  weekStartsOn: number
): DateString {
  return addDays(date, -((dayOfWeek(date) - weekStartsOn + 7) % 7));
}

/**
 * Returns the weeks to display for a month, each with seven days.
 *
 * @param month any date in the month.
 * @param weekStartsOn the first day of the week, where 0 is Sunday.
 * @returns the weeks of the month.
 */
export function getMonthWeeks(
  month: DateString,
  weekStartsOn: number
): DateString[][] {
  const first = `${month.slice(0, 7)}-01`;
  const last = addDays(addMonths(first, 1), -1);
  const weeks: DateString[][] = [];

  let weekStart = startOfWeek(first, weekStartsOn);
  while (weekStart <= last) {
    weeks.push(getWeekDays(weekStart));
    weekStart = addDays(weekStart, 7);
  }

  return weeks;
}

/**
 * Returns the seven days of a week.
 *
 * @param weekStart the first day of the week.
 * @returns the days.
 */
export function getWeekDays(weekStart: DateString): DateString[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Adds a number of months to the first day of a month.
 *
 * @param date any date in the month.
 * @param months the number of months to add, may be negative.
 * @returns the first day of the resulting month.
 */
export function addMonths(date: DateString, months: number): DateString {
  const [year, month] = date.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const resultYear = Math.floor(total / 12);
  const resultMonth = (total % 12) + 1;
  return `${String(resultYear).padStart(4, "0")}-${String(resultMonth).padStart(2, "0")}-01`;
}

/**
 * Returns the day of the week calendars start on, based on their first rotation.
 *
 * @param calendar the calendar.
 * @returns the first day of the week, where 0 is Sunday.
 */
export function getWeekStartsOn(calendar: OnCallCalendarData): number {
  return calendar.rotations[0]?.startDayOfWeek ?? 1;
}

/**
 * Returns the later of two dates.
 *
 * @param a the first date.
 * @param b the second date.
 * @returns the later date.
 */
export function maxDate(a: DateString, b: DateString): DateString {
  return a > b ? a : b;
}

/**
 * Returns the earlier of two dates.
 *
 * @param a the first date.
 * @param b the second date.
 * @returns the earlier date.
 */
export function minDate(a: DateString, b: DateString): DateString {
  return a < b ? a : b;
}

/**
 * Returns the number of days in a range, inclusive.
 *
 * @param startDate the first day.
 * @param endDate the last day.
 * @returns the number of days.
 */
export function rangeLength(startDate: DateString, endDate: DateString) {
  return daysBetween(startDate, endDate) + 1;
}

export { addDays, fromDayNumber, toDayNumber };
