import { Document } from "@server/models";
import {
  buildAdmin,
  buildCollection,
  buildGuestUser,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import type { User } from "@server/models";
import { RetroPhase } from "../../shared/types";

const server = getTestServer();

interface CardResponse {
  id: string;
  columnId: string;
  text: string;
  authorId: string | null;
  isMine: boolean;
  voteCount: number | null;
  votedByMe: boolean;
}

async function createRetro(user: User, body: Record<string, unknown> = {}) {
  const res = await server.post("/api/retros.create", user, {
    body: { title: "Sprint retro", ...body },
  });
  expect(res.status).toEqual(200);
  return (await res.json()).data;
}

async function setPhase(user: User, id: string, phase: RetroPhase) {
  return server.post("/api/retros.update", user, {
    body: { id, phase },
  });
}

async function addCard(
  user: User,
  retroId: string,
  columnId: string,
  text: string
) {
  const res = await server.post("/api/retroCards.create", user, {
    body: { retroId, columnId, text },
  });
  expect(res.status).toEqual(200);
  return (await res.json()).data;
}

async function getRetro(user: User, id: string) {
  const res = await server.post("/api/retros.info", user, { body: { id } });
  return { res, body: await res.json() };
}

describe("#retros.create", () => {
  it("should require authentication", async () => {
    const res = await server.post("/api/retros.create", {
      body: { title: "Retro" },
    });
    expect(res.status).toEqual(401);
  });

  it("should create a retro with default columns", async () => {
    const user = await buildUser();
    const retro = await createRetro(user);

    expect(retro.title).toEqual("Sprint retro");
    expect(retro.phase).toEqual(RetroPhase.Brainstorm);
    expect(retro.columns.length).toEqual(3);
    expect(retro.createdById).toEqual(user.id);
    expect(retro.cards).toEqual([]);
  });

  it("should create a retro with custom columns", async () => {
    const user = await buildUser();
    const retro = await createRetro(user, {
      columns: ["Start", "Stop", "Continue"],
      votesPerUser: 3,
      anonymous: true,
    });

    expect(retro.columns.map((c: { title: string }) => c.title)).toEqual([
      "Start",
      "Stop",
      "Continue",
    ]);
    expect(retro.votesPerUser).toEqual(3);
    expect(retro.anonymous).toEqual(true);
  });

  it("should not allow guests to create retros", async () => {
    const guest = await buildGuestUser();
    const res = await server.post("/api/retros.create", guest, {
      body: { title: "Retro" },
    });
    expect(res.status).toEqual(403);
  });
});

describe("#retros.list", () => {
  it("should only return retros for the user's team", async () => {
    const user = await buildUser();
    const other = await buildUser();
    await createRetro(user, { title: "Mine" });
    await createRetro(other, { title: "Theirs" });

    const res = await server.post("/api/retros.list", user);
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.map((r: { title: string }) => r.title)).toEqual(["Mine"]);
  });
});

describe("#retros.info", () => {
  it("should not allow access from another team", async () => {
    const user = await buildUser();
    const other = await buildUser();
    const retro = await createRetro(user);

    const { res } = await getRetro(other, retro.id);
    expect(res.status).toEqual(403);
  });

  it("should hide other users' cards while brainstorming", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user);
    const columnId = retro.columns[0].id;

    await addCard(user, retro.id, columnId, "Mine");
    await addCard(teammate, retro.id, columnId, "Theirs");

    const { body } = await getRetro(user, retro.id);
    expect(body.data.cards.map((c: CardResponse) => c.text)).toEqual(["Mine"]);
    expect(body.data.hiddenCardCount).toEqual(1);

    await setPhase(user, retro.id, RetroPhase.Vote);

    const { body: revealed } = await getRetro(user, retro.id);
    expect(revealed.data.cards.length).toEqual(2);
    expect(revealed.data.hiddenCardCount).toEqual(0);
  });

  it("should hide authors when anonymous", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user, { anonymous: true });
    const columnId = retro.columns[0].id;

    await addCard(teammate, retro.id, columnId, "Theirs");
    await setPhase(user, retro.id, RetroPhase.Vote);

    const { body } = await getRetro(user, retro.id);
    expect(body.data.cards[0].authorId).toBeNull();
    expect(body.data.cards[0].isMine).toEqual(false);

    const { body: own } = await getRetro(teammate, retro.id);
    expect(own.data.cards[0].authorId).toBeNull();
    expect(own.data.cards[0].isMine).toEqual(true);
  });

  it("should include authors when not anonymous", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user, { anonymous: false });

    await addCard(teammate, retro.id, retro.columns[0].id, "Theirs");
    await setPhase(user, retro.id, RetroPhase.Vote);

    const { body } = await getRetro(user, retro.id);
    expect(body.data.cards[0].authorId).toEqual(teammate.id);
  });
});

