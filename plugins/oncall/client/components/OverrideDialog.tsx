import { observer } from "mobx-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Notice from "~/components/Notice";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import type {
  DateString,
  OnCallCalendarData,
  OnCallRotationData,
} from "../../shared/types";
import { OnCallValidation } from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { useIntlLocale } from "../hooks";
import { formatDateRange, maxDate } from "../utils";
import { DateField } from "./DateField";
import { UserLabel } from "./UserLabel";

interface Props {
  /** The calendar the rotation belongs to. */
  calendar: OnCallCalendarData;
  /** The rotation to override. */
  rotation: OnCallRotationData;
  /** The id of an existing override to show, omit to create one. */
  overrideId?: string;
  /** The initial first day of a new override. */
  initialStartDate?: DateString;
  /** The initial last day of a new override. */
  initialEndDate?: DateString;
  /** Called when the dialog should close. */
  onDone: () => void;
}

function showError(err: unknown) {
  toast.error(err instanceof Error ? err.message : String(err));
}

/**
 * Creates an override for a date range, or shows and deletes an existing one.
 */
export const OverrideDialog = observer(function OverrideDialog({
  calendar,
  rotation,
  overrideId,
  initialStartDate,
  initialEndDate,
  onDone,
}: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const locale = useIntlLocale();
  const [userId, setUserId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    initialStartDate ?? calendar.today
  );
  const [endDate, setEndDate] = useState(
    initialEndDate ?? initialStartDate ?? calendar.today
  );
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const userOptions: Option[] = useMemo(
    () =>
      users.active
        .filter((user) => !user.isGuest)
        .map((user) => ({
          type: "item" as const,
          label: user.name,
          value: user.id,
        })),
    [users.active]
  );

  const handleDelete = useCallback(async () => {
    if (!overrideId) {
      return;
    }
    setIsSaving(true);
    try {
      await onCallStore.deleteOverride(calendar.id, overrideId);
      onDone();
    } catch (err) {
      showError(err);
    } finally {
      setIsSaving(false);
    }
  }, [calendar.id, onDone, overrideId]);

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      if (!userId) {
        return;
      }
      setIsSaving(true);
      try {
        await onCallStore.createOverride(calendar.id, {
          rotationId: rotation.id,
          userId,
          startDate,
          endDate,
          reason: reason.trim() || null,
        });
        onDone();
      } catch (err) {
        showError(err);
      } finally {
        setIsSaving(false);
      }
    },
    [calendar.id, endDate, onDone, reason, rotation.id, startDate, userId]
  );

  if (overrideId) {
    const override = rotation.overrides.find((o) => o.id === overrideId);
    if (!override) {
      return (
        <Notice>
          {t("This override has ended and can no longer be changed.")}
        </Notice>
      );
    }

    return (
      <div>
        <Text as="p">
          <UserLabel userId={override.userId} />{" "}
          {t("is on call from {{ range }}", {
            range: formatDateRange(
              override.startDate,
              override.endDate,
              locale
            ),
          })}
        </Text>
        {override.reason && (
          <Text as="p" type="secondary">
            {override.reason}
          </Text>
        )}
        <Flex justify="flex-end" gap={8}>
          <Button type="button" neutral onClick={onDone}>
            {t("Close")}
          </Button>
          <Button
            type="button"
            danger
            onClick={handleDelete}
            disabled={isSaving}
          >
            {t("Delete override")}
          </Button>
        </Flex>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputSelect
        label={t("Who")}
        options={userOptions}
        value={userId}
        onChange={setUserId}
        displayValue={(option) => option?.label ?? t("Choose a person…")}
      />
      <Flex gap={12} style={{ marginTop: 16 }}>
        <DateField
          label={t("From")}
          value={startDate}
          min={calendar.today}
          onChange={(value) => {
            setStartDate(value);
            setEndDate((previous) => maxDate(previous, value));
          }}
        />
        <DateField
          label={t("To (inclusive)")}
          value={endDate}
          min={startDate}
          onChange={setEndDate}
        />
      </Flex>
      <Input
        label={t("Reason")}
        placeholder={t("Optional")}
        value={reason}
        maxLength={OnCallValidation.maxReasonLength}
        onChange={(ev) => setReason(ev.target.value)}
      />
      <Flex justify="flex-end" gap={8}>
        <Button type="button" neutral onClick={onDone}>
          {t("Cancel")}
        </Button>
        <Button
          type="submit"
          disabled={!userId || endDate < startDate || isSaving}
        >
          {isSaving ? `${t("Saving")}…` : t("Save override")}
        </Button>
      </Flex>
    </form>
  );
});
