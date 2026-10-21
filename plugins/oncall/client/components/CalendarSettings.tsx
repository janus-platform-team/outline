import { observer } from "mobx-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Text from "~/components/Text";
import type { OnCallCalendarData } from "../../shared/types";
import { OnCallValidation } from "../../shared/types";
import { onCallStore } from "../OnCallStore";
import { getLocalTimeZone, getTimeZoneOptions } from "../utils";

interface Props {
  /** The calendar to edit, omit to create a new calendar. */
  calendar?: OnCallCalendarData;
  /** Called once the calendar has been saved. */
  onSubmit: () => void;
  /** Called once the calendar has been deleted. */
  onDelete?: () => void;
}

function showError(err: unknown) {
  toast.error(err instanceof Error ? err.message : String(err));
}

/**
 * The form used to create a calendar or change its settings.
 */
export const CalendarSettings = observer(function CalendarSettings({
  calendar,
  onSubmit,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const history = useHistory();
  const [name, setName] = useState(calendar?.name ?? "");
  const [description, setDescription] = useState(calendar?.description ?? "");
  const [timezone, setTimezone] = useState(
    () => calendar?.timezone ?? getLocalTimeZone()
  );
  const [notifyHour, setNotifyHour] = useState(calendar?.notifyHour ?? 9);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [removeWebhook, setRemoveWebhook] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const timezoneOptions: Option[] = useMemo(
    () =>
      getTimeZoneOptions(timezone).map((zone) => ({
        type: "item" as const,
        label: zone.replace(/_/g, " "),
        value: zone,
      })),
    [timezone]
  );

  const hourOptions: Option[] = useMemo(
    () =>
      Array.from({ length: 24 }, (_, hour) => ({
        type: "item" as const,
        label: `${String(hour).padStart(2, "0")}:00`,
        value: String(hour),
      })),
    []
  );

  const webhookInvalid =
    webhookUrl.length > 0 && !webhookUrl.startsWith("https://hooks.slack.com/");
  const isValid = name.trim().length > 0 && !webhookInvalid;
  const slackConfigured = !!calendar?.slackConfigured && !removeWebhook;

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setIsSaving(true);

      const params = {
        name: name.trim(),
        description: description.trim() || null,
        timezone,
        notifyHour,
        slackWebhookUrl: webhookUrl
          ? webhookUrl.trim()
          : removeWebhook
            ? null
            : undefined,
      };

      try {
        if (calendar) {
          await onCallStore.update(calendar.id, params);
          onSubmit();
        } else {
          const created = await onCallStore.create(params);
          onSubmit();
          history.push(`/oncall/${created.id}`);
        }
      } catch (err) {
        showError(err);
      } finally {
        setIsSaving(false);
      }
    },
    [
      calendar,
      description,
      history,
      name,
      notifyHour,
      onSubmit,
      removeWebhook,
      timezone,
      webhookUrl,
    ]
  );

  const handleTest = useCallback(async () => {
    if (!calendar) {
      return;
    }
    try {
      await onCallStore.testNotification(calendar.id);
      toast.success(t("Test message sent"));
    } catch (err) {
      showError(err);
    }
  }, [calendar, t]);

  const handleDelete = useCallback(async () => {
    if (
      !calendar ||
      !window.confirm(
        t("Are you sure you want to delete the calendar “{{ name }}”?", {
          name: calendar.name,
        })
      )
    ) {
      return;
    }
    try {
      await onCallStore.delete(calendar.id);
      onDelete?.();
    } catch (err) {
      showError(err);
    }
  }, [calendar, onDelete, t]);

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label={t("Name")}
        placeholder={t("Platform Engineering")}
        value={name}
        maxLength={OnCallValidation.maxNameLength}
        onChange={(ev) => setName(ev.target.value)}
        autoFocus
        required
      />
      <Input
        type="textarea"
        label={t("Description")}
        value={description}
        maxLength={OnCallValidation.maxDescriptionLength}
        onChange={(ev) => setDescription(ev.target.value)}
        rows={2}
      />
      <Flex gap={12}>
        <Field>
          <InputSelect
            label={t("Timezone")}
            options={timezoneOptions}
            value={timezone}
            onChange={setTimezone}
            help={t("Shifts change at midnight in this timezone.")}
          />
        </Field>
        <Field>
          <InputSelect
            label={t("Notify at")}
            options={hourOptions}
            value={String(notifyHour)}
            onChange={(value) => setNotifyHour(Number(value))}
            help={t(
              "Slack messages for shift changes are sent at this local time."
            )}
          />
        </Field>
      </Flex>
      <Input
        label={t("Slack incoming webhook")}
        placeholder={
          slackConfigured
            ? t("Configured – enter a new URL to replace it")
            : "https://hooks.slack.com/services/…"
        }
        value={webhookUrl}
        onChange={(ev) => setWebhookUrl(ev.target.value)}
        error={
          webhookInvalid ? t("Must be a Slack incoming webhook URL") : undefined
        }
        autoComplete="off"
      />
      {slackConfigured && (
        <Flex gap={8} align="center">
          <Button type="button" neutral onClick={handleTest}>
            {t("Send test message")}
          </Button>
          <Button type="button" neutral onClick={() => setRemoveWebhook(true)}>
            {t("Remove webhook")}
          </Button>
        </Flex>
      )}
      {!calendar && (
        <Text as="p" type="tertiary" size="small">
          {t(
            "Enable notifications on a rotation to post a message when the person on call changes."
          )}
        </Text>
      )}
      <Footer justify={calendar ? "space-between" : "flex-end"} gap={8}>
        {calendar && (
          <Button type="button" neutral danger onClick={handleDelete}>
            {t("Delete calendar")}
          </Button>
        )}
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving
            ? `${t("Saving")}…`
            : calendar
              ? t("Save")
              : t("Create calendar")}
        </Button>
      </Footer>
    </form>
  );
});

const Field = styled.div`
  flex: 1;
  min-width: 0;
  margin-bottom: 16px;
`;

const Footer = styled(Flex)`
  margin-top: 24px;
`;
