import { LightBulbIcon } from "outline-icons";

interface Props {
  /** The size of the icon in pixels. */
  size?: number;
  /** The color of the icon. */
  color?: string;
}

/**
 * The icon used to represent retrospectives.
 */
export function RetroIcon({ size = 24, color }: Props) {
  return <LightBulbIcon size={size} color={color} />;
}

export default RetroIcon;
