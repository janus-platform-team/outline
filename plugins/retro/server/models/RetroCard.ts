import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from "sequelize-typescript";
import { User } from "@server/models";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { RetroValidation } from "../../shared/types";
import Retro from "./Retro";
import RetroVote from "./RetroVote";

@Table({ tableName: "retro_cards", modelName: "retro_card" })
class RetroCard extends IdModel<
  InferAttributes<RetroCard>,
  Partial<InferCreationAttributes<RetroCard>>
> {
  @Column(DataType.STRING)
  columnId: string;

  @Length({
    max: RetroValidation.maxCardLength,
    msg: `text must be ${RetroValidation.maxCardLength} characters or less`,
  })
  @Column(DataType.TEXT)
  text: string;

  // associations

  @BelongsTo(() => Retro, "retroId")
  retro: Retro;

  @ForeignKey(() => Retro)
  @Column(DataType.UUID)
  retroId: string;

  @BelongsTo(() => User, "authorId")
  author: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  authorId: string;

  @HasMany(() => RetroVote, "cardId")
  votes: RetroVote[];
}

export default RetroCard;
