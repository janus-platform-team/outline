import copy from "copy-to-clipboard";
import { observer } from "mobx-react";
import {
  BackIcon,
  LinkIcon,
  NextIcon,
  PlusIcon,
  SettingsIcon,
} from "outline-icons";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useParams } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { Action } from "~/components/Actions";
import Button from "~/components/Button";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Empty from "~/components/Empty";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import Notice from "~/components/Notice";
import NudeButton from "~/components/NudeButton";
import PlaceholderDocument from "~/components/PlaceholderDocument";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import type {
  OnCallCalendarData,
  OnCallRotationData,
  ScheduleShift,
} from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { OnCallIcon } from "../Icon";
import { CalendarSettings } from "../components/CalendarSettings";
import { MembersDialog } from "../components/MembersDialog";
import { MonthGrid } from "../components/MonthGrid";
import { OverrideDialog } from "../components/OverrideDialog";
import { RotationForm } from "../components/RotationForm";
import { RotationLegend } from "../components/RotationLegend";
import { ShiftList } from "../components/ShiftList";
import { useCalendar, useCanEditCalendar, useIntlLocale } from "../hooks";
import { addMonths, formatDate, maxDate } from "../utils";

type View = "month" | "list";

/**
 * Returns the URL used to link to and embed a calendar.
 *
 * @param calendarId the id of the calendar.
 * @returns the absolute URL.
 */
export function calendarUrl(calendarId: string) {
  return `${window.location.origin}/oncall/${calendarId}`;
}

function CalendarScene() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { calendar, notFound } = useCalendar(id);

  if (!calendar) {
    return (
      <Scene icon={<OnCallIcon />} title={t("On-call")}>
        {notFound ? (
          <Notice>{t("This calendar could not be found.")}</Notice>
        ) : (
          <PlaceholderDocument />
        )}
      </Scene>
    );
  }

  return <CalendarContent calendar={calendar} />;
}

