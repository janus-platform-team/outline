/** A date without time in the form YYYY-MM-DD. */
export type DateString = string;

/** A period of a rotation during which the members and shift length are fixed. */
export interface RotationSegment {
  /** The first day the segment applies, always a shift boundary. */
  effectiveDate: DateString;
  /** The ordered ids of the users in the rotation. */
  memberIds: string[];
  /** The index into memberIds of the user on call for the first shift. */
  startIndex: number;
  /** The number of days in each shift. */
  shiftLengthDays: number;
}

/** A date range during which a specific user replaces the rotation. */
export interface OverrideRange {
  /** The id of the override. */
  id: string;
  /** The id of the user on call during the override. */
  userId: string;
  /** The first day of the override. */
  startDate: DateString;
  /** The last day of the override, inclusive. */
  endDate: DateString;
}

/** The resolved on-call user for a single day. */
export interface ScheduleDay {
  /** The day. */
  date: DateString;
  /** The id of the user on call, or null if nobody is. */
  userId: string | null;
  /** The id of the override that applies, if any. */
  overrideId?: string;
}

/** A run of consecutive days with the same on-call user. */
export interface ScheduleShift {
  /** The first day of the shift. */
  startDate: DateString;
  /** The last day of the shift, inclusive. */
  endDate: DateString;
  /** The id of the user on call, or null if nobody is. */
  userId: string | null;
  /** The id of the override that applies, if any. */
  overrideId?: string;
}

/** A change to the members of a rotation. */
export type MembershipChange =
  | {
      type: "add";
      userId: string;
      /** The position to insert the user at, defaults to the end. */
      position?: number;
    }
  | { type: "remove"; userId: string };

/** The socket event emitted to team members when a calendar changes. */
export const OnCallUpdateEvent = "oncall.update";

/** The payload of the socket event emitted when a calendar changes. */
export interface OnCallUpdatePayload {
  /** The id of the calendar that changed, or null if it was deleted. */
  calendarId: string;
}

/** The colors available for rotations. */
export const RotationColors = [
  "#0366d6",
  "#2da44e",
  "#bf3989",
  "#d4a72c",
  "#8250df",
  "#e16f24",
];

/** Validation limits shared between the client and server. */
export const OnCallValidation = {
  maxNameLength: 255,
  maxDescriptionLength: 1000,
  maxReasonLength: 255,
  maxShiftLengthDays: 365,
  maxMembers: 100,
  maxScheduleDays: 120,
  maxRotations: 20,
};
