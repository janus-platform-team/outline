import { Emitter } from "@socket.io/redis-emitter";
import { toError } from "@shared/utils/error";
import Logger from "@server/logging/Logger";
import Redis from "@server/storage/redis";
import type { RetroUpdatePayload } from "../shared/types";
import { RetroUpdateEvent } from "../shared/types";

let emitter: Emitter | undefined;

function getEmitter() {
  if (!emitter) {
    emitter = new Emitter(Redis.defaultClient).of("/realtime");
  }
  return emitter;
}

/**
 * Notifies connected team members that a retro changed so that their clients
 * refetch it. Only the id is sent as every user sees a different view of the
 * board.
 *
 * @param teamId the id of the team the retro belongs to.
 * @param retroId the id of the retro that changed.
 */
export function emitRetroUpdate(teamId: string, retroId: string) {
  const payload: RetroUpdatePayload = { retroId };

  try {
    getEmitter().to(`team-${teamId}.members`).emit(RetroUpdateEvent, payload);
  } catch (err) {
    Logger.error("Failed to emit retro update", toError(err), { teamId, retroId });
  }
}
