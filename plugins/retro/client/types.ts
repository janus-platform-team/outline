import type { RetroColumn, RetroPhase } from "../shared/types";

/** A retro as returned by `retros.list`. */
export interface RetroSummary {
  id: string;
  title: string;
  phase: RetroPhase;
  anonymous: boolean;
  votesPerUser: number;
  columns: RetroColumn[];
  collectionId: string | null;
  documentId: string | null;
  createdById: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A card on a retro board, as visible to the current user. */
export interface RetroCardData {
  id: string;
  columnId: string;
  text: string;
  authorId: string | null;
  isMine: boolean;
  voteCount: number | null;
  votedByMe: boolean;
  createdAt: string;
}

/** An action item recorded during a retro. */
export interface RetroActionItemData {
  id: string;
  text: string;
  assigneeId: string | null;
  completed: boolean;
  createdAt: string;
}

/** A retro board as returned by `retros.info` and all mutations. */
export interface RetroBoardData extends RetroSummary {
  cards: RetroCardData[];
  hiddenCardCount: number;
  votesRemaining: number;
  actionItems: RetroActionItemData[];
}
