import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import Badge from "~/components/Badge";
import Text from "~/components/Text";
import type {
  OnCallCalendarData,
  OnCallRotationData,
  ScheduleShift,
} from "../../shared/types";
import { useCalendarUsers, useIntlLocale, useSchedule } from "../hooks";
import { addDays, formatDateRange } from "../utils";
import { useShiftMap } from "./MonthGrid";
import { RotationDot } from "./RotationLegend";
import { UserLabel } from "./UserLabel";

/** The number of days shown in the list view. */
const listDays = 56;

interface Props {
  /** The calendar to display. */
  calendar: OnCallCalendarData;
  /** The rotations to display. */
  rotations: OnCallRotationData[];
  /** Called when a shift is clicked. */
  onSelectShift?: (rotation: OnCallRotationData, shift: ScheduleShift) => void;
}

/**
 * A list of the upcoming shifts of each rotation.
 */
export const ShiftList = observer(function ShiftList({
  calendar,
  rotations,
  onSelectShift,
}: Props) {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const schedule = useSchedule(
    calendar.id,
    calendar.today,
    addDays(calendar.today, listDays - 1)
  );
  const shifts = useShiftMap(schedule);
  useCalendarUsers(calendar, schedule);

  return (
    <div aria-busy={!schedule}>
      {rotations.map((rotation) => (
        <Section key={rotation.id}>
          <SectionTitle>
            <RotationDot $color={rotation.color} />
            {rotation.name}
          </SectionTitle>
          <List>
            {(shifts.get(rotation.id) ?? [])
              .filter((shift) => shift.userId)
              .map((shift) => (
                <li key={`${shift.startDate}-${shift.overrideId ?? ""}`}>
                  <Row
                    type="button"
                    disabled={!onSelectShift}
                    onClick={
                      onSelectShift
                        ? () => onSelectShift(rotation, shift)
                        : undefined
                    }
                  >
                    <Text type="secondary" size="small">
                      {formatDateRange(shift.startDate, shift.endDate, locale)}
                    </Text>
                    <UserLabel userId={shift.userId} />
                    {shift.overrideId && <Badge>{t("Override")}</Badge>}
                  </Row>
                </li>
              ))}
          </List>
        </Section>
      ))}
    </div>
  );
});

const Section = styled.section`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  margin: 0 0 8px;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  overflow: hidden;

  li + li {
    border-top: 1px solid ${s("divider")};
  }
`;

const Row = styled.button`
  display: grid;
  grid-template-columns: 140px 1fr auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 12px;
  font: inherit;
  text-align: start;
  color: ${s("text")};
  background: none;
  border: 0;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  &:not(:disabled):hover {
    background: ${s("listItemHoverBackground")};
  }
`;
