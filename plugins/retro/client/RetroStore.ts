import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import { client } from "~/utils/ApiClient";
import { AuthorizationError, NotFoundError } from "~/utils/errors";
import type { RetroPhase } from "../shared/types";
import type { RetroBoardData, RetroSummary } from "./types";

interface CreateRetroParams {
  title: string;
  columns?: string[];
  anonymous?: boolean;
  votesPerUser?: number;
  collectionId?: string | null;
}

interface UpdateRetroParams {
  title?: string;
  phase?: RetroPhase;
  anonymous?: boolean;
  votesPerUser?: number;
  collectionId?: string | null;
}

interface UpdateActionParams {
  text?: string;
  assigneeId?: string | null;
  completed?: boolean;
}

/**
 * Client state for retros. Kept outside of the root store so that the plugin
 * remains self-contained.
 */
export class RetroStore {
  /** Retros shown in the list, keyed by id. */
  summaries = observable.map<string, RetroSummary>();

  /** Boards that have been loaded, keyed by retro id. */
  boards = observable.map<string, RetroBoardData>();

  /** Ids of retros that could not be found, keyed by id. */
  notFound = observable.map<string, boolean>();

  /** Whether the list has been fetched at least once. */
  isLoaded = false;

  constructor() {
    makeObservable(this, {
      isLoaded: observable,
      orderedSummaries: computed,
      setBoard: action,
      remove: action,
    });
  }

  /** Retros ordered from newest to oldest. */
  get orderedSummaries(): RetroSummary[] {
    return Array.from(this.summaries.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  /**
   * Fetches the retros for the current team.
   */
  fetchList = async () => {
    const res = await client.post<{ data: RetroSummary[] }>("/retros.list", {
      limit: 100,
    });

    runInAction(() => {
      res.data.forEach((retro) => this.summaries.set(retro.id, retro));
      this.isLoaded = true;
    });
  };

  /**
   * Fetches a retro board.
   *
   * @param id the id of the retro.
   * @returns the board.
   */
  fetch = async (id: string) =>
    this.request("/retros.info", { id }).catch((err) => {
      if (err instanceof NotFoundError || err instanceof AuthorizationError) {
        this.remove(id);
        runInAction(() => this.notFound.set(id, true));
      }
      throw err;
    });

  /**
   * Creates a retro.
   *
   * @param params the retro attributes.
   * @returns the created board.
   */
  create = (params: CreateRetroParams) =>
    this.request("/retros.create", { ...params });

  /**
   * Updates a retro, including moving it to another phase.
   *
   * @param id the id of the retro.
   * @param params the attributes to change.
   * @returns the updated board.
   */
  update = (id: string, params: UpdateRetroParams) =>
    this.request("/retros.update", { id, ...params });

  /**
   * Deletes a retro.
   *
   * @param id the id of the retro.
   */
  delete = async (id: string) => {
    await client.post("/retros.delete", { id });
    this.remove(id);
  };

  addCard = (retroId: string, columnId: string, text: string) =>
    this.request("/retroCards.create", { retroId, columnId, text });

  updateCard = (id: string, text: string) =>
    this.request("/retroCards.update", { id, text });

  deleteCard = (id: string) => this.request("/retroCards.delete", { id });

  vote = (cardId: string) => this.request("/retroVotes.create", { cardId });

  unvote = (cardId: string) => this.request("/retroVotes.delete", { cardId });

  addAction = (retroId: string, text: string, assigneeId?: string | null) =>
    this.request("/retroActions.create", { retroId, text, assigneeId });

  updateAction = (id: string, params: UpdateActionParams) =>
    this.request("/retroActions.update", { id, ...params });

  deleteAction = (id: string) => this.request("/retroActions.delete", { id });

  setBoard(board: RetroBoardData) {
    this.boards.set(board.id, board);

    const { cards, hiddenCardCount, votesRemaining, actionItems, ...summary } =
      board;
    this.summaries.set(board.id, summary);
  }

  remove(id: string) {
    this.boards.delete(id);
    this.summaries.delete(id);
  }

  private request = async (
    path: string,
    body: Record<
      string,
      string | number | boolean | string[] | null | undefined
    >
  ) => {
    const res = await client.post<{ data: RetroBoardData }>(path, body);
    this.setBoard(res.data);
    return res.data;
  };
}

export const retroStore = new RetroStore();
