import Router from "@koa/router";
import type { Transaction } from "sequelize";
import { Op } from "sequelize";
import { ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import { User } from "@server/models";
import { authorize } from "@server/policies";
import pagination, {
  paginateQuery,
} from "@server/routes/api/middlewares/pagination";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import { addDays, daysBetween, nextWeekday } from "../../shared/dates";
import {
  applyMembershipChange,
  applyScheduleChange,
  findOverlappingOverride,
  getChangeBoundary,
  getSegmentAt,
  getShiftRange,
  groupShifts,
  previewShifts,
  reanchorRotation,
  resolveSchedule,
  sortSegments,
} from "../../shared/schedule";
import type {
  MembershipChange,
  OnCallMembershipResult,
  OnCallScheduleData,
  RotationSegment,
} from "../../shared/types";
import { OnCallValidation, RotationColors } from "../../shared/types";
import { OnCallCalendar, OnCallOverride, OnCallRotation } from "../models";
import {
  presentCalendar,
  presentOverride,
  presentRotation,
} from "../presenters/oncall";
import { emitOnCallUpdate } from "../realtime";
import {
  getCalendarToday,
  loadCalendar,
  loadRotation,
  replaceSegments,
  rotationIncludes,
} from "../utils/calendars";
import { postSlackMessage } from "../utils/slack";
import * as T from "./schema";

const router = new Router();

/** The number of upcoming shifts returned when changing members. */
const previewShiftCount = 6;

router.post(
  "oncallCalendars.list",
  auth(),
  pagination(),
  validate(T.OnCallCalendarsListSchema),
  async (ctx: APIContext<T.OnCallCalendarsListReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "listOnCallCalendars", user.team);

    const where = { teamId: user.teamId };
    const { results, pagination } = await paginateQuery(
      ctx,
      (opts) =>
        OnCallCalendar.findAll({
          where,
          include: [
            {
              model: OnCallRotation,
              as: "rotations",
              required: false,
              include: rotationIncludes(),
            },
          ],
          order: [["name", "ASC"]],
          offset: opts.offset,
          limit: opts.limit,
        }),
      () => OnCallCalendar.count({ where })
    );

    ctx.body = {
      pagination,
      data: results.map((calendar) =>
        presentCalendar(calendar, getCalendarToday(calendar))
      ),
    };
  }
);

router.post(
  "oncallCalendars.info",
  auth(),
  validate(T.OnCallCalendarsInfoSchema),
  async (ctx: APIContext<T.OnCallCalendarsInfoReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;

    const calendar = await loadCalendar(id);
    authorize(user, "read", calendar);

    ctx.body = {
      data: presentCalendar(calendar, getCalendarToday(calendar)),
    };
  }
);

