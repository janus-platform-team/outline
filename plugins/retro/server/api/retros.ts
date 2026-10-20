import { randomUUID } from "node:crypto";
import Router from "@koa/router";
import { Op, UniqueConstraintError } from "sequelize";
import { InvalidRequestError, ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import documentCreator, {
  authorizeDocumentCreate,
} from "@server/commands/documentCreator";
import { Collection, User } from "@server/models";
import { authorize, can } from "@server/policies";
import pagination, {
  paginateQuery,
} from "@server/routes/api/middlewares/pagination";
import type { APIContext } from "@server/types";
import type { RetroColumn } from "../../shared/types";
import { DefaultRetroColumns, RetroPhase } from "../../shared/types";
import { Retro, RetroActionItem, RetroCard, RetroVote } from "../models";
import { presentRetro, presentRetroSummary } from "../presenters/retro";
import { emitRetroUpdate } from "../realtime";
import { loadRetroBoard } from "../utils/board";
import { buildRetroSummary } from "../utils/summary";
import * as T from "./schema";

const router = new Router();

router.post(
  "retros.list",
  auth(),
  pagination(),
  validate(T.RetrosListSchema),
  async (ctx: APIContext<T.RetrosListReq>) => {
    const { user } = ctx.state.auth;
    authorize(user, "listRetros", user.team);

    const where = { teamId: user.teamId };
    const { results, pagination } = await paginateQuery(
      ctx,
      (opts) =>
        Retro.findAll({
          where,
          order: [["createdAt", "DESC"]],
          offset: opts.offset,
          limit: opts.limit,
        }),
      () => Retro.count({ where })
    );

    ctx.body = {
      pagination,
      data: results.map(presentRetroSummary),
    };
  }
);

router.post(
  "retros.info",
  auth(),
  validate(T.RetrosInfoSchema),
  async (ctx: APIContext<T.RetrosInfoReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;

    const retro = await Retro.findByPk(id, { rejectOnEmpty: true });
    authorize(user, "read", retro);

    ctx.body = {
      data: presentRetro(await loadRetroBoard(retro), user),
    };
  }
);

router.post(
  "retros.create",
  auth(),
  validate(T.RetrosCreateSchema),
  transaction(),
  async (ctx: APIContext<T.RetrosCreateReq>) => {
    const { title, columns, anonymous, votesPerUser, collectionId } =
      ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    authorize(user, "createRetro", user.team);

    if (collectionId) {
      await authorizeCollection(ctx, collectionId);
    }

    const retroColumns: RetroColumn[] = columns
      ? columns.map((columnTitle) => ({
          id: randomUUID(),
          title: columnTitle,
        }))
      : DefaultRetroColumns;

    const retro = await Retro.create(
      {
        title,
        columns: retroColumns,
        anonymous,
        votesPerUser,
        collectionId,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retros.update",
  auth(),
  validate(T.RetrosUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.RetrosUpdateReq>) => {
    const { id, title, phase, anonymous, votesPerUser, collectionId } =
      ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const retro = await Retro.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "update", retro);
    assertOpen(retro);

    if (anonymous === false && retro.anonymous) {
      const cardCount = await RetroCard.count({
        where: { retroId: retro.id },
        transaction,
      });

      if (cardCount > 0) {
        throw ValidationError(
          "An anonymous retro cannot be made public once cards are added"
        );
      }
    }

    if (collectionId) {
      await authorizeCollection(ctx, collectionId);
    }

    retro.set({
      title: title ?? retro.title,
      anonymous: anonymous ?? retro.anonymous,
      votesPerUser: votesPerUser ?? retro.votesPerUser,
      collectionId:
        collectionId !== undefined ? collectionId : retro.collectionId,
    });

    if (phase === RetroPhase.Closed) {
      await closeRetro(ctx, retro);
    } else if (phase) {
      retro.phase = phase;
    }

    await retro.save({ transaction });
    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retros.delete",
  auth(),
  validate(T.RetrosDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.RetrosDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const retro = await Retro.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "delete", retro);

    await retro.destroy({ transaction });
    transaction.afterCommit(() => emitRetroUpdate(retro.teamId, retro.id));

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "retroCards.create",
  auth(),
  validate(T.RetroCardsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.RetroCardsCreateReq>) => {
    const { retroId, columnId, text } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const retro = await Retro.findByPk(retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "participate", retro);
    assertPhase(retro, RetroPhase.Brainstorm);
    assertColumn(retro, columnId);

    await RetroCard.create(
      {
        retroId: retro.id,
        authorId: user.id,
        columnId,
        text,
      },
      { transaction }
    );

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroCards.update",
  auth(),
  validate(T.RetroCardsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.RetroCardsUpdateReq>) => {
    const { id, columnId, text } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const card = await RetroCard.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const retro = await Retro.findByPk(card.retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "participate", retro);
    authorize(user, "update", card);
    assertPhase(retro, RetroPhase.Brainstorm);

    if (columnId) {
      assertColumn(retro, columnId);
    }

    await card.update(
      {
        columnId: columnId ?? card.columnId,
        text: text ?? card.text,
      },
      { transaction }
    );

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroCards.delete",
  auth(),
  validate(T.RetroCardsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.RetroCardsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const card = await RetroCard.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const retro = await Retro.findByPk(card.retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "participate", retro);

    // Facilitators may remove any card to moderate the board, authors may
    // only remove their own cards while brainstorming.
    if (!can(user, "update", retro)) {
      authorize(user, "delete", card);
      assertPhase(retro, RetroPhase.Brainstorm);
    }

    await card.destroy({ transaction });
    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroVotes.create",
  auth(),
  validate(T.RetroVotesSchema),
  transaction(),
  async (ctx: APIContext<T.RetroVotesReq>) => {
    const { cardId } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const card = await RetroCard.findByPk(cardId, {
      rejectOnEmpty: true,
      transaction,
    });

    // Lock the retro row so that concurrent votes cannot exceed the limit.
    const retro = await Retro.findByPk(card.retroId, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    authorize(user, "participate", retro);
    assertPhase(retro, RetroPhase.Vote);

    const voteCount = await RetroVote.count({
      where: { retroId: retro.id, userId: user.id },
      transaction,
    });

    if (voteCount >= retro.votesPerUser) {
      throw ValidationError("You have no votes remaining");
    }

    try {
      await RetroVote.create(
        {
          retroId: retro.id,
          cardId: card.id,
          userId: user.id,
        },
        { transaction }
      );
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw ValidationError("You have already voted for this card");
      }
      throw err;
    }

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroVotes.delete",
  auth(),
  validate(T.RetroVotesSchema),
  transaction(),
  async (ctx: APIContext<T.RetroVotesReq>) => {
    const { cardId } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const card = await RetroCard.findByPk(cardId, {
      rejectOnEmpty: true,
      transaction,
    });
    const retro = await Retro.findByPk(card.retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "participate", retro);
    assertPhase(retro, RetroPhase.Vote);

    await RetroVote.destroy({
      where: { cardId: card.id, userId: user.id },
      transaction,
    });

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroActions.create",
  auth(),
  validate(T.RetroActionsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.RetroActionsCreateReq>) => {
    const { retroId, text, assigneeId } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const retro = await Retro.findByPk(retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    authorize(user, "participate", retro);

    if (assigneeId) {
      await assertTeamUser(ctx, assigneeId);
    }

    await RetroActionItem.create(
      {
        retroId: retro.id,
        text,
        assigneeId,
      },
      { transaction }
    );

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroActions.update",
  auth(),
  validate(T.RetroActionsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.RetroActionsUpdateReq>) => {
    const { id, text, assigneeId, completed } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const item = await RetroActionItem.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const retro = await Retro.findByPk(item.retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    item.retro = retro;
    authorize(user, "read", retro);
    authorize(user, "update", item);

    // Once closed only completion can change, so that action items can still
    // be ticked off after the retro.
    if (text !== undefined || assigneeId !== undefined) {
      authorize(user, "participate", retro);
    }

    if (assigneeId) {
      await assertTeamUser(ctx, assigneeId);
    }

    await item.update(
      {
        text: text ?? item.text,
        assigneeId: assigneeId !== undefined ? assigneeId : item.assigneeId,
        completed: completed ?? item.completed,
      },
      { transaction }
    );

    await respondWithBoard(ctx, retro);
  }
);

router.post(
  "retroActions.delete",
  auth(),
  validate(T.RetroActionsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.RetroActionsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const item = await RetroActionItem.findByPk(id, {
      rejectOnEmpty: true,
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    const retro = await Retro.findByPk(item.retroId, {
      rejectOnEmpty: true,
      transaction,
    });
    item.retro = retro;
    authorize(user, "participate", retro);
    authorize(user, "delete", item);

    await item.destroy({ transaction });
    await respondWithBoard(ctx, retro);
  }
);

/**
 * Responds with the board as seen by the acting user and notifies other team
 * members once the transaction commits.
 */
async function respondWithBoard(ctx: APIContext, retro: Retro) {
  const { user } = ctx.state.auth;
  const { transaction } = ctx.state;

  transaction.afterCommit(() => emitRetroUpdate(retro.teamId, retro.id));

  ctx.body = {
    data: presentRetro(await loadRetroBoard(retro, transaction), user),
  };
}

/**
 * Closes the retro and writes the summary document into its collection.
 */
async function closeRetro(ctx: APIContext, retro: Retro) {
  const { transaction } = ctx.state;

  if (!retro.collectionId) {
    throw ValidationError(
      "Choose a collection for the summary before closing the retro"
    );
  }

  await authorizeDocumentCreate(ctx, { collectionId: retro.collectionId });

  const board = await loadRetroBoard(retro, transaction);
  const userIds = new Set<string>();

  for (const card of board.cards) {
    userIds.add(card.authorId);
  }

  for (const item of board.actionItems) {
    if (item.assigneeId) {
      userIds.add(item.assigneeId);
    }
  }

  const users = await User.findAll({
    where: { id: { [Op.in]: [...userIds] }, teamId: retro.teamId },
    transaction,
  });

  const document = await documentCreator(ctx, {
    title: retro.title,
    text: buildRetroSummary(board, new Map(users.map((u) => [u.id, u]))),
    collectionId: retro.collectionId,
    publish: true,
  });

  retro.set({
    phase: RetroPhase.Closed,
    documentId: document.id,
    closedAt: new Date(),
  });
}

async function authorizeCollection(ctx: APIContext, collectionId: string) {
  const { user } = ctx.state.auth;
  const collection = await Collection.findByPk(collectionId, {
    userId: user.id,
    transaction: ctx.state.transaction,
  });
  authorize(user, "createDocument", collection);
}

async function assertTeamUser(ctx: APIContext, userId: string) {
  const { user } = ctx.state.auth;
  const assignee = await User.findOne({
    where: { id: userId, teamId: user.teamId },
    transaction: ctx.state.transaction,
  });

  if (!assignee) {
    throw ValidationError("Assignee must be a member of the team");
  }
}

function assertOpen(retro: Retro) {
  if (retro.isClosed) {
    throw InvalidRequestError("This retro is closed");
  }
}

function assertPhase(retro: Retro, phase: RetroPhase) {
  if (retro.phase !== phase) {
    throw InvalidRequestError(`This action is only available during ${phase}`);
  }
}

function assertColumn(retro: Retro, columnId: string) {
  if (!retro.columns.some((column) => column.id === columnId)) {
    throw ValidationError("Column does not exist on this retro");
  }
}

export default router;
