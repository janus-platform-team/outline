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

/** An override as returned by the API. */
export interface OnCallOverrideData {
  id: string;
  rotationId: string;
  userId: string;
  startDate: DateString;
  endDate: DateString;
  reason: string | null;
  createdById: string;
}

/** A rotation as returned by the API. */
export interface OnCallRotationData {
  id: string;
  calendarId: string;
  name: string;
  color: string;
  startDate: DateString;
  startDayOfWeek: number;
  shiftLengthDays: number;
  notifyOnChange: boolean;
  index: number;
  /** All segments of the rotation, ordered by effective date. */
  segments: RotationSegment[];
  /** The members in effect today, or on the first day if not started yet. */
  memberIds: string[];
  /** The shift in progress today, including overrides. */
  currentShift: ScheduleShift | null;
  /** Overrides that end today or later. */
  overrides: OnCallOverrideData[];
}

/** A calendar as returned by the API. */
export interface OnCallCalendarData {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  notifyHour: number;
  /** Whether a Slack webhook is configured. The URL itself is never returned. */
  slackConfigured: boolean;
  createdById: string;
  /** The current date in the calendar's timezone. */
  today: DateString;
  createdAt: string;
  updatedAt: string;
  rotations: OnCallRotationData[];
}

/** The resolved schedule of a calendar for a date range. */
export interface OnCallScheduleData {
  calendarId: string;
  startDate: DateString;
  endDate: DateString;
  rotations: { rotationId: string; shifts: ScheduleShift[] }[];
  overrides: OnCallOverrideData[];
}

/** The result of adding or removing a member of a rotation. */
export interface OnCallMembershipResult {
  /** The shift boundary the change takes effect from. */
  effectiveDate: DateString;
  /** The upcoming shifts from the effective date. */
  preview: ScheduleShift[];
  /** The updated rotation, omitted when previewing. */
  rotation?: OnCallRotationData;
}

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