const CalendarContent = observer(function CalendarContent({
  calendar,
}: {
  calendar: OnCallCalendarData;
}) {
  const { t } = useTranslation();
  const history = useHistory();
  const { dialogs } = useStores();
  const locale = useIntlLocale();
  const canEdit = useCanEditCalendar(calendar);
  const [view, setView] = useState<View>("month");
  const [month, setMonth] = useState(() => addMonths(calendar.today, 0));
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  const visibleRotations = useMemo(
    () => calendar.rotations.filter((rotation) => !hiddenIds.has(rotation.id)),
    [calendar.rotations, hiddenIds]
  );

  const handleToggle = useCallback((rotationId: string) => {
    setHiddenIds((previous) => {
      const next = new Set(previous);
      if (next.has(rotationId)) {
        next.delete(rotationId);
      } else {
        next.add(rotationId);
      }
      return next;
    });
  }, []);

  const handleCopyLink = useCallback(() => {
    copy(calendarUrl(calendar.id));
    toast.success(t("Link copied, paste it into a document to embed"));
  }, [calendar.id, t]);

  const handleSettings = useCallback(() => {
    dialogs.openModal({
      title: t("Calendar settings"),
      content: (
        <CalendarSettings
          calendar={calendar}
          onSubmit={dialogs.closeAllModals}
          onDelete={() => {
            dialogs.closeAllModals();
            history.push("/oncall");
          }}
        />
      ),
    });
  }, [calendar, dialogs, history, t]);

  const handleNewRotation = useCallback(() => {
    dialogs.openModal({
      title: t("New rotation"),
      content: (
        <RotationForm calendar={calendar} onSubmit={dialogs.closeAllModals} />
      ),
    });
  }, [calendar, dialogs, t]);

  const handleEditRotation = useCallback(
    (rotation: OnCallRotationData) => {
      dialogs.openModal({
        title: t("Edit rotation"),
        content: (
          <RotationForm
            calendar={calendar}
            rotation={rotation}
            onSubmit={dialogs.closeAllModals}
          />
        ),
      });
    },
    [calendar, dialogs, t]
  );

  const handleMembers = useCallback(
    (rotation: OnCallRotationData) => {
      dialogs.openModal({
        title: t("{{ name }} – members", { name: rotation.name }),
        content: (
          <MembersDialog
            calendarId={calendar.id}
            rotationId={rotation.id}
            onDone={dialogs.closeAllModals}
          />
        ),
      });
    },
    [calendar.id, dialogs, t]
  );

  const openOverride = useCallback(
    (
      rotation: OnCallRotationData,
      options: { overrideId?: string; startDate?: string; endDate?: string }
    ) => {
      dialogs.openModal({
        title: t("Override – {{ name }}", { name: rotation.name }),
        content: (
          <OverrideDialog
            calendar={calendar}
            rotation={rotation}
            overrideId={options.overrideId}
            initialStartDate={options.startDate}
            initialEndDate={options.endDate}
            onDone={dialogs.closeAllModals}
          />
        ),
      });
    },
    [calendar, dialogs, t]
  );

  const handleOverride = useCallback(
    (rotation: OnCallRotationData) => openOverride(rotation, {}),
    [openOverride]
  );

  const handleSelectShift = useCallback(
    (rotation: OnCallRotationData, shift: ScheduleShift) => {
      if (shift.overrideId) {
        openOverride(rotation, { overrideId: shift.overrideId });
        return;
      }
      const startDate = maxDate(shift.startDate, calendar.today);
      openOverride(rotation, {
        startDate,
        endDate: maxDate(shift.endDate, startDate),
      });
    },
    [calendar.today, openOverride]
  );

  const handleDeleteRotation = useCallback(
    (rotation: OnCallRotationData) => {
      dialogs.openModal({
        title: t("Delete rotation"),
        content: (
          <ConfirmationDialog
            danger
            submitText={t("Delete")}
            onSubmit={async () => {
              await onCallStore.deleteRotation(calendar.id, rotation.id);
            }}
          >
            {t(
              "Are you sure you want to delete the rotation “{{ name }}”? Its schedule and overrides will be removed.",
              { name: rotation.name }
            )}
          </ConfirmationDialog>
        ),
      });
    },
    [calendar.id, dialogs, t]
  );

  return (
    <Scene
      icon={<OnCallIcon />}
      title={calendar.name}
      textTitle={calendar.name}
      wide
      actions={
        <>
          <Action>
            <Button neutral icon={<LinkIcon />} onClick={handleCopyLink}>
              {t("Copy embed link")}
            </Button>
          </Action>
          {canEdit && (
            <>
              <Action>
                <Button
                  neutral
                  icon={<SettingsIcon />}
                  onClick={handleSettings}
                >
                  {t("Settings")}
                </Button>
              </Action>
              <Action>
                <Button icon={<PlusIcon />} onClick={handleNewRotation}>
                  {t("New rotation")}
                </Button>
              </Action>
            </>
          )}
        </>
      }
    >
      <Heading>{calendar.name}</Heading>
      {calendar.description && (
        <Text as="p" type="secondary">
          {calendar.description}
        </Text>
      )}
      {calendar.rotations.length === 0 ? (
        <Empty>
          {canEdit
            ? t("Add a rotation to start scheduling who is on call.")
            : t("This calendar has no rotations yet.")}
        </Empty>
      ) : (
        <>
          <RotationLegend
            rotations={calendar.rotations}
            hiddenIds={hiddenIds}
            onToggle={handleToggle}
            canEdit={canEdit}
            onEdit={handleEditRotation}
            onMembers={handleMembers}
            onOverride={handleOverride}
            onDelete={handleDeleteRotation}
          />
          <Toolbar align="center" justify="space-between" gap={8}>
            <Flex align="center" gap={4}>
              {view === "month" && (
                <>
                  <NudeButton
                    aria-label={t("Previous month")}
                    onClick={() => setMonth(addMonths(month, -1))}
                  >
                    <BackIcon />
                  </NudeButton>
                  <MonthTitle>
                    {formatDate(month, locale, {
                      month: "long",
                      year: "numeric",
                    })}
                  </MonthTitle>
                  <NudeButton
                    aria-label={t("Next month")}
                    onClick={() => setMonth(addMonths(month, 1))}
                  >
                    <NextIcon />
                  </NudeButton>
                  <Button
                    neutral
                    onClick={() => setMonth(addMonths(calendar.today, 0))}
                  >
                    {t("Today")}
                  </Button>
                </>
              )}
            </Flex>
            <Segmented role="radiogroup" aria-label={t("View")}>
              <SegmentButton
                role="radio"
                aria-checked={view === "month"}
                $active={view === "month"}
                onClick={() => setView("month")}
              >
                {t("Month")}
              </SegmentButton>
              <SegmentButton
                role="radio"
                aria-checked={view === "list"}
                $active={view === "list"}
                onClick={() => setView("list")}
              >
                {t("List")}
              </SegmentButton>
            </Segmented>
          </Toolbar>
          {view === "month" ? (
            <MonthGrid
              calendar={calendar}
              month={month}
              rotations={visibleRotations}
              onSelectShift={canEdit ? handleSelectShift : undefined}
            />
          ) : (
            <ShiftList
              calendar={calendar}
              rotations={visibleRotations}
              onSelectShift={canEdit ? handleSelectShift : undefined}
            />
          )}
          <Text as="p" type="tertiary" size="small">
            {t(
              "Times are shown in {{ timezone }}. Shifts change at midnight.",
              {
                timezone: calendar.timezone,
              }
            )}
          </Text>
        </>
      )}
    </Scene>
  );
});

const Toolbar = styled(Flex)`
  margin: 8px 0 12px;
`;

const MonthTitle = styled.span`
  font-weight: 600;
  min-width: 140px;
  text-align: center;
`;

const Segmented = styled.div`
  display: inline-flex;
  border: 1px solid ${s("inputBorder")};
  border-radius: 6px;
  overflow: hidden;
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  font: inherit;
  font-size: 14px;
  padding: 4px 12px;
  border: 0;
  cursor: pointer;
  color: ${(props) => (props.$active ? props.theme.white : props.theme.text)};
  background: ${(props) =>
    props.$active ? props.theme.accent : props.theme.background};
`;

export default observer(CalendarScene);
