import { sequelize } from "@server/storage/database";
import OnCallCalendar from "./OnCallCalendar";
import OnCallOverride from "./OnCallOverride";
import OnCallRotation from "./OnCallRotation";
import OnCallRotationSegment from "./OnCallRotationSegment";

// Plugin models are registered here rather than in the core models barrel so
// that the plugin stays self-contained.
if (!sequelize.isDefined("oncall_calendar")) {
  sequelize.addModels([
    OnCallCalendar,
    OnCallRotation,
    OnCallRotationSegment,
    OnCallOverride,
  ]);
}

export { OnCallCalendar, OnCallOverride, OnCallRotation, OnCallRotationSegment };
