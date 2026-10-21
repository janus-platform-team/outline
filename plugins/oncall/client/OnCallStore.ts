import { computed, makeObservable, observable, runInAction } from "mobx";
import { client } from "~/utils/ApiClient";
import { AuthorizationError, NotFoundError } from "~/utils/errors";
import type {
  DateString,
  OnCallCalendarData,
  OnCallMembershipResult,
  OnCallOverrideData,
  OnCallRotationData,
  OnCallScheduleData,
} from "../shared/types";

interface CalendarParams {
  name?: string;
  description?: string | null;
  timezone?: string;
  notifyHour?: number;
  slackWebhookUrl?: string | null;
}

interface RotationParams {
  name?: string;
  color?: string;
  startDate?: DateString;
  startDayOfWeek?: number;
  shiftLengthDays?: number;
  notifyOnChange?: boolean;
  memberIds?: string[];
}

interface MembershipParams {
  /** The id of the rotation. */
  id: string;
  /** The id of the user to add or remove. */
  userId: string;
  /** The requested date the change takes effect from. */
  effectiveDate: DateString;
  /** The position to add the user at, defaults to the end. */
  position?: number;
  /** Whether to only preview the change. */
  preview?: boolean;
}

interface OverrideParams {
  rotationId: string;
  userId: string;
  startDate: DateString;
  endDate: DateString;
  reason?: string | null;
}

type RequestBody = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

/**
 * Returns the key a schedule is cached under.
 *
 * @param calendarId the id of the calendar.
 * @param startDate the first day of the schedule.
 * @param endDate the last day of the schedule.
 * @returns the cache key.
 */
export function scheduleKey(
  calendarId: string,
  startDate: DateString,
  endDate: DateString
) {
  return `${calendarId}:${startDate}:${endDate}`;
}

/**
 * Client state for on-call calendars. Kept outside of the root store so that
 * the plugin remains self-contained.
 */
export class OnCallStore {
  /** Calendars that have been loaded, keyed by id. */
  calendars = observable.map<string, OnCallCalendarData>();

  /** Resolved schedules, keyed by calendar id and date range. */
  schedules = observable.map<string, OnCallScheduleData>();

  /** Ids of calendars that could not be found, keyed by id. */
  notFound = observable.map<string, boolean>();

  /** Whether the list has been fetched at least once. */
  isLoaded = false;

  constructor() {
    makeObservable(this, {
      isLoaded: observable,
      orderedCalendars: computed,
    });
  }

