import { useContext, useEffect, useMemo } from "react";
import { WebsocketContext } from "~/components/WebsocketProvider";
import useCurrentUser from "~/hooks/useCurrentUser";
import useStores from "~/hooks/useStores";
import useUserLocale from "~/hooks/useUserLocale";
import type {
  DateString,
  OnCallCalendarData,
  OnCallScheduleData,
  OnCallUpdatePayload,
} from "../shared/types";
import { OnCallUpdateEvent } from "../shared/types";
import { onCallStore, scheduleKey } from "./OnCallStore";

/**
 * Returns a calendar, fetching it if it has not been loaded and keeping it up
 * to date with changes made by other users.
 *
 * @param id the id of the calendar.
 * @returns the calendar and whether it could not be found.
 */
export function useCalendar(id: string): {
  calendar: OnCallCalendarData | undefined;
  notFound: boolean;
} {
  const socket = useContext(WebsocketContext);

  useEffect(() => {
    void onCallStore.fetch(id).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleUpdate = (payload: OnCallUpdatePayload) => {
      if (payload.calendarId === id) {
        void onCallStore.refresh(id).catch(() => undefined);
      }
    };

    socket.on(OnCallUpdateEvent, handleUpdate);
    return () => {
      socket.off(OnCallUpdateEvent, handleUpdate);
    };
  }, [socket, id]);

  return {
    calendar: onCallStore.calendars.get(id),
    notFound: onCallStore.notFound.has(id),
  };
}

/**
 * Returns the resolved schedule of a calendar for a date range, fetching it
 * when it is missing from the cache.
 *
 * @param calendarId the id of the calendar.
 * @param startDate the first day of the range.
 * @param endDate the last day of the range, inclusive.
 * @returns the schedule, or undefined while loading.
 */
export function useSchedule(
  calendarId: string,
  startDate: DateString,
  endDate: DateString
): OnCallScheduleData | undefined {
  const schedule = onCallStore.schedules.get(
    scheduleKey(calendarId, startDate, endDate)
  );
  const missing = !schedule;

  useEffect(() => {
    if (missing) {
      void onCallStore
        .fetchSchedule(calendarId, startDate, endDate)
        .catch(() => undefined);
    }
  }, [missing, calendarId, startDate, endDate]);

  return schedule;
}

/**
 * Fetches any users referenced by a calendar that are not loaded yet.
 *
 * @param calendar the calendar.
 * @param schedule an optional schedule with additional users.
 */
export function useCalendarUsers(
  calendar: OnCallCalendarData | undefined,
  schedule?: OnCallScheduleData
) {
  const { users } = useStores();

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    calendar?.rotations.forEach((rotation) => {
      rotation.segments.forEach((segment) =>
        segment.memberIds.forEach((id) => ids.add(id))
      );
      rotation.overrides.forEach((override) => ids.add(override.userId));
    });
    schedule?.overrides.forEach((override) => ids.add(override.userId));
    return [...ids];
  }, [calendar, schedule]);

  useEffect(() => {
    userIds
      .filter((id) => !users.get(id))
      .forEach((id) => {
        void users.fetch(id).catch(() => undefined);
      });
  }, [userIds, users]);
}

/**
 * Returns the current user's locale in BCP 47 form for use with Intl.
 *
 * @returns the locale.
 */
export function useIntlLocale(): string {
  return (useUserLocale() ?? "en-US").replace("_", "-");
}

/**
 * Returns whether the current user can change a calendar.
 *
 * @param calendar the calendar.
 * @returns true if the user is the creator or an admin.
 */
export function useCanEditCalendar(
  calendar: OnCallCalendarData | undefined
): boolean {
  const user = useCurrentUser();
  return (
    !!calendar &&
    !user.isGuest &&
    (calendar.createdById === user.id || user.isAdmin)
  );
}
