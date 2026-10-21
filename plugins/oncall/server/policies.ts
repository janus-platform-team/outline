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
import { OnCallCalendar } from "./models";

allow(User, "listOnCallCalendars", Team, (actor, team) =>
  and(isTeamModel(actor, team), !actor.isGuest, !actor.isSuspended)
);

allow(User, "createOnCallCalendar", Team, (actor, team) =>
  and(
    isTeamModel(actor, team),
    isTeamMutable(actor),
    !actor.isGuest,
    !actor.isSuspended
  )
);

allow(User, "read", OnCallCalendar, (actor, calendar) =>
  and(isTeamModel(actor, calendar), !actor.isGuest, !actor.isSuspended)
);

allow(User, ["update", "delete"], OnCallCalendar, (actor, calendar) =>
  and(
    isTeamModel(actor, calendar),
    isTeamMutable(actor),
    !actor.isGuest,
    !actor.isSuspended,
    or(isOwner(actor, calendar), isTeamAdmin(actor, calendar))
  )
);
