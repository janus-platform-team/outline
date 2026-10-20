import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import Text from "~/components/Text";
import type { RetroColumn } from "../../shared/types";
import { RetroValidation } from "../../shared/types";
import type { RetroCardData } from "../types";
import { Card } from "./Card";

interface Props {
  /** The column to display. */
  column: RetroColumn;
  /** The cards in the column visible to the current user. */
  cards: RetroCardData[];
  /** Whether new cards can be added. */
  canAddCards: boolean;
  /** Whether votes can be cast. */
  canVote: boolean;
  /** Whether the current user can moderate any card. */
  canModerate: boolean;
  /** Whether the current user has votes left to cast. */
  hasVotesRemaining: boolean;
  /** Called when a card is added to the column. */
  onAddCard: (columnId: string, text: string) => Promise<unknown>;
  /** Called when a card's text is changed. */
  onUpdateCard: (id: string, text: string) => Promise<unknown>;
  /** Called when a card is deleted. */
  onDeleteCard: (id: string) => void;
  /** Called when a vote is cast or removed. */
  onToggleVote: (id: string, voted: boolean) => void;
}

function ColumnComponent({
  column,
  cards,
  canAddCards,
  canVote,
  canModerate,
  hasVotesRemaining,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onToggleVote,
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const headingId = `retro-column-${column.id}`;

  const handleSubmit = useCallback(
    async (ev?: React.SyntheticEvent) => {
      ev?.preventDefault();
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      setIsSaving(true);
      try {
        await onAddCard(column.id, trimmed);
        setText("");
      } finally {
        setIsSaving(false);
      }
    },
    [column.id, onAddCard, text]
  );

  return (
    <Wrapper as="section" aria-labelledby={headingId}>
      <Flex align="center" justify="space-between">
        <Title id={headingId}>{column.title}</Title>
        <Text type="tertiary" size="small">
          {cards.length}
        </Text>
      </Flex>
      {canAddCards && (
        <form onSubmit={handleSubmit}>
          <Input
            type="textarea"
            label={t("Add a card to {{ column }}", { column: column.title })}
            labelHidden
            placeholder={t("Add a card…")}
            value={text}
            maxLength={RetroValidation.maxCardLength}
            onChange={(ev) => setText(ev.target.value)}
            onRequestSubmit={handleSubmit}
            autoSize
            margin="0 0 8px"
          />
          <Button type="submit" disabled={!text.trim() || isSaving} neutral>
            {t("Add card")}
          </Button>
        </form>
      )}
      <Cards>
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            canEdit={canAddCards && card.isMine}
            canDelete={canModerate || (canAddCards && card.isMine)}
            canVote={canVote}
            hasVotesRemaining={hasVotesRemaining}
            onUpdate={onUpdateCard}
            onDelete={onDeleteCard}
            onToggleVote={onToggleVote}
          />
        ))}
      </Cards>
    </Wrapper>
  );
}

export const Column = memo(ColumnComponent);

const Wrapper = styled(Flex).attrs({ column: true, gap: 12 })`
  flex: 1 1 0;
  min-width: 240px;
  padding: 12px;
  border-radius: 8px;
  background: ${s("backgroundSecondary")};
`;

const Title = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
`;

const Cards = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
`;
