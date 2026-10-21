import type { User } from "@server/models";
import { RetroPhase } from "../../shared/types";
import type { Retro, RetroCard, RetroVote } from "../models";
import type { RetroBoard } from "../utils/board";
import { presentRetro } from "./retro";

const me = { id: "user-1" } as User;

function buildBoard(
  phase: RetroPhase,
  { anonymous = false }: { anonymous?: boolean } = {}
): RetroBoard {
  const retro = {
    id: "retro-1",
    title: "Retro",
    phase,
    anonymous,
    votesPerUser: 3,
    columns: [{ id: "col", title: "Column" }],
    createdById: me.id,
  } as Retro;

  const cards = [
    { id: "card-1", columnId: "col", text: "Mine", authorId: me.id },
    { id: "card-2", columnId: "col", text: "Theirs", authorId: "user-2" },
  ] as RetroCard[];

  const votes = [
    { cardId: "card-2", userId: me.id },
    { cardId: "card-2", userId: "user-2" },
    { cardId: "card-1", userId: "user-3" },
  ] as RetroVote[];

  return { retro, cards, votes, actionItems: [] };
}

describe("presentRetro", () => {
  it("only includes the user's own cards while brainstorming", () => {
    const result = presentRetro(buildBoard(RetroPhase.Brainstorm), me);

    expect(result.cards.map((card) => card.id)).toEqual(["card-1"]);
    expect(result.hiddenCardCount).toEqual(1);
  });

  it("hides vote totals while voting but shows the user's votes", () => {
    const result = presentRetro(buildBoard(RetroPhase.Vote), me);

    expect(result.cards.map((card) => card.voteCount)).toEqual([null, null]);
    expect(result.cards.find((card) => card.id === "card-2")?.votedByMe).toBe(
      true
    );
    expect(result.votesRemaining).toEqual(2);
  });

  it("shows vote totals sorted by votes once discussing", () => {
    const result = presentRetro(buildBoard(RetroPhase.Discuss), me);

    expect(result.cards.map((card) => [card.id, card.voteCount])).toEqual([
      ["card-2", 2],
      ["card-1", 1],
    ]);
  });

  it("removes authors when anonymous", () => {
    const result = presentRetro(
      buildBoard(RetroPhase.Discuss, { anonymous: true }),
      me
    );

    expect(result.cards.every((card) => card.authorId === null)).toBe(true);
    expect(result.cards.find((card) => card.id === "card-1")?.isMine).toBe(
      true
    );
  });

  it("includes authors when not anonymous", () => {
    const result = presentRetro(buildBoard(RetroPhase.Vote), me);

    expect(result.cards.map((card) => card.authorId)).toEqual([
      me.id,
      "user-2",
    ]);
  });
});
