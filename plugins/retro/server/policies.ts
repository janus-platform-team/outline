import { Team, User } from "@server/models";
import { allow } from "@server/policies/cancan";
import {
  and,
  isOwner,
  isTeamAdmin,
  isTeamModel,
  isTeamMutable,
  or,
} from "@server/policies/utils";
import { Retro, RetroActionItem, RetroCard } from "./models";

allow(User, ["createRetro", "listRetros"], Team, (actor, team) =>
  and(
    isTeamModel(actor, team),
    isTeamMutable(actor),
    !actor.isGuest,
    !actor.isSuspended
  )
);

allow(User, "read", Retro, (actor, retro) =>
  and(isTeamModel(actor, retro), !actor.isGuest, !actor.isSuspended)
);

allow(User, "participate", Retro, (actor, retro) =>
  and(
    isTeamModel(actor, retro),
    !actor.isGuest,
    !actor.isSuspended,
    !retro?.isClosed
  )
);

allow(User, ["update", "delete"], Retro, (actor, retro) =>
  and(
    isTeamModel(actor, retro),
    !actor.isSuspended,
    or(isOwner(actor, retro), isTeamAdmin(actor, retro))
  )
);

allow(
  User,
  ["update", "delete"],
  RetroCard,
  (actor, card) => !!card && actor.id === card.authorId
);

allow(User, ["update", "delete"], RetroActionItem, (actor, item) =>
  isTeamModel(actor, item?.retro)
);
