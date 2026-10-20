import { ThumbsUpIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import NudeButton from "~/components/NudeButton";

interface Props {
  /** The total votes for the card, null while totals are hidden. */
  voteCount: number | null;
  /** Whether the current user has voted for the card. */
  votedByMe: boolean;
  /** Whether the button is disabled. */
  disabled: boolean;
  /** Whether the button is shown at all. */
  visible: boolean;
  /** Called when the button is clicked. */
  onClick: () => void;
}

/**
 * A toggle for voting on a retro card that also displays the vote total once
 * voting has ended.
 */
export function VoteButton({
  voteCount,
  votedByMe,
  disabled,
  visible,
  onClick,
}: Props) {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <Button
      aria-pressed={votedByMe}
      aria-label={votedByMe ? t("Remove vote") : t("Vote")}
      disabled={disabled}
      onClick={onClick}
      $active={votedByMe}
      width="auto"
    >
      <ThumbsUpIcon size={18} />
      {voteCount !== null && <span>{voteCount}</span>}
    </Button>
  );
}

const Button = styled(NudeButton)<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: ${(props) =>
    props.$active ? props.theme.accent : props.theme.textSecondary};

  svg {
    fill: currentColor;
  }

  &:disabled {
    cursor: default;
    opacity: ${(props) => (props.$active ? 1 : 0.5)};
  }

  &:not(:disabled):hover {
    color: ${s("accent")};
  }
`;
