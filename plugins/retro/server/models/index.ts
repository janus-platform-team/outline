import { sequelize } from "@server/storage/database";
import Retro from "./Retro";
import RetroActionItem from "./RetroActionItem";
import RetroCard from "./RetroCard";
import RetroVote from "./RetroVote";

// Plugin models are registered here rather than in the core models barrel so
// that the plugin stays self-contained.
if (!sequelize.isDefined("retro")) {
  sequelize.addModels([Retro, RetroCard, RetroVote, RetroActionItem]);
}

export { Retro, RetroActionItem, RetroCard, RetroVote };
