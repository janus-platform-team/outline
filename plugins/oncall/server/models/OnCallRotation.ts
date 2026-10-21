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
import ParanoidModel from "@server/models/base/ParanoidModel";
import Length from "@server/models/validators/Length";
import type { DateString, RotationSegment } from "../../shared/types";
import { OnCallValidation } from "../../shared/types";
import OnCallCalendar from "./OnCallCalendar";
import OnCallOverride from "./OnCallOverride";
import OnCallRotationSegment from "./OnCallRotationSegment";

@Table({ tableName: "oncall_rotations", modelName: "oncall_rotation" })
class OnCallRotation extends ParanoidModel<
  InferAttributes<OnCallRotation>,
  Partial<InferCreationAttributes<OnCallRotation>>
> {
  @Length({
    max: OnCallValidation.maxNameLength,
    msg: `name must be ${OnCallValidation.maxNameLength} characters or less`,
  })
  @Column(DataType.STRING)
  name: string;

  @Column(DataType.STRING)
  color: string;

  @Column(DataType.DATEONLY)
  startDate: DateString;

  @Min(0)
  @Max(6)
  @Default(1)
  @Column(DataType.INTEGER)
  startDayOfWeek: number;

  @Min(1)
  @Max(OnCallValidation.maxShiftLengthDays)
  @Default(7)
  @Column(DataType.INTEGER)
  shiftLengthDays: number;

  @Default(false)
  @Column(DataType.BOOLEAN)
  notifyOnChange: boolean;

  @Column(DataType.DATEONLY)
  lastNotifiedDate: DateString | null;

  @Default(0)
  @Column(DataType.INTEGER)
  index: number;

  /**
   * The segments of the rotation in a form suitable for the schedule resolver.
   * Requires the segments association to be loaded.
   *
   * @returns the plain segments.
   */
  get plainSegments(): RotationSegment[] {
    return (this.segments ?? []).map((segment) => segment.toPlain());
  }

  // associations

  @BelongsTo(() => OnCallCalendar, "calendarId")
  calendar: OnCallCalendar;

  @ForeignKey(() => OnCallCalendar)
  @Column(DataType.UUID)
  calendarId: string;

  @HasMany(() => OnCallRotationSegment, "rotationId")
  segments: OnCallRotationSegment[];

  @HasMany(() => OnCallOverride, "rotationId")
  overrides: OnCallOverride[];
}

export default OnCallRotation;
