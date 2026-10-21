import { observer } from "mobx-react";
import { ArrowIcon, CloseIcon } from "outline-icons";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input, { LabelText } from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import NudeButton from "~/components/NudeButton";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { nextWeekday } from "../../shared/dates";
import type {
  OnCallCalendarData,
  OnCallRotationData,
} from "../../shared/types";
import { OnCallValidation, RotationColors } from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { useIntlLocale } from "../hooks";
import { formatDate, getWeekdayNames } from "../utils";
import { DateField } from "./DateField";
import { UserLabel } from "./UserLabel";

interface Props {
  /** The calendar the rotation belongs to. */
  calendar: OnCallCalendarData;
  /** The rotation to edit, omit to create a new rotation. */
  rotation?: OnCallRotationData;
  /** Called once the rotation has been saved. */
  onSubmit: () => void;
}

/**
 * The form used to create or edit a rotation.
 */
export const RotationForm = observer(function RotationForm({
  calendar,
  rotation,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const locale = useIntlLocale();
  const [name, setName] = useState(rotation?.name ?? "");
  const [color, setColor] = useState(
    rotation?.color ??
      RotationColors[calendar.rotations.length % RotationColors.length]
  );
  const [startDate, setStartDate] = useState(
    rotation?.startDate ?? calendar.today
  );
  const [startDayOfWeek, setStartDayOfWeek] = useState(
    rotation?.startDayOfWeek ?? 1
  );
  const [shiftLength, setShiftLength] = useState(
    String(rotation?.shiftLengthDays ?? 7)
  );
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [notifyOnChange, setNotifyOnChange] = useState(
    rotation?.notifyOnChange ?? false
  );
  const [isSaving, setIsSaving] = useState(false);

  const started =
    !!rotation &&
    (rotation.segments[0]?.effectiveDate ?? rotation.startDate) <=
      calendar.today;
  const shiftLengthDays = parseInt(shiftLength, 10);
  const shiftLengthValid =
    Number.isInteger(shiftLengthDays) &&
    shiftLengthDays >= 1 &&
    shiftLengthDays <= OnCallValidation.maxShiftLengthDays;
  const isValid = name.trim().length > 0 && shiftLengthValid;
  const firstShift = nextWeekday(startDate, startDayOfWeek);

  const weekdayOptions: Option[] = useMemo(
    () =>
      getWeekdayNames(locale, 0, "long").map((label, index) => ({
        type: "item" as const,
        label,
        value: String(index),
      })),
    [locale]
  );

  const userOptions: Option[] = useMemo(
    () =>
      users.active
        .filter((user) => !user.isGuest && !memberIds.includes(user.id))
        .map((user) => ({
          type: "item" as const,
          label: user.name,
          value: user.id,
        })),
    [memberIds, users.active]
  );

  const handleMove = useCallback((index: number, offset: number) => {
    setMemberIds((previous) => {
      const next = [...previous];
      const [moved] = next.splice(index, 1);
      next.splice(index + offset, 0, moved);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setIsSaving(true);

      const params = {
        name: name.trim(),
        color,
        startDayOfWeek,
        shiftLengthDays,
        notifyOnChange,
        ...(started ? {} : { startDate }),
      };

      try {
        if (rotation) {
          await onCallStore.updateRotation(calendar.id, rotation.id, params);
        } else {
          await onCallStore.createRotation(calendar.id, {
            ...params,
            startDate,
            memberIds,
          });
        }
        onSubmit();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSaving(false);
      }
    },
    [
      calendar.id,
      color,
      memberIds,
      name,
      notifyOnChange,
      onSubmit,
      rotation,
      shiftLengthDays,
      startDate,
      startDayOfWeek,
      started,
    ]
  );

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label={t("Name")}
        placeholder={t("Primary")}
        value={name}
        maxLength={OnCallValidation.maxNameLength}
        onChange={(ev) => setName(ev.target.value)}
        autoFocus
        required
      />
      <LabelText>{t("Color")}</LabelText>
      <Swatches role="radiogroup" aria-label={t("Color")}>
        {RotationColors.map((value) => (
          <Swatch
            key={value}
            type="button"
            role="radio"
            aria-checked={color === value}
            aria-label={value}
            $color={value}
            $selected={color === value}
            onClick={() => setColor(value)}
          />
        ))}
      </Swatches>
      <Flex gap={12}>
        <DateField
          label={t("Starts on")}
          value={startDate}
          onChange={setStartDate}
          disabled={started}
        />
        <Field>
          <InputSelect
            label={t("Shifts start on")}
            options={weekdayOptions}
            value={String(startDayOfWeek)}
            onChange={(value) => setStartDayOfWeek(Number(value))}
          />
        </Field>
      </Flex>
      <Input
        label={t("Rotate every (days)")}
        type="text"
        inputMode="numeric"
        value={shiftLength}
        onChange={(ev) => setShiftLength(ev.target.value)}
        error={
          shiftLengthValid
            ? undefined
            : t("Enter a number of days between 1 and {{ max }}", {
                max: OnCallValidation.maxShiftLengthDays,
              })
        }
      />
      <Text as="p" type="tertiary" size="small">
        {started
          ? t(
              "Changes to the start day or frequency apply from the next handoff. Current and past shifts are not changed."
            )
          : t("The first shift starts on {{ date }}.", {
              date: formatDate(firstShift, locale, {
                weekday: "long",
                month: "short",
                day: "numeric",
              }),
            })}
      </Text>
      {!rotation && (
        <>
          <LabelText>{t("Members, in order")}</LabelText>
          <Members>
            {memberIds.map((userId, index) => (
              <Member key={userId}>
                <UserLabel userId={userId} />
                <Flex gap={2}>
                  <NudeButton
                    type="button"
                    aria-label={t("Move up")}
                    disabled={index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    <UpIcon size={18} />
                  </NudeButton>
                  <NudeButton
                    type="button"
                    aria-label={t("Move down")}
                    disabled={index === memberIds.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    <DownIcon size={18} />
                  </NudeButton>
                  <NudeButton
                    type="button"
                    aria-label={t("Remove")}
                    onClick={() =>
                      setMemberIds((previous) =>
                        previous.filter((id) => id !== userId)
                      )
                    }
                  >
                    <CloseIcon size={18} />
                  </NudeButton>
                </Flex>
              </Member>
            ))}
          </Members>
          <Field>
            <InputSelect
              label={t("Add person")}
              labelHidden
              options={userOptions}
              value={null}
              onChange={(value) =>
                setMemberIds((previous) => [...previous, value])
              }
              displayValue={() => t("Add person…")}
            />
          </Field>
        </>
      )}
      <SwitchRow>
        <Switch
          label={t("Post to Slack when the shift changes")}
          note={
            calendar.slackConfigured
              ? undefined
              : t("Add a Slack webhook in the calendar settings first.")
          }
          checked={notifyOnChange}
          onChange={setNotifyOnChange}
        />
      </SwitchRow>
      <Flex justify="flex-end">
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving
            ? `${t("Saving")}…`
            : rotation
              ? t("Save")
              : t("Create rotation")}
        </Button>
      </Flex>
    </form>
  );
});

const Field = styled.div`
  flex: 1;
  min-width: 0;
  margin-bottom: 16px;
`;

const Swatches = styled.div`
  display: flex;
  gap: 8px;
  margin: 4px 0 16px;
`;

const Swatch = styled.button<{ $color: string; $selected: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid
    ${(props) => (props.$selected ? props.theme.text : "transparent")};
  background: ${(props) => props.$color};
  cursor: pointer;
`;

const Members = styled.ol`
  list-style: none;
  margin: 4px 0 8px;
  padding: 0;
`;

const Member = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  border-bottom: 1px solid ${s("divider")};
`;

const UpIcon = styled(ArrowIcon)`
  transform: rotate(-90deg);
`;

const DownIcon = styled(ArrowIcon)`
  transform: rotate(90deg);
`;

const SwitchRow = styled.div`
  margin: 16px 0 24px;
`;
