import { Emitter } from "@socket.io/redis-emitter";
import { toError } from "@shared/utils/error";
import Logger from "@server/logging/Logger";
import Redis from "@server/storage/redis";
import type { OnCallUpdatePayload } from "../shared/types";
import { OnCallUpdateEvent } from "../shared/types";

let emitter: Emitter | undefined;

function getEmitter() {
  if (!emitter) {
    emitter = new Emitter(Redis.defaultClient);
  }
  return emitter;
}

/**
 * Notifies connected team members that a calendar changed so that their
 * clients, including embeds in documents, refetch it.
 *
 * @param teamId the id of the team the calendar belongs to.
 * @param calendarId the id of the calendar that changed.
 */
export function emitOnCallUpdate(teamId: string, calendarId: string) {
  const payload: OnCallUpdatePayload = { calendarId };

  try {
    getEmitter().to(`team-${teamId}.members`).emit(OnCallUpdateEvent, payload);
  } catch (err) {
    Logger.error("Failed to emit on-call update", toError(err), {
      teamId,
      calendarId,
    });
  }
}
