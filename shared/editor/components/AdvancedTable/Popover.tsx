import * as React from "react";
import ReactDOM from "react-dom";
import { PopoverBox } from "./styles";

interface Props {
  /** The element the popover is positioned against. */
  anchor: HTMLElement;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Accessible label for the popover. */
  label: string;
  children: React.ReactNode;
}

/**
 * A lightweight popover rendered in a portal so that it is not clipped by the
 * grid scroll container. Closes on outside click and Escape.
 */
export function Popover({ anchor, onClose, label, children }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  React.useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const width = ref.current?.offsetWidth ?? 220;
    const height = ref.current?.offsetHeight ?? 0;
    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - width - 8)
    );
    const below = rect.bottom + 4;
    const top =
      below + height > window.innerHeight && rect.top - height - 4 > 0
        ? rect.top - height - 4
        : below;
    setPosition({ top, left });
  }, [anchor]);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        !anchor.contains(event.target)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) {
        return;
      }
      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [anchor, onClose]);

  return ReactDOM.createPortal(
    <PopoverBox
      ref={ref}
      role="dialog"
      aria-label={label}
      style={position}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {children}
    </PopoverBox>,
    document.body
  );
}
