import { Op } from "sequelize";
import { toError } from "@shared/utils/error";
import Logger from "@server/logging/Logger";
import { Team, User } from "@server/models";
import { TaskPriority } from "@server/queues/tasks/base/BaseTask";
import type { Props } from "@server/queues/tasks/base/CronTask";
import { CronTask, TaskInterval } from "@server/queues/tasks/base/CronTask";
import { addDays, getLocalDateTime } from "../../shared/dates";
import { groupShifts, resolveSchedule } from "../../shared/schedule";
import type { DateString } from "../../shared/types";
import { OnCallValidation } from "../../shared/types";
import { OnCallCalendar, OnCallRotation } from "../models";
import { presentOverride } from "../presenters/oncall";
import { rotationIncludes } from "../utils/calendars";
import { postSlackMessage } from "../utils/slack";

/**
 * Posts a Slack message for each rotation with notifications enabled whose
 * on-call user changed today. Runs hourly and sends at most one message per
 * rotation per day, once the calendar's local notify hour has passed.
 */
export default class OnCallNotifyTask extends CronTask {
  public async perform({ partition }: Props) {
    const rotations = await OnCallRotation.findAll({
      where: {
        notifyOnChange: true,
        ...this.getPartitionWhereClause("id", partition),
      },
      include: [
        ...rotationIncludes(),
        {
          model: OnCallCalendar,
          as: "calendar",
          required: true,
          where: { slackWebhookUrl: { [Op.ne]: null } },
          include: [{ model: Team, as: "team", required: true }],
        },
      ],
    });

    const now = new Date();
    for (const rotation of rotations) {
      try {
        await this.notifyRotation(rotation, now);
      } catch (err) {
        Logger.error("Failed to send on-call notification", toError(err), {
          rotationId: rotation.id,
        });
      }
    }
  }

  public get cron() {
    return {
      interval: TaskInterval.Hour,
    };
  }

  public get options() {
    return {
      attempts: 1,
      priority: TaskPriority.Background,
    };
  }

  private async notifyRotation(rotation: OnCallRotation, now: Date) {
    const { calendar } = rotation;
    const { date: today, hour } = getLocalDateTime(calendar.timezone, now);
    if (hour < calendar.notifyHour || rotation.lastNotifiedDate === today) {
      return;
    }

    const overrides = (rotation.overrides ?? []).map(presentOverride);
    const shifts = groupShifts(
      resolveSchedule(
        rotation.plainSegments,
        overrides,
        addDays(today, -1),
        addDays(today, OnCallValidation.maxScheduleDays)
      )
    );
    const previous = shifts[0];
    const current = shifts.find(
      (shift) => shift.startDate <= today && shift.endDate >= today
    );

    if (
      current?.userId &&
      current.startDate === today &&
      current.userId !== previous.userId &&
      calendar.slackWebhookUrl
    ) {
      const users = await User.findAll({
        where: {
          id: [current.userId, previous.userId].filter(
            (id): id is string => !!id
          ),
        },
      });
      const nameOf = (id: string | null) =>
        users.find((user) => user.id === id)?.name ?? "Nobody";
      const url = `${calendar.team.url}/oncall/${calendar.id}`;
      const range = `${formatDate(current.startDate)} – ${formatDate(current.endDate)}`;
      const text = `${nameOf(current.userId)} is now on call for ${calendar.name} / ${rotation.name} (${range}). Previously: ${nameOf(previous.userId)}.`;

      await postSlackMessage(calendar.slackWebhookUrl, {
        text,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*On-call change – ${escapeMrkdwn(calendar.name)} / ${escapeMrkdwn(rotation.name)}*\n${escapeMrkdwn(nameOf(current.userId))} is now on call (${range}). Previously: ${escapeMrkdwn(nameOf(previous.userId))}.`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View calendar" },
                url,
              },
            ],
          },
        ],
      });
    }

    rotation.lastNotifiedDate = today;
    await rotation.save({ silent: true });
  }
}

function formatDate(date: DateString) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function escapeMrkdwn(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
