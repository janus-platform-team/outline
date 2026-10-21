import { observer } from "mobx-react";
import { PlusIcon } from "outline-icons";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import { Action } from "~/components/Actions";
import Button from "~/components/Button";
import Empty from "~/components/Empty";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import useCurrentUser from "~/hooks/useCurrentUser";
import useStores from "~/hooks/useStores";
import type { OnCallCalendarData } from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { OnCallIcon } from "../Icon";
import { CalendarSettings } from "../components/CalendarSettings";
import { RotationDot } from "../components/RotationLegend";
import { UserLabel } from "../components/UserLabel";
import { useCalendarUsers } from "../hooks";

function CalendarList() {
  const { t } = useTranslation();
  const { dialogs } = useStores();
  const user = useCurrentUser();

  useEffect(() => {
    void onCallStore.fetchList();
  }, []);

  const handleNewCalendar = useCallback(() => {
    dialogs.openModal({
      title: t("New calendar"),
      content: <CalendarSettings onSubmit={dialogs.closeAllModals} />,
    });
  }, [dialogs, t]);

  const calendars = onCallStore.orderedCalendars;

  return (
    <Scene
      icon={<OnCallIcon />}
      title={t("On-call")}
      actions={
        !user.isGuest && (
          <Action>
            <Button icon={<PlusIcon />} onClick={handleNewCalendar}>
              {t("New calendar")}
            </Button>
          </Action>
        )
      }
    >
      <Heading>{t("On-call")}</Heading>
      <Text as="p" type="secondary">
        {t(
          "Plan who is on call with rotations and overrides. Paste a calendar link into any document to embed it."
        )}
      </Text>
      {onCallStore.isLoaded && calendars.length === 0 && (
        <Empty>{t("No calendars yet. Create one to get started.")}</Empty>
      )}
      <List>
        {calendars.map((calendar) => (
          <li key={calendar.id}>
            <CalendarRow calendar={calendar} />
          </li>
        ))}
      </List>
    </Scene>
  );
}

const CalendarRow = observer(function CalendarRow({
  calendar,
}: {
  calendar: OnCallCalendarData;
}) {
  const { t } = useTranslation();
  useCalendarUsers(calendar);
  const onCall = calendar.rotations.filter((rotation) => rotation.currentShift);

  return (
    <Row to={`/oncall/${calendar.id}`}>
      <Flex justify="space-between" align="center" gap={8}>
        <Text weight="bold">{calendar.name}</Text>
        <Text type="tertiary" size="small">
          {t("{{ count }} rotations", { count: calendar.rotations.length })}
          {" · "}
          {calendar.timezone}
        </Text>
      </Flex>
      {onCall.length > 0 && (
        <Flex align="center" gap={16} wrap>
          <Text type="secondary" size="small">
            {t("Now on call")}
          </Text>
          {onCall.map((rotation) => (
            <Flex key={rotation.id} align="center" gap={6}>
              <RotationDot $color={rotation.color} />
              <UserLabel userId={rotation.currentShift?.userId ?? null} />
              <Text type="tertiary" size="small">
                {rotation.name}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </Row>
  );
});

const List = styled.ul`
  list-style: none;
  margin: 24px 0 0;
  padding: 0;
`;

const Row = styled(Link)`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  margin: 0 -12px;
  border-radius: 8px;
  color: ${s("text")};

  &:hover {
    background: ${s("listItemHoverBackground")};
  }
`;

export default observer(CalendarList);
