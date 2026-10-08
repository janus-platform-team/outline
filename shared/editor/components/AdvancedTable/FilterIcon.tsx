interface Props {
  /** The size of the icon in pixels. */
  size?: number;
}

/**
 * A funnel shaped filter icon, matching the style of outline-icons.
 */
export function FilterIcon({ size = 16 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M5 6.5C5 5.67 5.67 5 6.5 5h11c.83 0 1.5.67 1.5 1.5 0 .36-.13.71-.37.98L14 12.12V17a1 1 0 0 1-.55.9l-2 1A1 1 0 0 1 10 18v-5.88L5.37 7.48A1.5 1.5 0 0 1 5 6.5Z" />
    </svg>
  );
}
