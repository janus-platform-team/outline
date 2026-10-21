import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";
import { isValidDate, isValidTimeZone } from "../../shared/dates";
import { OnCallValidation } from "../../shared/types";

const name = z.string().trim().min(1).max(OnCallValidation.maxNameLength);

const description = z
  .string()
  .trim()
  .max(OnCallValidation.maxDescriptionLength)
  .nullish();

const date = z.string().refine(isValidDate, "must be a date in the form YYYY-MM-DD");

const timezone = z.string().refine(isValidTimeZone, "must be a valid timezone");

const notifyHour = z.number().int().min(0).max(23);

const slackWebhookUrl = z
  .url()
  .refine(
    (value) => value.startsWith("https://hooks.slack.com/"),
    "must be a Slack incoming webhook URL"
  )
  .nullish();

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const startDayOfWeek = z.number().int().min(0).max(6);

const shiftLengthDays = z
  .number()
  .int()
  .min(1)
  .max(OnCallValidation.maxShiftLengthDays);

export const OnCallCalendarsListSchema = BaseSchema.extend({
  body: z.object({}).prefault({}),
});

export type OnCallCalendarsListReq = z.infer<typeof OnCallCalendarsListSchema>;

export const OnCallCalendarsInfoSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type OnCallCalendarsInfoReq = z.infer<typeof OnCallCalendarsInfoSchema>;

export const OnCallCalendarsCreateSchema = BaseSchema.extend({
  body: z.object({
    name,
    description,
    timezone: timezone.optional(),
    notifyHour: notifyHour.optional(),
    slackWebhookUrl,
  }),
});

export type OnCallCalendarsCreateReq = z.infer<
  typeof OnCallCalendarsCreateSchema
>;

export const OnCallCalendarsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    name: name.optional(),
    description,
    timezone: timezone.optional(),
    notifyHour: notifyHour.optional(),
    slackWebhookUrl,
  }),
});

export type OnCallCalendarsUpdateReq = z.infer<
  typeof OnCallCalendarsUpdateSchema
>;

export const OnCallCalendarsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type OnCallCalendarsDeleteReq = z.infer<
  typeof OnCallCalendarsDeleteSchema
>;

export const OnCallCalendarsScheduleSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    startDate: date,
    endDate: date,
    rotationIds: z.array(z.uuid()).optional(),
  }),
});

export type OnCallCalendarsScheduleReq = z.infer<
  typeof OnCallCalendarsScheduleSchema
>;

export const OnCallCalendarsTestNotificationSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type OnCallCalendarsTestNotificationReq = z.infer<
  typeof OnCallCalendarsTestNotificationSchema
>;

export const OnCallRotationsCreateSchema = BaseSchema.extend({
  body: z.object({
    calendarId: z.uuid(),
    name,
    color: color.optional(),
    startDate: date,
    startDayOfWeek,
    shiftLengthDays,
    memberIds: z.array(z.uuid()).max(OnCallValidation.maxMembers).default([]),
    notifyOnChange: z.boolean().optional(),
  }),
});

export type OnCallRotationsCreateReq = z.infer<
  typeof OnCallRotationsCreateSchema
>;

export const OnCallRotationsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    name: name.optional(),
    color: color.optional(),
    startDate: date.optional(),
    startDayOfWeek: startDayOfWeek.optional(),
    shiftLengthDays: shiftLengthDays.optional(),
    notifyOnChange: z.boolean().optional(),
    index: z.number().int().min(0).optional(),
  }),
});

export type OnCallRotationsUpdateReq = z.infer<
  typeof OnCallRotationsUpdateSchema
>;

export const OnCallRotationsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type OnCallRotationsDeleteReq = z.infer<
  typeof OnCallRotationsDeleteSchema
>;

export const OnCallRotationsAddMemberSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    userId: z.uuid(),
    effectiveDate: date,
    position: z.number().int().min(0).optional(),
    preview: z.boolean().optional(),
  }),
});

export type OnCallRotationsAddMemberReq = z.infer<
  typeof OnCallRotationsAddMemberSchema
>;

export const OnCallRotationsRemoveMemberSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    userId: z.uuid(),
    effectiveDate: date,
    preview: z.boolean().optional(),
  }),
});

export type OnCallRotationsRemoveMemberReq = z.infer<
  typeof OnCallRotationsRemoveMemberSchema
>;

export const OnCallOverridesCreateSchema = BaseSchema.extend({
  body: z
    .object({
      rotationId: z.uuid(),
      userId: z.uuid(),
      startDate: date,
      endDate: date,
      reason: z
        .string()
        .trim()
        .max(OnCallValidation.maxReasonLength)
        .nullish(),
    })
    .refine((body) => body.startDate <= body.endDate, {
      message: "endDate must be on or after startDate",
      path: ["endDate"],
    }),
});

export type OnCallOverridesCreateReq = z.infer<
  typeof OnCallOverridesCreateSchema
>;

export const OnCallOverridesDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type OnCallOverridesDeleteReq = z.infer<
  typeof OnCallOverridesDeleteSchema
>;
