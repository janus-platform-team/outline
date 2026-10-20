import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";
import { RetroPhase, RetroValidation } from "../../shared/types";

const title = z.string().trim().min(1).max(RetroValidation.maxTitleLength);

const votesPerUser = z
  .number()
  .int()
  .min(RetroValidation.minVotesPerUser)
  .max(RetroValidation.maxVotesPerUser);

const cardText = z.string().trim().min(1).max(RetroValidation.maxCardLength);

const actionText = z
  .string()
  .trim()
  .min(1)
  .max(RetroValidation.maxActionLength);

export const RetrosListSchema = BaseSchema.extend({
  body: z.object({}).prefault({}),
});

export type RetrosListReq = z.infer<typeof RetrosListSchema>;

export const RetrosInfoSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type RetrosInfoReq = z.infer<typeof RetrosInfoSchema>;

export const RetrosCreateSchema = BaseSchema.extend({
  body: z.object({
    title,

    /** Column titles, defaults are used when omitted. */
    columns: z
      .array(z.string().trim().min(1).max(RetroValidation.maxColumnTitleLength))
      .min(1)
      .max(RetroValidation.maxColumns)
      .optional(),

    anonymous: z.boolean().optional(),

    votesPerUser: votesPerUser.optional(),

    /** The collection the summary document is written to when closed. */
    collectionId: z.uuid().nullish(),
  }),
});

export type RetrosCreateReq = z.infer<typeof RetrosCreateSchema>;

export const RetrosUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    title: title.optional(),
    phase: z.enum(RetroPhase).optional(),
    anonymous: z.boolean().optional(),
    votesPerUser: votesPerUser.optional(),
    collectionId: z.uuid().nullish(),
  }),
});

export type RetrosUpdateReq = z.infer<typeof RetrosUpdateSchema>;

export const RetrosDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type RetrosDeleteReq = z.infer<typeof RetrosDeleteSchema>;

export const RetroCardsCreateSchema = BaseSchema.extend({
  body: z.object({
    retroId: z.uuid(),
    columnId: z.string().min(1),
    text: cardText,
  }),
});

export type RetroCardsCreateReq = z.infer<typeof RetroCardsCreateSchema>;

export const RetroCardsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    columnId: z.string().min(1).optional(),
    text: cardText.optional(),
  }),
});

export type RetroCardsUpdateReq = z.infer<typeof RetroCardsUpdateSchema>;

export const RetroCardsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type RetroCardsDeleteReq = z.infer<typeof RetroCardsDeleteSchema>;

export const RetroVotesSchema = BaseSchema.extend({
  body: z.object({
    cardId: z.uuid(),
  }),
});

export type RetroVotesReq = z.infer<typeof RetroVotesSchema>;

export const RetroActionsCreateSchema = BaseSchema.extend({
  body: z.object({
    retroId: z.uuid(),
    text: actionText,
    assigneeId: z.uuid().nullish(),
  }),
});

export type RetroActionsCreateReq = z.infer<typeof RetroActionsCreateSchema>;

export const RetroActionsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    text: actionText.optional(),
    assigneeId: z.uuid().nullish(),
    completed: z.boolean().optional(),
  }),
});

export type RetroActionsUpdateReq = z.infer<typeof RetroActionsUpdateSchema>;

export const RetroActionsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type RetroActionsDeleteReq = z.infer<typeof RetroActionsDeleteSchema>;