describe("#retros.update", () => {
  it("should only allow the facilitator or an admin to change phase", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const admin = await buildAdmin({ teamId: user.teamId });
    const retro = await createRetro(user);

    const denied = await setPhase(teammate, retro.id, RetroPhase.Vote);
    expect(denied.status).toEqual(403);

    const allowed = await setPhase(admin, retro.id, RetroPhase.Vote);
    expect(allowed.status).toEqual(200);
    expect((await allowed.json()).data.phase).toEqual(RetroPhase.Vote);
  });

  it("should not allow an anonymous retro with cards to be made public", async () => {
    const user = await buildUser();
    const retro = await createRetro(user, { anonymous: true });
    await addCard(user, retro.id, retro.columns[0].id, "Card");

    const res = await server.post("/api/retros.update", user, {
      body: { id: retro.id, anonymous: false },
    });
    expect(res.status).toEqual(400);
  });

  it("should require a collection before closing", async () => {
    const user = await buildUser();
    const retro = await createRetro(user);

    const res = await setPhase(user, retro.id, RetroPhase.Closed);
    expect(res.status).toEqual(400);
  });

  it("should publish a summary document when closed", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const collection = await buildCollection({
      teamId: user.teamId,
      userId: user.id,
    });
    const retro = await createRetro(user, {
      collectionId: collection.id,
      anonymous: false,
    });
    const columnId = retro.columns[0].id;

    await addCard(teammate, retro.id, columnId, "Fast reviews");
    await server.post("/api/retroActions.create", user, {
      body: { retroId: retro.id, text: "Keep it up", assigneeId: teammate.id },
    });

    const res = await setPhase(user, retro.id, RetroPhase.Closed);
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.phase).toEqual(RetroPhase.Closed);
    expect(body.data.documentId).toBeTruthy();
    expect(body.data.closedAt).toBeTruthy();

    const document = await Document.findByPk(body.data.documentId, {
      rejectOnEmpty: true,
    });
    expect(document.title).toEqual("Sprint retro");
    expect(document.collectionId).toEqual(collection.id);
    expect(document.publishedAt).toBeTruthy();
    expect(document.text).toContain("Fast reviews");
    expect(document.text).toContain(teammate.name);
    expect(document.text).toContain("Keep it up");
  });

  it("should not allow changes once closed", async () => {
    const user = await buildUser();
    const collection = await buildCollection({
      teamId: user.teamId,
      userId: user.id,
    });
    const retro = await createRetro(user, { collectionId: collection.id });
    await setPhase(user, retro.id, RetroPhase.Closed);

    const res = await setPhase(user, retro.id, RetroPhase.Vote);
    expect(res.status).toEqual(400);

    const card = await server.post("/api/retroCards.create", user, {
      body: { retroId: retro.id, columnId: retro.columns[0].id, text: "x" },
    });
    expect(card.status).toEqual(403);
  });
});

describe("#retros.delete", () => {
  it("should only allow the facilitator to delete", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user);

    const denied = await server.post("/api/retros.delete", teammate, {
      body: { id: retro.id },
    });
    expect(denied.status).toEqual(403);

    const res = await server.post("/api/retros.delete", user, {
      body: { id: retro.id },
    });
    expect(res.status).toEqual(200);

    const { res: info } = await getRetro(user, retro.id);
    expect(info.status).toEqual(404);
  });
});

