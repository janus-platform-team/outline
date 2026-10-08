import {
  CloseIcon,
  HiddenIcon,
  InsertLeftIcon,
  InsertRightIcon,
  PinIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  TrashIcon,
} from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { AdvancedTableColumnTypes } from "../../lib/advancedTable";
import type {
  AdvancedTableColumn,
  AdvancedTableColumnType,
  AdvancedTablePinned,
} from "../../lib/advancedTable";
import { Popover } from "./Popover";
import { MenuField, MenuItem, MenuLabel, MenuSeparator } from "./styles";

interface Props {
  /** The column the menu is for. */
  column: AdvancedTableColumn;
  /** The element the menu is anchored to. */
  anchor: HTMLElement;
  /** Whether the grid is editable. */
  isEditable: boolean;
  /** The current sort direction of the column. */
  sortDirection: "asc" | "desc" | false;
  /** Whether this is the only visible column. */
  isLastVisible: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
  onChangeType: (type: AdvancedTableColumnType) => void;
  onSort: (desc: boolean | null) => void;
  onPin: (pinned: AdvancedTablePinned | null) => void;
  onHide: () => void;
  onInsert: (side: "left" | "right") => void;
  onDelete: () => void;
}

/**
 * The options menu for a single column.
 */
export function ColumnMenu({
  column,
  anchor,
  isEditable,
  sortDirection,
  isLastVisible,
  onClose,
  onRename,
  onChangeType,
  onSort,
  onPin,
  onHide,
  onInsert,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(column.name);
  const pendingNameRef = React.useRef({
    name,
    original: column.name,
    onRename,
  });
  pendingNameRef.current = { name, original: column.name, onRename };

  React.useEffect(
    () => () => {
      const pending = pendingNameRef.current;
      if (pending.name !== pending.original) {
        pending.onRename(pending.name);
      }
    },
    []
  );

  const typeLabels: Record<AdvancedTableColumnType, string> = {
    text: t("Text"),
    number: t("Number"),
    date: t("Date"),
    boolean: t("Checkbox"),
    select: t("Select"),
  };

  const commitName = () => {
    if (name !== pendingNameRef.current.original) {
      onRename(name);
      pendingNameRef.current.original = name;
    }
  };

  const run = (callback: () => void) => () => {
    callback();
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={onClose} label={t("Column options")}>
      {isEditable && (
        <>
          <MenuLabel htmlFor={`advanced-table-name-${column.id}`}>
            {t("Name")}
          </MenuLabel>
          <MenuField>
            <input
              id={`advanced-table-name-${column.id}`}
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitName();
                  onClose();
                }
              }}
            />
          </MenuField>
          <MenuLabel htmlFor={`advanced-table-type-${column.id}`}>
            {t("Type")}
          </MenuLabel>
          <MenuField>
            <select
              id={`advanced-table-type-${column.id}`}
              value={column.type}
              onChange={(event) => {
                const type = AdvancedTableColumnTypes.find(
                  (value) => value === event.target.value
                );
                if (type) {
                  onChangeType(type);
                }
              }}
            >
              {AdvancedTableColumnTypes.map((type) => (
                <option key={type} value={type}>
                  {typeLabels[type]}
                </option>
              ))}
            </select>
          </MenuField>
          <MenuSeparator />
        </>
      )}
      <MenuItem
        type="button"
        disabled={sortDirection === "asc"}
        onClick={run(() => onSort(false))}
      >
        <SortAscendingIcon size={18} /> {t("Sort ascending")}
      </MenuItem>
      <MenuItem
        type="button"
        disabled={sortDirection === "desc"}
        onClick={run(() => onSort(true))}
      >
        <SortDescendingIcon size={18} /> {t("Sort descending")}
      </MenuItem>
      {sortDirection && (
        <MenuItem type="button" onClick={run(() => onSort(null))}>
          <CloseIcon size={18} /> {t("Clear sort")}
        </MenuItem>
      )}
      {isEditable && (
        <>
          <MenuSeparator />
          {column.pinned !== "left" && (
            <MenuItem type="button" onClick={run(() => onPin("left"))}>
              <PinIcon size={18} /> {t("Pin left")}
            </MenuItem>
          )}
          {column.pinned !== "right" && (
            <MenuItem type="button" onClick={run(() => onPin("right"))}>
              <PinIcon size={18} /> {t("Pin right")}
            </MenuItem>
          )}
          {column.pinned && (
            <MenuItem type="button" onClick={run(() => onPin(null))}>
              <CloseIcon size={18} /> {t("Unpin")}
            </MenuItem>
          )}
          <MenuItem
            type="button"
            disabled={isLastVisible}
            onClick={run(onHide)}
          >
            <HiddenIcon size={18} /> {t("Hide column")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem type="button" onClick={run(() => onInsert("left"))}>
            <InsertLeftIcon size={18} /> {t("Insert column before")}
          </MenuItem>
          <MenuItem type="button" onClick={run(() => onInsert("right"))}>
            <InsertRightIcon size={18} /> {t("Insert column after")}
          </MenuItem>
          <MenuItem
            type="button"
            $danger
            disabled={isLastVisible}
            onClick={run(onDelete)}
          >
            <TrashIcon size={18} /> {t("Delete column")}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}
