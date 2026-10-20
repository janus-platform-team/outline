import type { User } from "@server/models";
import type { RetroColumn } from "../../shared/types";
import { RetroPhase } from "../../shared/types";
import type { RetroBoard } from "../utils/board";
import type { Retro } from "../models";

interface RetroCardPresentation {
  id: string;
  columnId: string;
  text: string;
  authorId: string | null;
  isMine: boolean;
  voteCount: number | null;
  votedByMe: boolean;
  createdAt: Date;
}

interface RetroActionItemPresentation {
  id: string;
  text: string;
  assigneeId: string | null;
  completed: boolean;
  createdAt: Date;
}

interface RetroSummaryPresentation {
  id: string;
  title: string;
  phase: RetroPhase;
  anonymous: boolean;
  votesPerUser: number;
  columns: RetroColumn[];
  collectionId: string | null;
  documentId: string | null;
  createdById: string;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RetroPresentation extends RetroSummaryPresentation {
  cards: RetroCardPresentation[];
  hiddenCardCount: number;
  votesRemaining: number;
  actionItems: RetroActionItemPresentation[];
}

/**
 * Presents a retro without its cards, votes, or action items.
 *
 * @param retro the retro to present.
 * @returns the presented retro.
 */
export function presentRetroSummary(retro: Retro): RetroSummaryPresentation {
  return {
    id: retro.id,
    title: retro.title,
    phase: retro.phase,
    anonymous: retro.anonymous,
    votesPerUser: retro.votesPerUser,
    columns: retro.columns,
    collectionId: retro.collectionId,
    documentId: retro.documentId,
    createdById: retro.createdById,
    closedAt: retro.closedAt,
    createdAt: retro.createdAt,
    updatedAt: retro.updatedAt,
  };
}

/**
 * Presents a retro board for a specific user, applying visibility rules:
 * other users' cards are hidden while brainstorming, authors are hidden when
 * the retro is anonymous, and vote totals are hidden until voting ends.
 *
 * @param board the retro and its cards, votes, and action items.
 * @param user the user the board is being presented to.
 * @returns the presented retro board.
 */
export function presentRetro(
  { retro, cards, votes, actionItems }: RetroBoard,
  user: User
): RetroPresentation {
  const isBrainstorming = retro.phase === RetroPhase.Brainstorm;
  const showVoteTotals =
    retro.phase === RetroPhase.Discuss || retro.phase === RetroPhase.Closed;

  const voteCounts = new Map<string, number>();
  const myVotedCardIds = new Set<string>();

  for (const vote of votes) {
    voteCounts.set(vote.cardId, (voteCounts.get(vote.cardId) ?? 0) + 1);

    if (vote.userId === user.id) {
      myVotedCardIds.add(vote.cardId);
    }
  }

  const visibleCards = isBrainstorming
    ? cards.filter((card) => card.authorId === user.id)
    : cards;

  const presentedCards = visibleCards.map((card) => ({
    id: card.id,
    columnId: card.columnId,
    text: card.text,
    authorId: retro.anonymous ? null : card.authorId,
    isMine: card.authorId === user.id,
    voteCount: showVoteTotals ? (voteCounts.get(card.id) ?? 0) : null,
    votedByMe: myVotedCardIds.has(card.id),
    createdAt: card.createdAt,
  }));

  if (showVoteTotals) {
    presentedCards.sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }

  return {
    ...presentRetroSummary(retro),
    cards: presentedCards,
    hiddenCardCount: cards.length - visibleCards.length,
    votesRemaining: Math.max(0, retro.votesPerUser - myVotedCardIds.size),
    actionItems: actionItems.map((item) => ({
      id: item.id,
      text: item.text,
      assigneeId: item.assigneeId,
      completed: item.completed,
      createdAt: item.createdAt,
    })),
  };
}
