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
import Length from "@server/models/validators/Length";
import type { DateString } from "../../shared/types";
import { OnCallValidation } from "../../shared/types";
import OnCallRotation from "./OnCallRotation";

@Table({ tableName: "oncall_overrides", modelName: "oncall_override" })
class OnCallOverride extends IdModel<
  InferAttributes<OnCallOverride>,
  Partial<InferCreationAttributes<OnCallOverride>>
> {
  @Column(DataType.DATEONLY)
  startDate: DateString;

  @Column(DataType.DATEONLY)
  endDate: DateString;

  @Length({
    max: OnCallValidation.maxReasonLength,
    msg: `reason must be ${OnCallValidation.maxReasonLength} characters or less`,
  })
  @Column(DataType.STRING)
  reason: string | null;

  // associations

  @BelongsTo(() => OnCallRotation, "rotationId")
  rotation: OnCallRotation;

  @ForeignKey(() => OnCallRotation)
  @Column(DataType.UUID)
  rotationId: string;

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  createdById: string;
}

export default OnCallOverride;
