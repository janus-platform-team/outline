import { Second } from "@shared/utils/time";
import fetch from "@server/utils/fetch";

interface SlackMessage {
  /** The fallback text shown in notifications. */
  text: string;
  /** Block Kit blocks rendered in the message. */
  blocks?: object[];
}

/**
 * Posts a message to a Slack incoming webhook.
 *
 * @param url the incoming webhook URL.
 * @param message the message to post.
 * @throws if Slack responds with an error.
 */
export async function postSlackMessage(url: string, message: SlackMessage) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
    timeout: 10 * Second.ms,
  });

  if (!res.ok) {
    throw new Error(`Slack webhook responded with ${res.status}`);
  }
}
