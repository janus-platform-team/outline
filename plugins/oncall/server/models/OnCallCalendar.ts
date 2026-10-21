import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Max,
  Min,
  Table,
} from "sequelize-typescript";
import { Team, User } from "@server/models";
import ParanoidModel from "@server/models/base/ParanoidModel";
import Encrypted from "@server/models/decorators/Encrypted";
import Length from "@server/models/validators/Length";
import { OnCallValidation } from "../../shared/types";
import OnCallRotation from "./OnCallRotation";

@Table({ tableName: "oncall_calendars", modelName: "oncall_calendar" })
class OnCallCalendar extends ParanoidModel<
  InferAttributes<OnCallCalendar>,
  Partial<InferCreationAttributes<OnCallCalendar>>
> {
  @Length({
    max: OnCallValidation.maxNameLength,
    msg: `name must be ${OnCallValidation.maxNameLength} characters or less`,
  })
  @Column(DataType.STRING)
  name: string;

  @Length({
    max: OnCallValidation.maxDescriptionLength,
    msg: `description must be ${OnCallValidation.maxDescriptionLength} characters or less`,
  })
  @Column(DataType.TEXT)
  description: string | null;

  @Default("UTC")
  @Column(DataType.STRING)
  timezone: string;

  @Min(0)
  @Max(23)
  @Default(9)
  @Column(DataType.INTEGER)
  notifyHour: number;

  @Column(DataType.BLOB)
  @Encrypted
  slackWebhookUrl: string | null;

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

  @HasMany(() => OnCallRotation, "calendarId")
  rotations: OnCallRotation[];
}

export default OnCallCalendar;
