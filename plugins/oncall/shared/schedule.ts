import { addDays, daysBetween } from "./dates";
import type {
  DateString,
  MembershipChange,
  OverrideRange,
  RotationSegment,
  ScheduleDay,
  ScheduleShift,
} from "./types";

/**
 * Returns a copy of the segments ordered by effective date.
 *
 * @param segments the segments of a rotation.
 * @returns the ordered segments.
 */
export function sortSegments(segments: RotationSegment[]): RotationSegment[] {
  return segments
    .map((segment) => ({ ...segment, memberIds: [...segment.memberIds] }))
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
}

/**
 * Returns the segment in effect on a date.
 *
 * @param segments the segments of a rotation, ordered by effective date.
 * @param date the date.
 * @returns the segment and its index, or undefined if the rotation has not started.
 */
export function getSegmentAt(
  segments: RotationSegment[],
  date: DateString
): { segment: RotationSegment; index: number } | undefined {
  for (let index = segments.length - 1; index >= 0; index--) {
    if (segments[index].effectiveDate <= date) {
      return { segment: segments[index], index };
    }
  }
  return undefined;
}

/**
 * Resolves the user on call for a rotation on a date, ignoring overrides.
 *
 * @param segments the segments of a rotation.
 * @param date the date.
 * @returns the id of the user on call, or null if nobody is.
 */
export function resolveRotationUser(
  segments: RotationSegment[],
  date: DateString
): string | null {
  const found = getSegmentAt(sortSegments(segments), date);
  if (!found) {
    return null;
  }
  return memberAt(found.segment, shiftIndexAt(found.segment, date, "floor"));
}

/**
 * Resolves the user on call for a single day, taking overrides into account.
 *
 * @param segments the segments of a rotation.
 * @param overrides the overrides of the rotation.
 * @param date the date.
 * @returns the resolved day.
 */
export function resolveDay(
  segments: RotationSegment[],
  overrides: OverrideRange[],
  date: DateString
): ScheduleDay {
  return resolveSchedule(segments, overrides, date, date)[0];
}

/**
 * Resolves the user on call for every day in a range, taking overrides into
 * account.
 *
 * @param segments the segments of a rotation.
 * @param overrides the overrides of the rotation.
 * @param startDate the first day of the range.
 * @param endDate the last day of the range, inclusive.
 * @returns one entry per day in the range.
 */
export function resolveSchedule(
  segments: RotationSegment[],
  overrides: OverrideRange[],
  startDate: DateString,
  endDate: DateString
): ScheduleDay[] {
  const sorted = sortSegments(segments);
  const days: ScheduleDay[] = [];
  const length = daysBetween(startDate, endDate);

  for (let offset = 0; offset <= length; offset++) {
    const date = addDays(startDate, offset);
    const override = findOverride(overrides, date);
    if (override) {
      days.push({ date, userId: override.userId, overrideId: override.id });
      continue;
    }

    const found = getSegmentAt(sorted, date);
    days.push({
      date,
      userId: found
        ? memberAt(found.segment, shiftIndexAt(found.segment, date, "floor"))
        : null,
    });
  }

  return days;
}

/**
 * Groups consecutive days with the same user and override into shifts.
 *
 * @param days the resolved days, ordered by date.
 * @returns the shifts.
 */
export function groupShifts(days: ScheduleDay[]): ScheduleShift[] {
  const shifts: ScheduleShift[] = [];

  for (const day of days) {
    const last = shifts[shifts.length - 1];
    if (
      last &&
      last.userId === day.userId &&
      last.overrideId === day.overrideId &&
      addDays(last.endDate, 1) === day.date
    ) {
      last.endDate = day.date;
      continue;
    }

    shifts.push({
      startDate: day.date,
      endDate: day.date,
      userId: day.userId,
      ...(day.overrideId ? { overrideId: day.overrideId } : {}),
    });
  }

  return shifts;
}

/**
 * Returns the rotation shift that contains a date, ignoring overrides.
 *
 * @param segments the segments of a rotation.
 * @param date the date.
 * @returns the first and last day of the shift, or undefined if the rotation has not started.
 */
export function getShiftRange(
  segments: RotationSegment[],
  date: DateString
): { startDate: DateString; endDate: DateString } | undefined {
  const sorted = sortSegments(segments);
  const found = getSegmentAt(sorted, date);
  if (!found) {
    return undefined;
  }

  const { segment, index } = found;
  const shift = Math.floor(
    daysBetween(segment.effectiveDate, date) / segment.shiftLengthDays
  );
  const startDate = addDays(
    segment.effectiveDate,
    shift * segment.shiftLengthDays
  );
  let endDate = addDays(startDate, segment.shiftLengthDays - 1);
  const next = sorted[index + 1];
  if (next && next.effectiveDate <= endDate) {
    endDate = addDays(next.effectiveDate, -1);
  }

  return { startDate, endDate };
}