  /** Calendars ordered by name. */
  get orderedCalendars(): OnCallCalendarData[] {
    return Array.from(this.calendars.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Fetches the calendars of the current team.
   */
  fetchList = async () => {
    const res = await client.post<{ data: OnCallCalendarData[] }>(
      "/oncallCalendars.list",
      { limit: 100 }
    );

    runInAction(() => {
      res.data.forEach((calendar) => this.calendars.set(calendar.id, calendar));
      this.isLoaded = true;
    });
  };

  /**
   * Fetches a calendar.
   *
   * @param id the id of the calendar.
   * @returns the calendar.
   */
  fetch = async (id: string) => {
    try {
      const res = await client.post<{ data: OnCallCalendarData }>(
        "/oncallCalendars.info",
        { id }
      );
      this.setCalendar(res.data);
      return res.data;
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof AuthorizationError) {
        runInAction(() => {
          this.calendars.delete(id);
          this.notFound.set(id, true);
        });
      }
      throw err;
    }
  };

  /**
   * Refetches a calendar and discards its cached schedules.
   *
   * @param id the id of the calendar.
   */
  refresh = async (id: string) => {
    this.invalidateSchedules(id);
    await this.fetch(id);
  };

  /**
   * Fetches the resolved schedule of a calendar for a date range.
   *
   * @param id the id of the calendar.
   * @param startDate the first day of the range.
   * @param endDate the last day of the range, inclusive.
   * @returns the schedule.
   */
  fetchSchedule = async (
    id: string,
    startDate: DateString,
    endDate: DateString
  ) => {
    const key = scheduleKey(id, startDate, endDate);
    const existing = this.inflight.get(key);
    if (existing) {
      return existing;
    }

    const request = client
      .post<{ data: OnCallScheduleData }>("/oncallCalendars.schedule", {
        id,
        startDate,
        endDate,
      })
      .then((res) => {
        runInAction(() => this.schedules.set(key, res.data));
        return res.data;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, request);
    return request;
  };

  /**
   * Creates a calendar.
   *
   * @param params the calendar attributes.
   * @returns the created calendar.
   */
  create = async (params: CalendarParams & { name: string }) => {
    const res = await client.post<{ data: OnCallCalendarData }>(
      "/oncallCalendars.create",
      { ...params }
    );
    this.setCalendar(res.data);
    return res.data;
  };

  /**
   * Updates a calendar.
   *
   * @param id the id of the calendar.
   * @param params the attributes to change.
   * @returns the updated calendar.
   */
  update = async (id: string, params: CalendarParams) => {
    const res = await client.post<{ data: OnCallCalendarData }>(
      "/oncallCalendars.update",
      { id, ...params }
    );
    this.invalidateSchedules(id);
    this.setCalendar(res.data);
    return res.data;
  };

  /**
   * Deletes a calendar.
   *
   * @param id the id of the calendar.
   */
  delete = async (id: string) => {
    await client.post("/oncallCalendars.delete", { id });
    runInAction(() => this.calendars.delete(id));
    this.invalidateSchedules(id);
  };

  /**
   * Sends a test message to the calendar's Slack webhook.
   *
   * @param id the id of the calendar.
   */
  testNotification = async (id: string) => {
    await client.post("/oncallCalendars.testNotification", { id });
  };

  /**
   * Creates a rotation.
   *
   * @param calendarId the id of the calendar.
   * @param params the rotation attributes.
   * @returns the created rotation.
   */
  createRotation = (calendarId: string, params: RotationParams) =>
    this.mutate<OnCallRotationData>(calendarId, "/oncallRotations.create", {
      calendarId,
      ...params,
    });

  /**
   * Updates a rotation.
   *
   * @param calendarId the id of the calendar.
   * @param id the id of the rotation.
   * @param params the attributes to change.
   * @returns the updated rotation.
   */
  updateRotation = (calendarId: string, id: string, params: RotationParams) =>
    this.mutate<OnCallRotationData>(calendarId, "/oncallRotations.update", {
      id,
      ...params,
    });

  /**
   * Deletes a rotation.
   *
   * @param calendarId the id of the calendar.
   * @param id the id of the rotation.
   */
  deleteRotation = (calendarId: string, id: string) =>
    this.mutate(calendarId, "/oncallRotations.delete", { id });

  /**
   * Adds a member to a rotation from a date onward, or previews doing so.
   *
   * @param calendarId the id of the calendar.
   * @param params the change.
   * @returns the effective date and upcoming shifts.
   */
  addMember = (calendarId: string, params: MembershipParams) =>
    this.changeMembership(calendarId, "/oncallRotations.addMember", params);

  /**
   * Removes a member from a rotation from a date onward, or previews doing so.
   *
   * @param calendarId the id of the calendar.
   * @param params the change.
   * @returns the effective date and upcoming shifts.
   */
  removeMember = (calendarId: string, params: MembershipParams) =>
    this.changeMembership(calendarId, "/oncallRotations.removeMember", {
      ...params,
      position: undefined,
    });

  /**
   * Creates an override.
   *
   * @param calendarId the id of the calendar.
   * @param params the override attributes.
   * @returns the created override.
   */
  createOverride = (calendarId: string, params: OverrideParams) =>
    this.mutate<OnCallOverrideData>(calendarId, "/oncallOverrides.create", {
      ...params,
    });

  /**
   * Deletes an override.
   *
   * @param calendarId the id of the calendar.
   * @param id the id of the override.
   */
  deleteOverride = (calendarId: string, id: string) =>
    this.mutate(calendarId, "/oncallOverrides.delete", { id });

  private inflight = new Map<string, Promise<OnCallScheduleData>>();

  private setCalendar(calendar: OnCallCalendarData) {
    runInAction(() => {
      this.calendars.set(calendar.id, calendar);
      this.notFound.delete(calendar.id);
    });
  }

  private invalidateSchedules(calendarId: string) {
    runInAction(() => {
      Array.from(this.schedules.keys())
        .filter((key) => key.startsWith(`${calendarId}:`))
        .forEach((key) => this.schedules.delete(key));
    });
  }

  private async changeMembership(
    calendarId: string,
    path: string,
    params: MembershipParams
  ) {
    const res = await client.post<{ data: OnCallMembershipResult }>(path, {
      ...params,
    });
    if (!params.preview) {
      await this.refresh(calendarId);
    }
    return res.data;
  }

  private async mutate<T>(calendarId: string, path: string, body: RequestBody) {
    const res = await client.post<{ data: T }>(path, body);
    await this.refresh(calendarId);
    return res.data;
  }
}

export const onCallStore = new OnCallStore();
