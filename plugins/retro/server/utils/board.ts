import type { Transaction } from "sequelize";
import type { Retro } from "../models";
import { RetroActionItem, RetroCard, RetroVote } from "../models";

/** A retro together with everything shown on its board. */
export interface RetroBoard {
  retro: Retro;
  cards: RetroCard[];
  votes: RetroVote[];
  actionItems: RetroActionItem[];
}

/**
 * Loads the cards, votes, and action items for a retro.
 *
 * @param retro the retro to load the board for.
 * @param transaction an optional transaction to read within.
 * @returns the retro board.
 */
export async function loadRetroBoard(
  retro: Retro,
  transaction?: Transaction
): Promise<RetroBoard> {
  // Queries run sequentially as a transaction holds a single connection.
  const cards = await RetroCard.findAll({
    where: { retroId: retro.id },
    order: [["createdAt", "ASC"]],
    transaction,
  });
  const votes = await RetroVote.findAll({
    where: { retroId: retro.id },
    transaction,
  });
  const actionItems = await RetroActionItem.findAll({
    where: { retroId: retro.id },
    order: [["createdAt", "ASC"]],
    transaction,
  });

  return { retro, cards, votes, actionItems };
}
