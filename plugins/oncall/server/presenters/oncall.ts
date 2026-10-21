import { addDays } from "../../shared/dates";
import {
  getSegmentAt,
  groupShifts,
  resolveSchedule,
  sortSegments,
} from "../../shared/schedule";
import type {
  DateString,
  OnCallCalendarData,
  OnCallOverrideData,
  OnCallRotationData,
  ScheduleShift,
} from "../../shared/types";
import type {
  OnCallCalendar,
  OnCallOverride,
  OnCallRotation,
} from "../models";

/** The number of days either side of today searched for the current shift. */
const currentShiftWindow = 60;

/**
 * Presents an override.
 *
 * @param override the override to present.
 * @returns the presented override.
 */
export function presentOverride(override: OnCallOverride): OnCallOverrideData {
  return {
    id: override.id,
    rotationId: override.rotationId,
    userId: override.userId,
    startDate: override.startDate,
    endDate: override.endDate,
    reason: override.reason ?? null,
    createdById: override.createdById,
  };
}

/**
 * Presents a rotation. The segments and overrides associations must be loaded.
 *
 * @param rotation the rotation to present.
 * @param today the current date in the calendar's timezone.
 * @returns the presented rotation.
 */
export function presentRotation(
  rotation: OnCallRotation,
  today: DateString
): OnCallRotationData {
  const segments = sortSegments(rotation.plainSegments);
  const overrides = (rotation.overrides ?? []).map(presentOverride);
  const current = getSegmentAt(segments, today)?.segment ?? segments[0];

  return {
    id: rotation.id,
    calendarId: rotation.calendarId,
    name: rotation.name,
    color: rotation.color,
    startDate: rotation.startDate,
    startDayOfWeek: rotation.startDayOfWeek,
    shiftLengthDays: rotation.shiftLengthDays,
    notifyOnChange: rotation.notifyOnChange,
    index: rotation.index,
    segments,
    memberIds: current ? [...current.memberIds] : [],
    currentShift: getCurrentShift(rotation, today),
    overrides: overrides
      .filter((override) => override.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
  };
}

/**
 * Presents a calendar. The rotations association, with their segments and
 * overrides, must be loaded.
 *
 * @param calendar the calendar to present.
 * @param today the current date in the calendar's timezone.
 * @returns the presented calendar.
 */
export function presentCalendar(
  calendar: OnCallCalendar,
  today: DateString
): OnCallCalendarData {
  return {
    id: calendar.id,
    name: calendar.name,
    description: calendar.description ?? null,
    timezone: calendar.timezone,
    notifyHour: calendar.notifyHour,
    slackConfigured: !!calendar.slackWebhookUrl,
    createdById: calendar.createdById,
    today,
    createdAt: calendar.createdAt.toISOString(),
    updatedAt: calendar.updatedAt.toISOString(),
    rotations: [...(calendar.rotations ?? [])]
      .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name))
      .map((rotation) => presentRotation(rotation, today)),
  };
}

function getCurrentShift(
  rotation: OnCallRotation,
  today: DateString
): ScheduleShift | null {
  const shifts = groupShifts(
    resolveSchedule(
      rotation.plainSegments,
      (rotation.overrides ?? []).map(presentOverride),
      addDays(today, -currentShiftWindow),
      addDays(today, currentShiftWindow)
    )
  );
  const shift = shifts.find(
    (s) => s.startDate <= today && s.endDate >= today
  );
  return shift?.userId ? shift : null;
}