router.post(
  "oncallCalendars.create",
  auth(),
  validate(T.OnCallCalendarsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallCalendarsCreateReq>) => {
    const { name, description, timezone, notifyHour, slackWebhookUrl } =
      ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    authorize(user, "createOnCallCalendar", user.team);

    const calendar = await OnCallCalendar.create(
      {
        name,
        description: description ?? null,
        timezone,
        notifyHour,
        slackWebhookUrl: slackWebhookUrl ?? null,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    await respondWithCalendar(ctx, calendar.id);
  }
);

router.post(
  "oncallCalendars.update",
  auth(),
  validate(T.OnCallCalendarsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallCalendarsUpdateReq>) => {
    const { id, name, description, timezone, notifyHour, slackWebhookUrl } =
      ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const calendar = await OnCallCalendar.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "update", calendar);

    if (name !== undefined) {
      calendar.name = name;
    }
    if (description !== undefined) {
      calendar.description = description;
    }
    if (timezone !== undefined) {
      calendar.timezone = timezone;
    }
    if (notifyHour !== undefined) {
      calendar.notifyHour = notifyHour;
    }
    if (slackWebhookUrl !== undefined) {
      calendar.slackWebhookUrl = slackWebhookUrl;
    }

    await calendar.save({ transaction });
    await respondWithCalendar(ctx, calendar.id);
  }
);

router.post(
  "oncallCalendars.delete",
  auth(),
  validate(T.OnCallCalendarsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallCalendarsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const calendar = await OnCallCalendar.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "delete", calendar);

    await OnCallRotation.destroy({ where: { calendarId: id }, transaction });
    await calendar.destroy({ transaction });
    transaction.afterCommit(() => emitOnCallUpdate(calendar.teamId, id));

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "oncallCalendars.schedule",
  auth(),
  validate(T.OnCallCalendarsScheduleSchema),
  async (ctx: APIContext<T.OnCallCalendarsScheduleReq>) => {
    const { id, startDate, endDate, rotationIds } = ctx.input.body;
    const { user } = ctx.state.auth;

    const length = daysBetween(startDate, endDate) + 1;
    if (length < 1) {
      throw ValidationError("endDate must be on or after startDate");
    }
    if (length > OnCallValidation.maxScheduleDays) {
      throw ValidationError(
        `The date range cannot exceed ${OnCallValidation.maxScheduleDays} days`
      );
    }

    const calendar = await loadCalendar(id);
    authorize(user, "read", calendar);

    const rotations = calendar.rotations.filter(
      (rotation) => !rotationIds || rotationIds.includes(rotation.id)
    );
    const overrides = rotations.length
      ? await OnCallOverride.findAll({
          where: {
            rotationId: rotations.map((rotation) => rotation.id),
            startDate: { [Op.lte]: endDate },
            endDate: { [Op.gte]: startDate },
          },
          order: [["startDate", "ASC"]],
        })
      : [];
    const presentedOverrides = overrides.map(presentOverride);

    const data: OnCallScheduleData = {
      calendarId: calendar.id,
      startDate,
      endDate,
      rotations: rotations.map((rotation) => ({
        rotationId: rotation.id,
        shifts: groupShifts(
          resolveSchedule(
            rotation.plainSegments,
            presentedOverrides.filter((o) => o.rotationId === rotation.id),
            startDate,
            endDate
          )
        ),
      })),
      overrides: presentedOverrides,
    };

    ctx.body = { data };
  }
);

router.post(
  "oncallCalendars.testNotification",
  rateLimiter(RateLimiterStrategy.FivePerMinute),
  auth(),
  validate(T.OnCallCalendarsTestNotificationSchema),
  async (ctx: APIContext<T.OnCallCalendarsTestNotificationReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;

    const calendar = await OnCallCalendar.findByPk(id, { rejectOnEmpty: true });
    authorize(user, "update", calendar);

    if (!calendar.slackWebhookUrl) {
      throw ValidationError("No Slack webhook is configured");
    }

    try {
      await postSlackMessage(calendar.slackWebhookUrl, {
        text: `Test message from the on-call calendar “${calendar.name}”. Shift changes will be posted here.`,
      });
    } catch {
      throw ValidationError("Slack rejected the test message");
    }

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "oncallRotations.create",
  auth(),
  validate(T.OnCallRotationsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallRotationsCreateReq>) => {
    const {
      calendarId,
      name,
      color,
      startDate,
      startDayOfWeek,
      shiftLengthDays,
      notifyOnChange,
    } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    const memberIds = [...new Set(ctx.input.body.memberIds)];

    const calendar = await OnCallCalendar.findByPk(calendarId, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "update", calendar);

    const count = await OnCallRotation.count({
      where: { calendarId },
      transaction,
    });
    if (count >= OnCallValidation.maxRotations) {
      throw ValidationError(
        `A calendar cannot have more than ${OnCallValidation.maxRotations} rotations`
      );
    }
    await assertTeamMembers(user, memberIds, transaction);

    const rotation = await OnCallRotation.create(
      {
        calendarId,
        name,
        color: color ?? RotationColors[count % RotationColors.length],
        startDate,
        startDayOfWeek,
        shiftLengthDays,
        notifyOnChange: notifyOnChange ?? false,
        index: count,
      },
      { transaction }
    );
    await replaceSegments(
      rotation.id,
      [
        {
          effectiveDate: nextWeekday(startDate, startDayOfWeek),
          memberIds,
          startIndex: 0,
          shiftLengthDays,
        },
      ],
      transaction
    );

    await respondWithRotation(ctx, rotation.id);
  }
);

router.post(
  "oncallRotations.update",
  auth(),
  validate(T.OnCallRotationsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallRotationsUpdateReq>) => {
    const { id, name, color, notifyOnChange, index } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const rotation = await loadRotation(id, transaction);
    authorize(user, "update", rotation.calendar);

    const startDate = ctx.input.body.startDate ?? rotation.startDate;
    const startDayOfWeek =
      ctx.input.body.startDayOfWeek ?? rotation.startDayOfWeek;
    const shiftLengthDays =
      ctx.input.body.shiftLengthDays ?? rotation.shiftLengthDays;
    const scheduleChanged =
      startDate !== rotation.startDate ||
      startDayOfWeek !== rotation.startDayOfWeek ||
      shiftLengthDays !== rotation.shiftLengthDays;

    if (scheduleChanged) {
      const today = getCalendarToday(rotation.calendar);
      const segments = sortSegments(rotation.plainSegments);
      const started = !!segments[0] && segments[0].effectiveDate <= today;
      let updated: RotationSegment[];

      if (!started) {
        updated = reanchorRotation(
          segments,
          nextWeekday(startDate, startDayOfWeek),
          shiftLengthDays
        );
      } else if (startDate !== rotation.startDate) {
        throw ValidationError(
          "The start date cannot be changed after the rotation has started"
        );
      } else {
        const current = getShiftRange(segments, today);
        const boundary = nextWeekday(
          current ? addDays(current.endDate, 1) : today,
          startDayOfWeek
        );
        updated = applyScheduleChange(segments, boundary, shiftLengthDays);
      }

      await replaceSegments(rotation.id, updated, transaction);
    }

    rotation.set({
      name: name ?? rotation.name,
      color: color ?? rotation.color,
      notifyOnChange: notifyOnChange ?? rotation.notifyOnChange,
      index: index ?? rotation.index,
      startDate,
      startDayOfWeek,
      shiftLengthDays,
    });
    await rotation.save({ transaction });

    await respondWithRotation(ctx, rotation.id);
  }
);

router.post(
  "oncallRotations.delete",
  auth(),
  validate(T.OnCallRotationsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallRotationsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const rotation = await loadRotation(id, transaction);
    authorize(user, "update", rotation.calendar);

    await rotation.destroy({ transaction });
    transaction.afterCommit(() =>
      emitOnCallUpdate(rotation.calendar.teamId, rotation.calendarId)
    );

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "oncallRotations.addMember",
  auth(),
  validate(T.OnCallRotationsAddMemberSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallRotationsAddMemberReq>) => {
    const { id, userId, effectiveDate, position, preview } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const rotation = await loadRotation(id, transaction);
    authorize(user, "update", rotation.calendar);
    await assertTeamMembers(user, [userId], transaction);

    await changeMembership(ctx, rotation, {
      change: { type: "add", userId, position },
      effectiveDate,
      preview: !!preview,
    });
  }
);

router.post(
  "oncallRotations.removeMember",
  auth(),
  validate(T.OnCallRotationsRemoveMemberSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallRotationsRemoveMemberReq>) => {
    const { id, userId, effectiveDate, preview } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const rotation = await loadRotation(id, transaction);
    authorize(user, "update", rotation.calendar);

    await changeMembership(ctx, rotation, {
      change: { type: "remove", userId },
      effectiveDate,
      preview: !!preview,
    });
  }
);

router.post(
  "oncallOverrides.create",
  auth(),
  validate(T.OnCallOverridesCreateSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallOverridesCreateReq>) => {
    const { rotationId, userId, startDate, endDate, reason } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const rotation = await loadRotation(rotationId, transaction);
    authorize(user, "update", rotation.calendar);
    await assertTeamMembers(user, [userId], transaction);

    const today = getCalendarToday(rotation.calendar);
    if (startDate < today) {
      throw ValidationError("An override cannot start in the past");
    }
    if (daysBetween(startDate, endDate) >= OnCallValidation.maxScheduleDays) {
      throw ValidationError(
        `An override cannot be longer than ${OnCallValidation.maxScheduleDays} days`
      );
    }

    const existing = await OnCallOverride.findAll({
      where: {
        rotationId,
        startDate: { [Op.lte]: endDate },
        endDate: { [Op.gte]: startDate },
      },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (findOverlappingOverride(existing, startDate, endDate)) {
      throw ValidationError("The override overlaps an existing override");
    }

    const override = await OnCallOverride.create(
      {
        rotationId,
        userId,
        startDate,
        endDate,
        reason: reason || null,
        createdById: user.id,
      },
      { transaction }
    );
    transaction.afterCommit(() =>
      emitOnCallUpdate(rotation.calendar.teamId, rotation.calendarId)
    );

    ctx.body = {
      data: presentOverride(override),
    };
  }
);

router.post(
  "oncallOverrides.delete",
  auth(),
  validate(T.OnCallOverridesDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.OnCallOverridesDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const override = await OnCallOverride.findByPk(id, {
      rejectOnEmpty: true,
      transaction,
    });
    const rotation = await loadRotation(override.rotationId, transaction);
    authorize(user, "update", rotation.calendar);

    if (override.endDate < getCalendarToday(rotation.calendar)) {
      throw ValidationError("Past overrides cannot be deleted");
    }

    await override.destroy({ transaction });
    transaction.afterCommit(() =>
      emitOnCallUpdate(rotation.calendar.teamId, rotation.calendarId)
    );

    ctx.body = {
      success: true,
    };
  }
);

async function changeMembership(
  ctx: APIContext<
    T.OnCallRotationsAddMemberReq | T.OnCallRotationsRemoveMemberReq
  >,
  rotation: OnCallRotation,
  options: {
    change: MembershipChange;
    effectiveDate: string;
    preview: boolean;
  }
) {
  const { change, effectiveDate, preview } = options;
  const { transaction } = ctx.state;
  const today = getCalendarToday(rotation.calendar);

  if (effectiveDate < today) {
    throw ValidationError("effectiveDate cannot be in the past");
  }

  const segments = sortSegments(rotation.plainSegments);
  const boundary = getChangeBoundary(segments, effectiveDate, today);
  const covering = getSegmentAt(segments, boundary)?.segment;
  const affected = segments.filter(
    (segment) => segment === covering || segment.effectiveDate > boundary
  );

  if (
    change.type === "add" &&
    affected.some(
      (segment) => segment.memberIds.length >= OnCallValidation.maxMembers
    )
  ) {
    throw ValidationError(
      `A rotation cannot have more than ${OnCallValidation.maxMembers} members`
    );
  }
  if (
    change.type === "remove" &&
    !affected.some((segment) => segment.memberIds.includes(change.userId))
  ) {
    throw ValidationError("The user is not a member of the rotation");
  }

  const updated = applyMembershipChange(
    segments,
    change,
    boundary,
    rotation.shiftLengthDays
  );
  const result: OnCallMembershipResult = {
    effectiveDate: boundary,
    preview: previewShifts(updated, boundary, previewShiftCount),
  };

  if (!preview) {
    await replaceSegments(rotation.id, updated, transaction);
    const reloaded = await loadRotation(rotation.id, transaction);
    result.rotation = presentRotation(reloaded, today);
    transaction.afterCommit(() =>
      emitOnCallUpdate(rotation.calendar.teamId, rotation.calendarId)
    );
  }

  ctx.body = { data: result };
}

async function assertTeamMembers(
  actor: User,
  userIds: string[],
  transaction: Transaction
) {
  if (!userIds.length) {
    return;
  }

  const count = await User.count({
    where: { id: userIds, teamId: actor.teamId, suspendedAt: null },
    transaction,
  });
  if (count !== new Set(userIds).size) {
    throw ValidationError("All users must be active members of the team");
  }
}

async function respondWithCalendar(
  ctx: APIContext<T.OnCallCalendarsCreateReq | T.OnCallCalendarsUpdateReq>,
  calendarId: string
) {
  const { transaction } = ctx.state;
  const calendar = await loadCalendar(calendarId, transaction);
  transaction.afterCommit(() => emitOnCallUpdate(calendar.teamId, calendar.id));

  ctx.body = {
    data: presentCalendar(calendar, getCalendarToday(calendar)),
  };
}

async function respondWithRotation(
  ctx: APIContext<T.OnCallRotationsCreateReq | T.OnCallRotationsUpdateReq>,
  rotationId: string
) {
  const { transaction } = ctx.state;
  const rotation = await loadRotation(rotationId, transaction);
  transaction.afterCommit(() =>
    emitOnCallUpdate(rotation.calendar.teamId, rotation.calendarId)
  );

  ctx.body = {
    data: presentRotation(rotation, getCalendarToday(rotation.calendar)),
  };
}

export default router;
