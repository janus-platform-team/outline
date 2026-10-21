import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import IdModel from "@server/models/base/IdModel";
import type { DateString, RotationSegment } from "../../shared/types";
import OnCallRotation from "./OnCallRotation";

@Table({
  tableName: "oncall_rotation_segments",
  modelName: "oncall_rotation_segment",
})
class OnCallRotationSegment extends IdModel<
  InferAttributes<OnCallRotationSegment>,
  Partial<InferCreationAttributes<OnCallRotationSegment>>
> {
  @Column(DataType.DATEONLY)
  effectiveDate: DateString;

  @Default([])
  @Column(DataType.ARRAY(DataType.UUID))
  memberIds: string[];

  @Default(0)
  @Column(DataType.INTEGER)
  startIndex: number;

  @Column(DataType.INTEGER)
  shiftLengthDays: number;

  /**
   * Returns the segment in a form suitable for the schedule resolver.
   *
   * @returns the plain segment.
   */
  toPlain(): RotationSegment {
    return {
      effectiveDate: this.effectiveDate,
      memberIds: [...this.memberIds],
      startIndex: this.startIndex,
      shiftLengthDays: this.shiftLengthDays,
    };
  }

  // associations

  @BelongsTo(() => OnCallRotation, "rotationId")
  rotation: OnCallRotation;

  @ForeignKey(() => OnCallRotation)
  @Column(DataType.UUID)
  rotationId: string;
}

export default OnCallRotationSegment;
