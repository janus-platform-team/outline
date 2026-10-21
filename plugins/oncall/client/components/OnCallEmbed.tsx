import { observer } from "mobx-react";
import { BackIcon, NextIcon } from "outline-icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled from "styled-components";
import type { EmbedProps } from "@shared/editor/embeds";
import useShare from "@shared/hooks/useShare";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import NudeButton from "~/components/NudeButton";
import Text from "~/components/Text";
import type {
  DateString,
  OnCallCalendarData,
  OnCallRotationData,
} from "../../shared/types";
import {
  useCalendar,
  useCalendarUsers,
  useIntlLocale,
  useSchedule,
} from "../hooks";
import { OnCallIcon } from "../Icon";
import {
  addDays,
  formatDate,
  getWeekDays,
  getWeekdayNames,
  getWeekStartsOn,
  startOfWeek,
} from "../utils";
import { useShiftMap } from "./MonthGrid";
import { RotationDot } from "./RotationLegend";
import { ShiftList } from "./ShiftList";
import { UserLabel } from "./UserLabel";
import { WeekRow } from "./WeekRow";

/**
 * Renders an on-call calendar inline in a document. Public shares cannot
 * access the calendar so they show a link instead.
 */
function OnCallEmbed({ matches, attrs }: EmbedProps) {
  const { isShare } = useShare();
  const calendarId = matches[1];
  const params = useMemo(() => {
    try {
      return new URL(attrs.href).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }, [attrs.href]);

  if (isShare) {
    return <LinkCard href={attrs.href} />;
  }

  return (
    <CalendarEmbed
      calendarId={calendarId}
      view={params.get("view") === "list" ? "list" : "week"}
      rotationId={params.get("rotation")}
    />
  );
}

const LinkCard = ({ href }: { href: string }) => {
  const { t } = useTranslation();
  return (
    <Card>
      <Header>
        <OnCallIcon size={20} />
        <a href={href} target="_blank" rel="noopener noreferrer">
          {t("On-call calendar")}
        </a>
      </Header>
    </Card>
  );
};

const CalendarEmbed = observer(function CalendarEmbed({
  calendarId,
  view,
  rotationId,
}: {
  calendarId: string;
  view: "week" | "list";
  rotationId: string | null;
}) {
  const { t } = useTranslation();
  const { calendar, notFound } = useCalendar(calendarId);

  if (!calendar) {
    return (
      <Card aria-busy={!notFound}>
        <Header>
          <OnCallIcon size={20} />
          <Text type="secondary">
            {notFound
              ? t("This on-call calendar could not be found.")
              : `${t("Loading on-call calendar")}…`}
          </Text>
        </Header>
      </Card>
    );
  }

  return (
    <LoadedCalendarEmbed
      calendar={calendar}
      view={view}
      rotationId={rotationId}
    />
  );
});

const LoadedCalendarEmbed = observer(function LoadedCalendarEmbed({
  calendar,
  view,
  rotationId,
}: {
  calendar: OnCallCalendarData;
  view: "week" | "list";
  rotationId: string | null;
}) {
  const { t } = useTranslation();
  const locale = useIntlLocale();
  const weekStartsOn = getWeekStartsOn(calendar);
  const [selectedWeek, setSelectedWeek] = useState<DateString | null>(null);
  const weekStart = selectedWeek ?? startOfWeek(calendar.today, weekStartsOn);
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const rotations: OnCallRotationData[] = useMemo(
    () =>
      rotationId
        ? calendar.rotations.filter((rotation) => rotation.id === rotationId)
        : calendar.rotations,
    [calendar.rotations, rotationId]
  );

  const schedule = useSchedule(calendar.id, days[0], days[6]);
  const shifts = useShiftMap(schedule);
  useCalendarUsers(calendar, schedule);

  return (
    <Card>
      <Header>
        <OnCallIcon size={20} />
        <Title>{t("{{ name }} – on call", { name: calendar.name })}</Title>
        <OpenLink to={`/oncall/${calendar.id}`}>
          {t("Open calendar")} →
        </OpenLink>
      </Header>
      {rotations.length === 0 ? (
        <Text type="tertiary">{t("This calendar has no rotations yet.")}</Text>
      ) : (
        <>
          <Now>
            <Text type="secondary" size="small">
              {t("Now")}
            </Text>
            {rotations.map((rotation) => (
              <NowItem key={rotation.id}>
                <RotationDot $color={rotation.color} />
                <Text size="small">{rotation.name}</Text>
                {rotation.currentShift ? (
                  <>
                    <UserLabel userId={rotation.currentShift.userId} />
                    <Text type="tertiary" size="small">
                      {t("until {{ date }}", {
                        date: formatDate(rotation.currentShift.endDate, locale),
                      })}
                    </Text>
                  </>
                ) : (
                  <Text type="tertiary" size="small">
                    {t("Nobody")}
                  </Text>
                )}
              </NowItem>
            ))}
          </Now>
          {view === "list" ? (
            <ShiftList calendar={calendar} rotations={rotations} />
          ) : (
            <>
              <Week aria-busy={!schedule}>
                <Weekdays>
                  {getWeekdayNames(locale, weekStartsOn).map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </Weekdays>
                <WeekRow
                  days={days}
                  rotations={rotations}
                  shifts={shifts}
                  today={calendar.today}
                />
              </Week>
              <Footer>
                <NudeButton
                  aria-label={t("Previous week")}
                  onClick={() => setSelectedWeek(addDays(weekStart, -7))}
                >
                  <BackIcon />
                </NudeButton>
                <Button neutral onClick={() => setSelectedWeek(null)}>
                  {t("Today")}
                </Button>
                <NudeButton
                  aria-label={t("Next week")}
                  onClick={() => setSelectedWeek(addDays(weekStart, 7))}
                >
                  <NextIcon />
                </NudeButton>
              </Footer>
            </>
          )}
        </>
      )}
    </Card>
  );
});

export default OnCallEmbed;

const Card = styled.div`
  width: 100%;
  padding: 12px 16px;
  line-height: 1.5;
  white-space: normal;
  user-select: text;
  text-align: start;
  border: 1px solid ${s("divider")};
  border-radius: 8px;
  background: ${s("background")};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const Title = styled.span`
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const OpenLink = styled(Link)`
  font-size: 14px;
  color: ${s("textSecondary")};
  white-space: nowrap;

  &:hover {
    color: ${s("text")};
  }
`;

const Now = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 16px;
  margin-bottom: 12px;
`;

const NowItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Week = styled.div`
  border: 1px solid ${s("divider")};
  border-radius: 6px;
  overflow: hidden;
`;

const Weekdays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 12px;
  font-weight: 500;
  color: ${s("textSecondary")};
  background: ${s("backgroundSecondary")};
  border-bottom: 1px solid ${s("divider")};

  span {
    padding: 4px 8px;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
`;
