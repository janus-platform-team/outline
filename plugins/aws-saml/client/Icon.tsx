type Props = {
  /** The size of the icon, 24px is default to match standard icons */
  size?: number;
  /** The color of the icon, defaults to the current text color */
  color?: string;
};

export default function AwsSamlIcon({
  size = 24,
  color = "currentColor",
}: Props) {
  return (
    <svg
      fill={color}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      version="1.1"
    >
      <path d="M12 2 4 5v6.09c0 4.94 3.41 9.57 8 10.91 4.59-1.34 8-5.97 8-10.91V5l-8-3Zm0 4.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Zm0 12.86c-2.02-.68-3.8-2.2-4.8-4.16.9-1.4 2.79-2.3 4.8-2.3s3.9.9 4.8 2.3c-1 1.96-2.78 3.48-4.8 4.16Z" />
    </svg>
  );
}
