import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsIn,
  Table,
} from "sequelize-typescript";
import { Collection, Document, Team, User } from "@server/models";
import ParanoidModel from "@server/models/base/ParanoidModel";
import Length from "@server/models/validators/Length";
import type { RetroColumn } from "../../shared/types";
import { RetroPhase, RetroValidation } from "../../shared/types";
import RetroActionItem from "./RetroActionItem";
import RetroCard from "./RetroCard";
import RetroVote from "./RetroVote";

@Table({ tableName: "retros", modelName: "retro" })
class Retro extends ParanoidModel<
  InferAttributes<Retro>,
  Partial<InferCreationAttributes<Retro>>
> {
  @Length({
    max: RetroValidation.maxTitleLength,
    msg: `title must be ${RetroValidation.maxTitleLength} characters or less`,
  })
  @Column(DataType.STRING)
  title: string;

  @IsIn([Object.values(RetroPhase)])
  @Default(RetroPhase.Brainstorm)
  @Column(DataType.STRING)
  phase: RetroPhase;

  @Default(false)
  @Column(DataType.BOOLEAN)
  anonymous: boolean;

  @Default(5)
  @Column(DataType.INTEGER)
  votesPerUser: number;

  @Column(DataType.JSONB)
  columns: RetroColumn[];

  @Column(DataType.DATE)
  closedAt: Date | null;

  /**
   * Whether the retro has been closed and can no longer be changed.
   *
   * @returns true if the retro is closed.
   */
  get isClosed() {
    return this.phase === RetroPhase.Closed;
  }

  // associations

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  createdById: string;

  @BelongsTo(() => Collection, "collectionId")
  collection: Collection | null;

  @ForeignKey(() => Collection)
  @Column(DataType.UUID)
  collectionId: string | null;

  @BelongsTo(() => Document, "documentId")
  document: Document | null;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string | null;

  @HasMany(() => RetroCard, "retroId")
  cards: RetroCard[];

  @HasMany(() => RetroVote, "retroId")
  votes: RetroVote[];

  @HasMany(() => RetroActionItem, "retroId")
  actionItems: RetroActionItem[];
}

export default Retro;
