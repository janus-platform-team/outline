import { observer } from "mobx-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import { LabelText } from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Notice from "~/components/Notice";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import type {
  MembershipChange,
  OnCallMembershipResult,
} from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { useCalendarUsers, useIntlLocale } from "../hooks";
import { formatDate } from "../utils";
import { DateField } from "./DateField";
import { UserLabel } from "./UserLabel";

interface Props {
  /** The id of the calendar. */
  calendarId: string;
  /** The id of the rotation to manage. */
  rotationId: string;
  /** Called when the dialog should close. */
  onDone: () => void;
}

const EndPosition = "end";

const NoMembers: string[] = [];

/**
 * Adds and removes members of a rotation from a date onward, previewing the
 * resulting schedule before applying the change.
 */
export const MembersDialog = observer(function MembersDialog({
  calendarId,
  rotationId,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const locale = useIntlLocale();
  const calendar = onCallStore.calendars.get(calendarId);
  const rotation = calendar?.rotations.find((r) => r.id === rotationId);
  const today = calendar?.today ?? "";
  const [change, setChange] = useState<MembershipChange | null>(null);
  const [position, setPosition] = useState(EndPosition);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [preview, setPreview] = useState<OnCallMembershipResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useCalendarUsers(calendar);

  const segments = rotation?.segments ?? [];
  const latestMembers = segments[segments.length - 1]?.memberIds ?? NoMembers;
  const scheduled = segments.filter((segment) => segment.effectiveDate > today);

  const pendingChange: MembershipChange | null = useMemo(() => {
    if (!change || change.type === "remove") {
      return change;
    }
    return {
      ...change,
      position: position === EndPosition ? undefined : Number(position),
    };
  }, [change, position]);

  useEffect(() => {
    setPreview(null);
    if (!pendingChange || !effectiveDate) {
      return;
    }

    let cancelled = false;
    const params = {
      id: rotationId,
      userId: pendingChange.userId,
      effectiveDate,
      position:
        pendingChange.type === "add" ? pendingChange.position : undefined,
      preview: true,
    };
    const request =
      pendingChange.type === "add"
        ? onCallStore.addMember(calendarId, params)
        : onCallStore.removeMember(calendarId, params);

    request
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [calendarId, effectiveDate, pendingChange, rotationId]);

  const addOptions: Option[] = useMemo(
    () =>
      users.active
        .filter((user) => !user.isGuest && !latestMembers.includes(user.id))
        .map((user) => ({
          type: "item" as const,
          label: user.name,
          value: user.id,
        })),
    [latestMembers, users.active]
  );

  const positionOptions: Option[] = useMemo(
    () => [
      { type: "item" as const, label: t("At the end"), value: EndPosition },
      ...latestMembers.map((userId, index) => ({
        type: "item" as const,
        label: t("Before {{ name }}", {
          name: users.get(userId)?.name ?? t("Unknown"),
        }),
        value: String(index),
      })),
    ],
    [latestMembers, t, users]
  );

  const handleApply = useCallback(async () => {
    if (!pendingChange) {
      return;
    }
    setIsSaving(true);
    const params = {
      id: rotationId,
      userId: pendingChange.userId,
      effectiveDate,
      position:
        pendingChange.type === "add" ? pendingChange.position : undefined,
    };

    try {
      const result =
        pendingChange.type === "add"
          ? await onCallStore.addMember(calendarId, params)
          : await onCallStore.removeMember(calendarId, params);
      toast.success(
        t("Rotation updated from {{ date }}", {
          date: formatDate(result.effectiveDate, locale),
        })
      );
      setChange(null);
      setPosition(EndPosition);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [calendarId, effectiveDate, locale, pendingChange, rotationId, t]);

  if (!calendar || !rotation) {
    return <Notice>{t("This rotation could not be found.")}</Notice>;
  }

  return (
    <div>
      {rotation.currentShift && (
        <Text as="p" type="secondary">
          {t("Currently on call")}:{" "}
          <UserLabel userId={rotation.currentShift.userId} />{" "}
          {t("until {{ date }}", {
            date: formatDate(rotation.currentShift.endDate, locale, {
              weekday: "short",
              month: "short",
              day: "numeric",
            }),
          })}
        </Text>
      )}
      <LabelText>{t("Members, in rotation order")}</LabelText>
      <Members>
        {latestMembers.length === 0 && (
          <Text type="tertiary">{t("No members yet")}</Text>
        )}
        {latestMembers.map((userId, index) => (
          <Member
            key={userId}
            $selected={change?.type === "remove" && change.userId === userId}
          >
            <span>
              {index + 1}. <UserLabel userId={userId} />
            </span>
            <Button
              neutral
              type="button"
              onClick={() => setChange({ type: "remove", userId })}
            >
              {t("Remove…")}
            </Button>
          </Member>
        ))}
      </Members>
      {scheduled.length > 0 && (
        <Text as="p" type="tertiary" size="small">
          {scheduled
            .map((segment) =>
              t("Scheduled change from {{ date }}", {
                date: formatDate(segment.effectiveDate, locale),
              })
            )
            .join(" · ")}
        </Text>
      )}
      <Flex gap={12} align="flex-end">
        <Field>
          <InputSelect
            label={t("Add person")}
            options={addOptions}
            value={change?.type === "add" ? change.userId : null}
            onChange={(userId) => setChange({ type: "add", userId })}
            displayValue={(option) => option?.label ?? t("Choose a person…")}
          />
        </Field>
        <Field>
          <InputSelect
            label={t("Position")}
            options={positionOptions}
            value={position}
            onChange={setPosition}
            disabled={change?.type !== "add"}
          />
        </Field>
      </Flex>
      <DateField
        label={t("Effective from")}
        value={effectiveDate}
        min={today}
        onChange={setEffectiveDate}
      />
      {pendingChange && (
        <PreviewBox>
          <Text as="p" size="small">
            {pendingChange.type === "add"
              ? t("Adding {{ name }}.", {
                  name: users.get(pendingChange.userId)?.name ?? t("Unknown"),
                })
              : t("Removing {{ name }}.", {
                  name: users.get(pendingChange.userId)?.name ?? t("Unknown"),
                })}{" "}
            {preview
              ? t(
                  "Applies from the next handoff: {{ date }}. The current and past shifts are unchanged.",
                  {
                    date: formatDate(preview.effectiveDate, locale, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    }),
                  }
                )
              : `${t("Loading preview")}…`}
          </Text>
          {preview && (
            <PreviewList aria-label={t("Preview")}>
              {preview.preview.map((shift) => (
                <li key={shift.startDate}>
                  <Text type="tertiary" size="small">
                    {formatDate(shift.startDate, locale)}
                  </Text>
                  <UserLabel userId={shift.userId} />
                </li>
              ))}
            </PreviewList>
          )}
        </PreviewBox>
      )}
      <Flex justify="flex-end" gap={8}>
        <Button type="button" neutral onClick={onDone}>
          {t("Done")}
        </Button>
        <Button
          type="button"
          onClick={handleApply}
          disabled={!pendingChange || !preview || isSaving}
        >
          {isSaving ? `${t("Applying")}…` : t("Apply")}
        </Button>
      </Flex>
    </div>
  );
});

const Members = styled.ol`
  list-style: none;
  margin: 4px 0 12px;
  padding: 0;
`;

const Member = styled.li<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  border-radius: 4px;
  border-bottom: 1px solid ${s("divider")};
  background: ${(props) =>
    props.$selected ? `${props.theme.danger}1a` : "transparent"};
`;

const Field = styled.div`
  flex: 1;
  min-width: 0;
  margin-bottom: 16px;
`;

const PreviewBox = styled.div`
  padding: 12px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: ${s("backgroundSecondary")};
`;

const PreviewList = styled.ol`
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;

  li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
`;
