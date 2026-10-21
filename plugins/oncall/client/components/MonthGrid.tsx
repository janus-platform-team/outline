import { observer } from "mobx-react";
import { useMemo } from "react";
import styled from "styled-components";
import { s } from "@shared/styles";
import type {
  DateString,
  OnCallCalendarData,
  OnCallRotationData,
  OnCallScheduleData,
  ScheduleShift,
} from "../../shared/types";
import { useCalendarUsers, useIntlLocale, useSchedule } from "../hooks";
import { getMonthWeeks, getWeekdayNames, getWeekStartsOn } from "../utils";
import { WeekRow } from "./WeekRow";

interface Props {
  /** The calendar to display. */
  calendar: OnCallCalendarData;
  /** The first day of the month to display. */
  month: DateString;
  /** The rotations to display. */
  rotations: OnCallRotationData[];
  /** Called when a shift is clicked. */
  onSelectShift?: (rotation: OnCallRotationData, shift: ScheduleShift) => void;
}

/**
 * A month view of the shifts of a calendar.
 */
export const MonthGrid = observer(function MonthGrid({
  calendar,
  month,
  rotations,
  onSelectShift,
}: Props) {
  const locale = useIntlLocale();
  const weekStartsOn = getWeekStartsOn(calendar);
  const weeks = useMemo(
    () => getMonthWeeks(month, weekStartsOn),
    [month, weekStartsOn]
  );
  const startDate = weeks[0][0];
  const endDate = weeks[weeks.length - 1][6];
  const schedule = useSchedule(calendar.id, startDate, endDate);
  const shifts = useShiftMap(schedule);
  useCalendarUsers(calendar, schedule);

  return (
    <Grid role="grid" aria-busy={!schedule}>
      <Header role="row">
        {getWeekdayNames(locale, weekStartsOn).map((name) => (
          <Weekday key={name} role="columnheader">
            {name}
          </Weekday>
        ))}
      </Header>
      {weeks.map((days) => (
        <WeekRow
          key={days[0]}
          days={days}
          rotations={rotations}
          shifts={shifts}
          today={calendar.today}
          month={month.slice(0, 7)}
          onSelectShift={onSelectShift}
        />
      ))}
    </Grid>
  );
});

/**
 * Returns the shifts of a schedule keyed by rotation id.
 *
 * @param schedule the schedule, if loaded.
 * @returns the shifts by rotation.
 */
export function useShiftMap(schedule: OnCallScheduleData | undefined) {
  return useMemo(
    () =>
      new Map(
        (schedule?.rotations ?? []).map((rotation) => [
          rotation.rotationId,
          rotation.shifts,
        ])
      ),
    [schedule]
  );
}

const Grid = styled.div`
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  overflow: hidden;
`;

const Header = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid ${s("divider")};
  background: ${s("backgroundSecondary")};
`;

const Weekday = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: ${s("textSecondary")};
  padding: 6px 8px;
`;
