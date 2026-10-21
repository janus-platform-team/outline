import { observer } from "mobx-react";
import { memo } from "react";
import styled, { css } from "styled-components";
import { s } from "@shared/styles";
import type {
  DateString,
  OnCallRotationData,
  ScheduleShift,
} from "../../shared/types";
import { daysBetween } from "../../shared/dates";
import { maxDate, minDate } from "../utils";
import { UserLabel } from "./UserLabel";

interface Props {
  /** The seven days of the week. */
  days: DateString[];
  /** The rotations to show a lane for. */
  rotations: OnCallRotationData[];
  /** The shifts of each rotation, keyed by rotation id. */
  shifts: Map<string, ScheduleShift[]>;
  /** The current date in the calendar's timezone. */
  today: DateString;
  /** The month being displayed, days outside of it are dimmed. */
  month?: string;
  /** Whether to hide the day numbers. */
  hideDayNumbers?: boolean;
  /** Called when a shift is clicked. */
  onSelectShift?: (rotation: OnCallRotationData, shift: ScheduleShift) => void;
}

/**
 * A week of the calendar with a lane of shifts for each rotation.
 */
function WeekRowComponent({
  days,
  rotations,
  shifts,
  today,
  month,
  hideDayNumbers,
  onSelectShift,
}: Props) {
  const weekStart = days[0];
  const weekEnd = days[days.length - 1];

  return (
    <Week>
      <Background aria-hidden>
        {days.map((day) => (
          <DayBackground
            key={day}
            $today={day === today}
            $outside={!!month && !day.startsWith(month)}
          />
        ))}
      </Background>
      {!hideDayNumbers && (
        <Lane>
          {days.map((day) => (
            <DayNumber
              key={day}
              $today={day === today}
              $outside={!!month && !day.startsWith(month)}
            >
              {Number(day.slice(8))}
            </DayNumber>
          ))}
        </Lane>
      )}
      {rotations.map((rotation) => (
        <Lane key={rotation.id}>
          {(shifts.get(rotation.id) ?? [])
            .filter(
              (shift) =>
                shift.userId &&
                shift.startDate <= weekEnd &&
                shift.endDate >= weekStart
            )
            .map((shift) => {
              const start = maxDate(shift.startDate, weekStart);
              const end = minDate(shift.endDate, weekEnd);
              const column = daysBetween(weekStart, start) + 1;
              const span = daysBetween(start, end) + 1;

              return (
                <Bar
                  key={`${shift.startDate}-${shift.overrideId ?? ""}`}
                  type="button"
                  $color={rotation.color}
                  $override={!!shift.overrideId}
                  $continuesBefore={shift.startDate < weekStart}
                  $continuesAfter={shift.endDate > weekEnd}
                  style={{ gridColumn: `${column} / span ${span}` }}
                  onClick={
                    onSelectShift
                      ? () => onSelectShift(rotation, shift)
                      : undefined
                  }
                  disabled={!onSelectShift}
                  title={rotation.name}
                >
                  <UserLabel userId={shift.userId} />
                </Bar>
              );
            })}
        </Lane>
      ))}
    </Week>
  );
}

export const WeekRow = memo(observer(WeekRowComponent));

const Week = styled.div`
  position: relative;
  padding-bottom: 6px;
  min-height: 56px;
  border-bottom: 1px solid ${s("divider")};
`;

const Background = styled.div`
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  pointer-events: none;
`;

const DayBackground = styled.div<{ $today: boolean; $outside: boolean }>`
  border-inline-start: 1px solid ${s("divider")};

  &:first-child {
    border-inline-start: 0;
  }

  ${(props) =>
    props.$outside &&
    css`
      background: ${s("backgroundSecondary")};
    `}

  ${(props) =>
    props.$today &&
    css`
      background: ${props.theme.accent}14;
    `}
`;

const Lane = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0 2px;
  padding: 2px 2px 0;
  min-height: 24px;
`;

const DayNumber = styled.div<{ $today: boolean; $outside: boolean }>`
  font-size: 12px;
  font-weight: ${(props) => (props.$today ? 600 : 400)};
  color: ${(props) =>
    props.$today
      ? props.theme.accent
      : props.$outside
        ? props.theme.textTertiary
        : props.theme.textSecondary};
  padding: 2px 4px;
`;

const Bar = styled.button<{
  $color: string;
  $override: boolean;
  $continuesBefore: boolean;
  $continuesAfter: boolean;
}>`
  display: flex;
  align-items: center;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  text-align: start;
  color: ${s("text")};
  background: ${(props) => `${props.$color}26`};
  border: 1px ${(props) => (props.$override ? "dashed" : "solid")}
    ${(props) => props.$color};
  border-inline-start-width: 3px;
  border-radius: 4px;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};
  overflow: hidden;

  ${(props) =>
    props.$continuesBefore &&
    css`
      border-start-start-radius: 0;
      border-end-start-radius: 0;
      border-inline-start-width: 1px;
    `}

  ${(props) =>
    props.$continuesAfter &&
    css`
      border-start-end-radius: 0;
      border-end-end-radius: 0;
    `}

  &:not(:disabled):hover {
    background: ${(props) => `${props.$color}40`};
  }
`;