/**
 * Returns the first shift boundary on or after a date.
 *
 * @param segments the segments of a rotation.
 * @param date the date.
 * @returns the boundary.
 */
export function getNextBoundary(
  segments: RotationSegment[],
  date: DateString
): DateString {
  const sorted = sortSegments(segments);
  if (!sorted.length) {
    return date;
  }
  if (date <= sorted[0].effectiveDate) {
    return sorted[0].effectiveDate;
  }

  const range = getShiftRange(sorted, date);
  if (range && range.startDate === date) {
    return date;
  }
  return range ? addDays(range.endDate, 1) : date;
}

/**
 * Returns the date from which a change to a rotation can take effect. The
 * change is snapped to a shift boundary that is on or after the requested
 * date and after the shift in progress, so current and past shifts never
 * change.
 *
 * @param segments the segments of a rotation.
 * @param requestedDate the date the change was requested for.
 * @param today the current date in the calendar's timezone.
 * @returns the effective date of the change.
 */
export function getChangeBoundary(
  segments: RotationSegment[],
  requestedDate: DateString,
  today: DateString
): DateString {
  const current = getShiftRange(segments, today);
  const earliest = current ? addDays(current.endDate, 1) : today;
  return getNextBoundary(
    segments,
    requestedDate > earliest ? requestedDate : earliest
  );
}

/**
 * Applies a change to the members of a rotation from a shift boundary onward.
 * Segments before the boundary are untouched. Whoever would have been on call
 * at the start of each changed segment stays on call; if they were removed,
 * the next remaining person in the previous order is on call instead.
 *
 * @param segments the segments of a rotation.
 * @param change the change to apply.
 * @param boundary the shift boundary the change takes effect from.
 * @param shiftLengthDays the shift length to use if the rotation has no segments.
 * @returns the new segments.
 */
export function applyMembershipChange(
  segments: RotationSegment[],
  change: MembershipChange,
  boundary: DateString,
  shiftLengthDays: number
): RotationSegment[] {
  const result = sortSegments(segments);
  if (!result.length) {
    return [
      {
        effectiveDate: boundary,
        memberIds: applyDelta([], change),
        startIndex: 0,
        shiftLengthDays,
      },
    ];
  }

  const covering = getSegmentAt(result, boundary);
  if (!covering) {
    throw new Error("Changes cannot take effect before the rotation starts");
  }

  if (covering.segment.effectiveDate !== boundary) {
    result.splice(covering.index + 1, 0, {
      ...covering.segment,
      memberIds: [...covering.segment.memberIds],
      effectiveDate: boundary,
    });
  }

  const firstOriginal = { ...result[0], memberIds: [...result[0].memberIds] };
  for (const segment of result) {
    if (segment.effectiveDate >= boundary) {
      segment.memberIds = applyDelta(segment.memberIds, change);
    }
  }

  return rebuildStartIndexes(result, boundary, firstOriginal);
}

/**
 * Changes the shift length of a rotation from a date onward. Later segments
 * are moved to the next boundary of the new shift grid.
 *
 * @param segments the segments of a rotation.
 * @param boundary the date the new shift length takes effect from.
 * @param shiftLengthDays the new number of days in each shift.
 * @returns the new segments.
 */
export function applyScheduleChange(
  segments: RotationSegment[],
  boundary: DateString,
  shiftLengthDays: number
): RotationSegment[] {
  const sorted = sortSegments(segments);
  const before = sorted.filter((s) => s.effectiveDate < boundary);
  const later = sorted.filter((s) => s.effectiveDate >= boundary);
  const startSegment =
    later[0]?.effectiveDate === boundary ? later.shift() : undefined;
  const base = startSegment ?? before[before.length - 1] ?? later.shift();
  if (!base) {
    return [];
  }

  const result: RotationSegment[] = [
    ...before,
    {
      ...base,
      memberIds: [...base.memberIds],
      effectiveDate: boundary,
      shiftLengthDays,
    },
  ];

  for (const segment of later) {
    const shifts = Math.ceil(
      daysBetween(boundary, segment.effectiveDate) / shiftLengthDays
    );
    const effectiveDate = addDays(boundary, shifts * shiftLengthDays);
    const last = result[result.length - 1];
    if (last.effectiveDate === effectiveDate) {
      last.memberIds = [...segment.memberIds];
      continue;
    }
    result.push({ ...segment, effectiveDate, shiftLengthDays });
  }

  return rebuildStartIndexes(
    result,
    boundary,
    before.length ? undefined : base
  );
}

