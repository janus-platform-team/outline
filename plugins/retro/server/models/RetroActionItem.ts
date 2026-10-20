import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import { User } from "@server/models";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { RetroValidation } from "../../shared/types";
import Retro from "./Retro";

@Table({ tableName: "retro_action_items", modelName: "retro_action_item" })
class RetroActionItem extends IdModel<
  InferAttributes<RetroActionItem>,
  Partial<InferCreationAttributes<RetroActionItem>>
> {
  @Length({
    max: RetroValidation.maxActionLength,
    msg: `text must be ${RetroValidation.maxActionLength} characters or less`,
  })
  @Column(DataType.TEXT)
  text: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  completed: boolean;

  // associations

  @BelongsTo(() => Retro, "retroId")
  retro: Retro;

  @ForeignKey(() => Retro)
  @Column(DataType.UUID)
  retroId: string;

  @BelongsTo(() => User, "assigneeId")
  assignee: User | null;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  assigneeId: string | null;
}

export default RetroActionItem;
