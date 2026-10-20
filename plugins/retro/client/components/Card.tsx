import { observer } from "mobx-react";
import { EditIcon, TrashIcon } from "outline-icons";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import NudeButton from "~/components/NudeButton";
import Text from "~/components/Text";
import Tooltip from "~/components/Tooltip";
import useStores from "~/hooks/useStores";
import { RetroValidation } from "../../shared/types";
import type { RetroCardData } from "../types";
import { VoteButton } from "./VoteButton";

interface Props {
  /** The card to display. */
  card: RetroCardData;
  /** Whether the card text can be edited. */
  canEdit: boolean;
  /** Whether the card can be deleted. */
  canDelete: boolean;
  /** Whether votes can be cast or removed. */
  canVote: boolean;
  /** Whether the current user has votes left to cast. */
  hasVotesRemaining: boolean;
  /** Called when the card text is changed. */
  onUpdate: (id: string, text: string) => Promise<unknown>;
  /** Called when the card is deleted. */
  onDelete: (id: string) => void;
  /** Called when a vote is cast or removed. */
  onToggleVote: (id: string, voted: boolean) => void;
}

function CardComponent({
  card,
  canEdit,
  canDelete,
  canVote,
  hasVotesRemaining,
  onUpdate,
  onDelete,
  onToggleVote,
}: Props) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(card.text);

  const handleEdit = useCallback(() => {
    setText(card.text);
    setIsEditing(true);
  }, [card.text]);

  const handleSave = useCallback(async () => {
    const trimmed = text.trim();

    if (trimmed && trimmed !== card.text) {
      await onUpdate(card.id, trimmed);
    }
    setIsEditing(false);
  }, [card.id, card.text, onUpdate, text]);

  const handleKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (ev.key === "Escape") {
        setIsEditing(false);
      }
    },
    []
  );

  const handleDelete = useCallback(
    () => onDelete(card.id),
    [card.id, onDelete]
  );

  const handleToggleVote = useCallback(
    () => onToggleVote(card.id, card.votedByMe),
    [card.id, card.votedByMe, onToggleVote]
  );

  return (
    <Wrapper as="li" $mine={card.isMine}>
      {isEditing ? (
        <Input
          type="textarea"
          label={t("Card text")}
          labelHidden
          value={text}
          maxLength={RetroValidation.maxCardLength}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={handleKeyDown}
          onRequestSubmit={handleSave}
          onBlur={handleSave}
          autoSize
          autoFocus
          margin={0}
        />
      ) : (
        <CardText selectable>{card.text}</CardText>
      )}
      <Footer align="center" justify="space-between" gap={4}>
        <Text type="tertiary" size="xsmall">
          {card.isMine ? t("You") : <Author authorId={card.authorId} />}
        </Text>
        <Flex align="center" gap={2}>
          {canEdit && !isEditing && (
            <Tooltip content={t("Edit")}>
              <NudeButton aria-label={t("Edit card")} onClick={handleEdit}>
                <EditIcon size={18} />
              </NudeButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip content={t("Delete")}>
              <NudeButton aria-label={t("Delete card")} onClick={handleDelete}>
                <TrashIcon size={18} />
              </NudeButton>
            </Tooltip>
          )}
          <VoteButton
            voteCount={card.voteCount}
            votedByMe={card.votedByMe}
            disabled={!canVote || (!card.votedByMe && !hasVotesRemaining)}
            visible={canVote || card.voteCount !== null}
            onClick={handleToggleVote}
          />
        </Flex>
      </Footer>
    </Wrapper>
  );
}

const Author = observer(function Author({
  authorId,
}: {
  authorId: string | null;
}) {
  const { t } = useTranslation();
  const { users } = useStores();

  if (!authorId) {
    return <>{t("Anonymous")}</>;
  }

  return <>{users.get(authorId)?.name ?? t("Unknown")}</>;
});

export const Card = memo(CardComponent);

const Wrapper = styled(Flex).attrs({ column: true, gap: 8 })<{
  $mine: boolean;
}>`
  list-style: none;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${s("background")};
  border: 1px solid
    ${(props) => (props.$mine ? props.theme.accent : props.theme.divider)};
`;

const CardText = styled(Text)`
  white-space: pre-wrap;
  word-break: break-word;
`;

const Footer = styled(Flex)`
  min-height: 24px;
`;
