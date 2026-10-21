import { observer } from "mobx-react";
import { TrashIcon } from "outline-icons";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import NudeButton from "~/components/NudeButton";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { RetroValidation } from "../../shared/types";
import type { RetroActionItemData } from "../types";

const Unassigned = "unassigned";

interface Props {
  /** The action items to display. */
  items: RetroActionItemData[];
  /** Whether items can be added, edited, and deleted. */
  canEdit: boolean;
  /** Called when an item is added. */
  onAdd: (text: string, assigneeId: string | null) => Promise<unknown>;
  /** Called when an item's completion is toggled. */
  onToggle: (id: string, completed: boolean) => void;
  /** Called when an item's assignee changes. */
  onAssign: (id: string, assigneeId: string | null) => void;
  /** Called when an item is deleted. */
  onDelete: (id: string) => void;
}

/**
 * The list of action items agreed during a retro.
 */
export const ActionItems = observer(function ActionItems({
  items,
  canEdit,
  onAdd,
  onToggle,
  onAssign,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const [text, setText] = useState("");
  const [assigneeId, setAssigneeId] = useState(Unassigned);
  const [isSaving, setIsSaving] = useState(false);

  const assigneeOptions: Option[] = useMemo(
    () => [
      { type: "item", label: t("Unassigned"), value: Unassigned },
      ...users.active.map((user) => ({
        type: "item" as const,
        label: user.name,
        value: user.id,
      })),
    ],
    [t, users.active]
  );

  const handleSubmit = useCallback(
    async (ev?: React.SyntheticEvent) => {
      ev?.preventDefault();
      const trimmed = text.trim();

      if (!trimmed) {
        return;
      }

      setIsSaving(true);
      try {
        await onAdd(trimmed, assigneeId === Unassigned ? null : assigneeId);
        setText("");
        setAssigneeId(Unassigned);
      } finally {
        setIsSaving(false);
      }
    },
    [assigneeId, onAdd, text]
  );

  return (
    <Wrapper aria-labelledby="retro-action-items">
      <Heading id="retro-action-items">{t("Action items")}</Heading>
      {items.length === 0 && (
        <Text as="p" type="tertiary">
          {t("No action items yet.")}
        </Text>
      )}
      <List>
        {items.map((item) => (
          <Item key={item.id} align="center" gap={8}>
            <input
              type="checkbox"
              checked={item.completed}
              aria-label={t("Mark “{{ text }}” complete", { text: item.text })}
              onChange={() => onToggle(item.id, !item.completed)}
            />
            <ItemText $completed={item.completed} selectable>
              {item.text}
            </ItemText>
            {canEdit ? (
              <InputSelect
                label={t("Assignee")}
                labelHidden
                short
                options={assigneeOptions}
                value={item.assigneeId ?? Unassigned}
                onChange={(value) =>
                  onAssign(item.id, value === Unassigned ? null : value)
                }
              />
            ) : (
              <Text type="tertiary" size="small">
                {item.assigneeId
                  ? (users.get(item.assigneeId)?.name ?? t("Unknown"))
                  : t("Unassigned")}
              </Text>
            )}
            {canEdit && (
              <NudeButton
                aria-label={t("Delete action item")}
                onClick={() => onDelete(item.id)}
              >
                <TrashIcon size={18} />
              </NudeButton>
            )}
          </Item>
        ))}
      </List>
      {canEdit && (
        <Form onSubmit={handleSubmit}>
          <Input
            label={t("New action item")}
            labelHidden
            placeholder={t("Add an action item…")}
            value={text}
            maxLength={RetroValidation.maxActionLength}
            onChange={(ev) => setText(ev.target.value)}
            margin={0}
            flex
          />
          <InputSelect
            label={t("Assignee")}
            labelHidden
            short
            options={assigneeOptions}
            value={assigneeId}
            onChange={setAssigneeId}
          />
          <Button type="submit" disabled={!text.trim() || isSaving}>
            {t("Add")}
          </Button>
        </Form>
      )}
    </Wrapper>
  );
});

const Wrapper = styled.section`
  margin-top: 32px;
`;

const Heading = styled.h2`
  font-size: 18px;
  margin: 0 0 12px;
`;

const List = styled.ul`
  margin: 0 0 12px;
  padding: 0;
`;

const Item = styled(Flex).attrs({ as: "li" })`
  list-style: none;
  padding: 6px 0;
  border-bottom: 1px solid ${s("divider")};
`;

const ItemText = styled(Text)<{ $completed: boolean }>`
  flex: 1;
  text-decoration: ${(props) => (props.$completed ? "line-through" : "none")};
  color: ${(props) =>
    props.$completed ? props.theme.textTertiary : props.theme.text};
`;

const Form = styled.form`
  display: flex;
  align-items: center;
  gap: 8px;
`;
