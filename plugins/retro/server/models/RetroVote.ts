import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import { User } from "@server/models";
import IdModel from "@server/models/base/IdModel";
import Retro from "./Retro";
import RetroCard from "./RetroCard";

@Table({ tableName: "retro_votes", modelName: "retro_vote" })
class RetroVote extends IdModel<
  InferAttributes<RetroVote>,
  Partial<InferCreationAttributes<RetroVote>>
> {
  // associations

  @BelongsTo(() => Retro, "retroId")
  retro: Retro;

  @ForeignKey(() => Retro)
  @Column(DataType.UUID)
  retroId: string;

  @BelongsTo(() => RetroCard, "cardId")
  card: RetroCard;

  @ForeignKey(() => RetroCard)
  @Column(DataType.UUID)
  cardId: string;

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;
}

export default RetroVote;
