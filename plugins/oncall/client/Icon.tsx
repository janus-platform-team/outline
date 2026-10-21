import { CalendarIcon } from "outline-icons";

interface Props {
  /** The size of the icon in pixels. */
  size?: number;
  /** The color of the icon. */
  color?: string;
}

/**
 * The icon used to represent on-call calendars.
 */
export function OnCallIcon({ size = 24, color }: Props) {
  return <CalendarIcon size={size} color={color} />;
}

export default OnCallIcon;
