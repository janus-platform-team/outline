import type { Includeable, Transaction } from "sequelize";
import { Op } from "sequelize";
import { addDays, getLocalDateTime } from "../../shared/dates";
import type { DateString, RotationSegment } from "../../shared/types";
import {
  OnCallCalendar,
  OnCallOverride,
  OnCallRotation,
  OnCallRotationSegment,
} from "../models";

/** Overrides that ended more than this many days ago are not loaded with a calendar. */
const overrideHistoryDays = 61;

/**
 * Returns the current date in the timezone of a calendar.
 *
 * @param calendar the calendar.
 * @param now the instant to convert, defaults to the current time.
 * @returns the local date.
 */
export function getCalendarToday(
  calendar: Pick<OnCallCalendar, "timezone">,
  now: Date = new Date()
): DateString {
  return getLocalDateTime(calendar.timezone, now).date;
}

/**
 * Returns the include options to load the rotations of a calendar along with
 * their segments and recent overrides.
 *
 * @returns the include options.
 */
export function rotationIncludes(): Includeable[] {
  return [
    {
      model: OnCallRotationSegment,
      as: "segments",
      required: false,
    },
    {
      model: OnCallOverride,
      as: "overrides",
      required: false,
      where: {
        endDate: {
          [Op.gte]: addDays(
            new Date().toISOString().slice(0, 10),
            -overrideHistoryDays
          ),
        },
      },
    },
  ];
}

/**
 * Loads a calendar with its rotations, segments and recent overrides.
 *
 * @param id the id of the calendar.
 * @param transaction an optional transaction.
 * @returns the calendar.
 * @throws if the calendar does not exist.
 */
export function loadCalendar(id: string, transaction?: Transaction) {
  return OnCallCalendar.findByPk(id, {
    include: [
      {
        model: OnCallRotation,
        as: "rotations",
        required: false,
        include: rotationIncludes(),
      },
    ],
    rejectOnEmpty: true,
    transaction,
  });
}

/**
 * Loads a rotation with its segments, recent overrides and calendar.
 *
 * @param id the id of the rotation.
 * @param transaction an optional transaction.
 * @returns the rotation.
 * @throws if the rotation or its calendar does not exist.
 */
export function loadRotation(id: string, transaction?: Transaction) {
  return OnCallRotation.findByPk(id, {
    include: [
      ...rotationIncludes(),
      { model: OnCallCalendar, as: "calendar", required: true },
    ],
    rejectOnEmpty: true,
    transaction,
  });
}

/**
 * Replaces all of the segments of a rotation.
 *
 * @param rotationId the id of the rotation.
 * @param segments the new segments.
 * @param transaction the transaction to use.
 */
export async function replaceSegments(
  rotationId: string,
  segments: RotationSegment[],
  transaction: Transaction
) {
  await OnCallRotationSegment.destroy({ where: { rotationId }, transaction });
  await OnCallRotationSegment.bulkCreate(
    segments.map((segment) => ({ ...segment, rotationId })),
    { transaction }
  );
}
