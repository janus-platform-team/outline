import { escape } from "@shared/utils/markdown";
import type { User } from "@server/models";
import type { RetroBoard } from "./board";

/**
 * Builds the markdown body of the summary document written when a retro is
 * closed. Cards are grouped by column and ordered by votes, authors are only
 * included when the retro is not anonymous.
 *
 * @param board the closed retro board.
 * @param users the users referenced by cards and action items, keyed by id.
 * @returns the markdown summary.
 */
export function buildRetroSummary(
  { retro, cards, votes, actionItems }: RetroBoard,
  users: Map<string, User>
): string {
  const voteCounts = new Map<string, number>();

  for (const vote of votes) {
    voteCounts.set(vote.cardId, (voteCounts.get(vote.cardId) ?? 0) + 1);
  }

  const lines: string[] = [];

  for (const column of retro.columns) {
    lines.push(`## ${escape(column.title)}`, "");

    const columnCards = cards
      .filter((card) => card.columnId === column.id)
      .sort(
        (a, b) => (voteCounts.get(b.id) ?? 0) - (voteCounts.get(a.id) ?? 0)
      );

    if (columnCards.length === 0) {
      lines.push("_No cards_", "");
      continue;
    }

    for (const card of columnCards) {
      const count = voteCounts.get(card.id) ?? 0;
      const author = retro.anonymous ? undefined : users.get(card.authorId);
      const details = [
        count === 1 ? "1 vote" : `${count} votes`,
        author ? escape(author.name) : undefined,
      ].filter(Boolean);

      lines.push(`- ${escapeInline(card.text)} (${details.join(", ")})`);
    }

    lines.push("");
  }

  lines.push("## Action items", "");

  if (actionItems.length === 0) {
    lines.push("_No action items_", "");
  }

  for (const item of actionItems) {
    const assignee = item.assigneeId ? users.get(item.assigneeId) : undefined;
    const suffix = assignee ? ` (${escape(assignee.name)})` : "";
    lines.push(
      `- [${item.completed ? "x" : " "}] ${escapeInline(item.text)}${suffix}`
    );
  }

  return lines.join("\n").trim();
}

function escapeInline(text: string) {
  return escape(text.replace(/\s*\n+\s*/g, " "));
}