/**
 * Moves the start of a rotation that has not started yet. Segments that would
 * take effect before the new start are collapsed into the first segment.
 *
 * @param segments the segments of a rotation.
 * @param anchor the new first day of the rotation.
 * @param shiftLengthDays the number of days in each shift.
 * @returns the new segments.
 */
export function reanchorRotation(
  segments: RotationSegment[],
  anchor: DateString,
  shiftLengthDays: number
): RotationSegment[] {
  const sorted = sortSegments(segments);
  const before = sorted.filter((s) => s.effectiveDate <= anchor);
  const later = sorted.filter((s) => s.effectiveDate > anchor);
  const first = before[before.length - 1];
  const collapsed = first
    ? [{ ...first, effectiveDate: anchor }, ...later]
    : later;

  return applyScheduleChange(collapsed, anchor, shiftLengthDays);
}

/**
 * Lists upcoming rotation shifts, ignoring overrides.
 *
 * @param segments the segments of a rotation.
 * @param from the date to start from.
 * @param count the number of shifts to return.
 * @returns the shifts.
 */
export function previewShifts(
  segments: RotationSegment[],
  from: DateString,
  count: number
): ScheduleShift[] {
  const sorted = sortSegments(segments);
  const shifts: ScheduleShift[] = [];
  if (!sorted.length) {
    return shifts;
  }

  let date = from < sorted[0].effectiveDate ? sorted[0].effectiveDate : from;
  while (shifts.length < count) {
    const range = getShiftRange(sorted, date);
    if (!range) {
      break;
    }
    shifts.push({
      startDate: date,
      endDate: range.endDate,
      userId: resolveRotationUser(sorted, date),
    });
    date = addDays(range.endDate, 1);
  }

  return shifts;
}

/**
 * Returns the first override that overlaps a date range.
 *
 * @param overrides the overrides to search.
 * @param startDate the first day of the range.
 * @param endDate the last day of the range, inclusive.
 * @returns the overlapping override, if any.
 */
export function findOverlappingOverride<T extends OverrideRange>(
  overrides: T[],
  startDate: DateString,
  endDate: DateString
): T | undefined {
  return overrides.find(
    (override) => override.startDate <= endDate && override.endDate >= startDate
  );
}

function findOverride(
  overrides: OverrideRange[],
  date: DateString
): OverrideRange | undefined {
  return findOverlappingOverride(overrides, date, date);
}

function shiftIndexAt(
  segment: RotationSegment,
  date: DateString,
  rounding: "floor" | "ceil"
): number {
  const shifts =
    daysBetween(segment.effectiveDate, date) / segment.shiftLengthDays;
  return (
    segment.startIndex +
    (rounding === "floor" ? Math.floor(shifts) : Math.ceil(shifts))
  );
}

function memberAt(segment: RotationSegment, index: number): string | null {
  const count = segment.memberIds.length;
  if (!count) {
    return null;
  }
  return segment.memberIds[((index % count) + count) % count];
}

function rotate(memberIds: string[], index: number): string[] {
  const count = memberIds.length;
  if (!count) {
    return [];
  }
  const start = ((index % count) + count) % count;
  return [...memberIds.slice(start), ...memberIds.slice(0, start)];
}

function applyDelta(memberIds: string[], change: MembershipChange): string[] {
  if (change.type === "remove") {
    return memberIds.filter((id) => id !== change.userId);
  }
  if (memberIds.includes(change.userId)) {
    return memberIds;
  }

  const position = Math.min(
    Math.max(change.position ?? memberIds.length, 0),
    memberIds.length
  );
  return [
    ...memberIds.slice(0, position),
    change.userId,
    ...memberIds.slice(position),
  ];
}

/**
 * Recomputes the start index of every segment on or after a date so that the
 * rotation continues from the previous segment.
 */
function rebuildStartIndexes(
  segments: RotationSegment[],
  from: DateString,
  firstOriginal?: RotationSegment
): RotationSegment[] {
  segments.forEach((segment, index) => {
    if (segment.effectiveDate < from) {
      return;
    }

    let order: string[];
    if (index > 0) {
      const previous = segments[index - 1];
      order = rotate(
        previous.memberIds,
        shiftIndexAt(previous, segment.effectiveDate, "ceil")
      );
    } else {
      const original = firstOriginal ?? segment;
      order = rotate(original.memberIds, original.startIndex);
    }

    const next = order.find((id) => segment.memberIds.includes(id));
    segment.startIndex = next ? segment.memberIds.indexOf(next) : 0;
  });

  return segments;
}