describe("#retroCards", () => {
  it("should reject cards for unknown columns", async () => {
    const user = await buildUser();
    const retro = await createRetro(user);

    const res = await server.post("/api/retroCards.create", user, {
      body: { retroId: retro.id, columnId: "missing", text: "Card" },
    });
    expect(res.status).toEqual(400);
  });

  it("should only allow cards to be added while brainstorming", async () => {
    const user = await buildUser();
    const retro = await createRetro(user);
    await setPhase(user, retro.id, RetroPhase.Vote);

    const res = await server.post("/api/retroCards.create", user, {
      body: { retroId: retro.id, columnId: retro.columns[0].id, text: "Card" },
    });
    expect(res.status).toEqual(400);
  });

  it("should only allow authors to edit their cards", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user);
    const board = await addCard(teammate, retro.id, retro.columns[0].id, "a");
    const cardId = board.cards[0].id;

    const denied = await server.post("/api/retroCards.update", user, {
      body: { id: cardId, text: "b" },
    });
    expect(denied.status).toEqual(403);

    const res = await server.post("/api/retroCards.update", teammate, {
      body: { id: cardId, text: "b" },
    });
    expect(res.status).toEqual(200);
    expect((await res.json()).data.cards[0].text).toEqual("b");
  });

  it("should allow the facilitator to remove any card", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user);
    const board = await addCard(teammate, retro.id, retro.columns[0].id, "a");
    await setPhase(user, retro.id, RetroPhase.Vote);

    const res = await server.post("/api/retroCards.delete", user, {
      body: { id: board.cards[0].id },
    });
    expect(res.status).toEqual(200);
    expect((await res.json()).data.cards).toEqual([]);
  });
});

describe("#retroVotes", () => {
  it("should enforce the vote limit and hide totals until discussion", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const retro = await createRetro(user, { votesPerUser: 1 });
    const columnId = retro.columns[0].id;

    await addCard(user, retro.id, columnId, "One");
    const board = await addCard(user, retro.id, columnId, "Two");
    const [first, second] = board.cards;

    const early = await server.post("/api/retroVotes.create", teammate, {
      body: { cardId: first.id },
    });
    expect(early.status).toEqual(400);

    await setPhase(user, retro.id, RetroPhase.Vote);

    const vote = await server.post("/api/retroVotes.create", teammate, {
      body: { cardId: first.id },
    });
    const voteBody = await vote.json();
    expect(vote.status).toEqual(200);
    expect(voteBody.data.votesRemaining).toEqual(0);
    expect(
      voteBody.data.cards.find((c: CardResponse) => c.id === first.id)
    ).toMatchObject({ votedByMe: true, voteCount: null });

    const overLimit = await server.post("/api/retroVotes.create", teammate, {
      body: { cardId: second.id },
    });
    expect(overLimit.status).toEqual(400);

    await setPhase(user, retro.id, RetroPhase.Discuss);

    const { body } = await getRetro(user, retro.id);
    expect(body.data.cards[0]).toMatchObject({ id: first.id, voteCount: 1 });
    expect(body.data.cards[1]).toMatchObject({ id: second.id, voteCount: 0 });
  });

  it("should not allow voting twice for the same card", async () => {
    const user = await buildUser();
    const retro = await createRetro(user);
    const board = await addCard(user, retro.id, retro.columns[0].id, "One");
    await setPhase(user, retro.id, RetroPhase.Vote);

    const body = { cardId: board.cards[0].id };
    expect(
      (await server.post("/api/retroVotes.create", user, { body })).status
    ).toEqual(200);
    expect(
      (await server.post("/api/retroVotes.create", user, { body })).status
    ).toEqual(400);

    const removed = await server.post("/api/retroVotes.delete", user, {
      body,
    });
    expect((await removed.json()).data.cards[0].votedByMe).toEqual(false);
  });
});

describe("#retroActions", () => {
  it("should reject assignees from another team", async () => {
    const user = await buildUser();
    const other = await buildUser();
    const retro = await createRetro(user);

    const res = await server.post("/api/retroActions.create", user, {
      body: { retroId: retro.id, text: "Do it", assigneeId: other.id },
    });
    expect(res.status).toEqual(400);
  });

  it("should allow completing action items after the retro closes", async () => {
    const user = await buildUser();
    const teammate = await buildUser({ teamId: user.teamId });
    const collection = await buildCollection({
      teamId: user.teamId,
      userId: user.id,
    });
    const retro = await createRetro(user, { collectionId: collection.id });
    const created = await server.post("/api/retroActions.create", user, {
      body: { retroId: retro.id, text: "Do it" },
    });
    const itemId = (await created.json()).data.actionItems[0].id;
    await setPhase(user, retro.id, RetroPhase.Closed);

    const complete = await server.post("/api/retroActions.update", teammate, {
      body: { id: itemId, completed: true },
    });
    expect(complete.status).toEqual(200);
    expect((await complete.json()).data.actionItems[0].completed).toEqual(true);

    const edit = await server.post("/api/retroActions.update", teammate, {
      body: { id: itemId, text: "Changed" },
    });
    expect(edit.status).toEqual(403);
  });
});
