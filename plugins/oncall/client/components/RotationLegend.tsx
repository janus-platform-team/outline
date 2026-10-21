import { observer } from "mobx-react";
import { CalendarIcon, EditIcon, TrashIcon, UserIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import NudeButton from "~/components/NudeButton";
import Text from "~/components/Text";
import Tooltip from "~/components/Tooltip";
import type { OnCallRotationData } from "../../shared/types";
import { useIntlLocale } from "../hooks";
import { formatDate } from "../utils";
import { UserLabel } from "./UserLabel";

interface Props {
  /** The rotations of the calendar. */
  rotations: OnCallRotationData[];
  /** The ids of rotations that are hidden. */
  hiddenIds: Set<string>;
  /** Called when the visibility of a rotation is toggled. */
  onToggle: (rotationId: string) => void;
  /** Whether the current user can change the rotations. */
  canEdit: boolean;
  /** Called to edit a rotation. */
  onEdit: (rotation: OnCallRotationData) => void;
  /** Called to manage the members of a rotation. */
  onMembers: (rotation: OnCallRotationData) => void;
  /** Called to add an override to a rotation. */
  onOverride: (rotation: OnCallRotationData) => void;
  /** Called to delete a rotation. */
  onDelete: (rotation: OnCallRotationData) => void;
}

/**
 * Lists the rotations of a calendar with who is currently on call.
 */
export const RotationLegend = observer(function RotationLegend({
  rotations,
  hiddenIds,
  onToggle,
  canEdit,
  onEdit,
  onMembers,
  onOverride,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const locale = useIntlLocale();

  return (
    <List>
      {rotations.map((rotation) => (
        <Item key={rotation.id}>
          <Toggle>
            <input
              type="checkbox"
              checked={!hiddenIds.has(rotation.id)}
              onChange={() => onToggle(rotation.id)}
              aria-label={t("Show {{ name }}", { name: rotation.name })}
            />
            <RotationDot $color={rotation.color} />
            <strong>{rotation.name}</strong>
          </Toggle>
          <Current>
            {rotation.currentShift ? (
              <>
                <UserLabel userId={rotation.currentShift.userId} />
                <Text type="tertiary" size="small">
                  {t("until {{ date }}", {
                    date: formatDate(rotation.currentShift.endDate, locale),
                  })}
                </Text>
              </>
            ) : (
              <Text type="tertiary" size="small">
                {rotation.memberIds.length
                  ? t("Starts {{ date }}", {
                      date: formatDate(
                        rotation.segments[0]?.effectiveDate ??
                          rotation.startDate,
                        locale
                      ),
                    })
                  : t("No members yet")}
              </Text>
            )}
          </Current>
          {canEdit && (
            <Actions>
              <Tooltip content={t("Members")}>
                <NudeButton
                  aria-label={t("Members")}
                  onClick={() => onMembers(rotation)}
                >
                  <UserIcon size={20} />
                </NudeButton>
              </Tooltip>
              <Tooltip content={t("Add override")}>
                <NudeButton
                  aria-label={t("Add override")}
                  onClick={() => onOverride(rotation)}
                >
                  <CalendarIcon size={20} />
                </NudeButton>
              </Tooltip>
              <Tooltip content={t("Edit rotation")}>
                <NudeButton
                  aria-label={t("Edit rotation")}
                  onClick={() => onEdit(rotation)}
                >
                  <EditIcon size={20} />
                </NudeButton>
              </Tooltip>
              <Tooltip content={t("Delete rotation")}>
                <NudeButton
                  aria-label={t("Delete rotation")}
                  onClick={() => onDelete(rotation)}
                >
                  <TrashIcon size={20} />
                </NudeButton>
              </Tooltip>
            </Actions>
          )}
        </Item>
      ))}
    </List>
  );
});

/**
 * A small colored dot identifying a rotation.
 */
export const RotationDot = styled.span<{ $color: string }>`
  display: inline-block;
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(props) => props.$color};
`;

const List = styled.ul`
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
`;

const Item = styled.li`
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(180px, 2fr) auto;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid ${s("divider")};

  &:last-child {
    border-bottom: 0;
  }
`;

const Toggle = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  min-width: 0;
`;

const Current = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const Actions = styled.div`
  display: flex;
  gap: 4px;
`;
