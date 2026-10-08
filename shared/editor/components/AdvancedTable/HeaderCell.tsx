import {
  MoreIcon,
  PinIcon,
  SortAscendingIcon,
  SortDescendingIcon,
} from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import type { AdvancedTableColumn } from "../../lib/advancedTable";
import { FilterIcon } from "./FilterIcon";
import { HeaderBox, HeaderLabel, IconButton, ResizeHandle } from "./styles";

interface Props {
  /** The column definition. */
  column: AdvancedTableColumn;
  /** Index of the column in the visible column list. */
  colIndex: number;
  /** Inline styles for width and sticky offsets. */
  style: React.CSSProperties;
  /** The current sort direction of the column. */
  sortDirection: "asc" | "desc" | false;
  /** Position of the column in a multi-column sort, starting at 1. */
  sortIndex: number | null;
  /** Whether a filter is applied to the column. */
  isFiltered: boolean;
  /** Whether the column is currently being resized. */
  isResizing: boolean;
  /** Whether the grid is editable. */
  isEditable: boolean;
  /** Called when the user presses on the header, used for sort and reorder. */
  onHeaderMouseDown: (columnId: string, event: React.MouseEvent) => void;
  /** Called to start resizing the column. */
  onResizeStart: (columnId: string, event: React.MouseEvent) => void;
  /** Called when the resize handle is double clicked. */
  onAutoSize: (columnId: string) => void;
  /** Called to open the column menu. */
  onOpenMenu: (columnId: string, anchor: HTMLElement) => void;
  /** Called to open the column filter. */
  onOpenFilter: (columnId: string, anchor: HTMLElement) => void;
}

/**
 * A grid column header with sort indicator, filter and menu buttons, and a
 * resize handle.
 */
function HeaderCellComponent({
  column,
  colIndex,
  style,
  sortDirection,
  sortIndex,
  isFiltered,
  isResizing,
  isEditable,
  onHeaderMouseDown,
  onResizeStart,
  onAutoSize,
  onOpenMenu,
  onOpenFilter,
}: Props) {
  const { t } = useTranslation();

  const stop = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <HeaderBox
      role="columnheader"
      aria-colindex={colIndex + 1}
      aria-sort={
        sortDirection === "asc"
          ? "ascending"
          : sortDirection === "desc"
            ? "descending"
            : "none"
      }
      data-column-id={column.id}
      $pinned={!!column.pinned}
      style={style}
      onMouseDown={(event) => onHeaderMouseDown(column.id, event)}
      title={column.name}
    >
      {column.pinned && <PinIcon size={16} />}
      <HeaderLabel>{column.name || "\u00a0"}</HeaderLabel>
      {sortDirection === "asc" && <SortAscendingIcon size={16} />}
      {sortDirection === "desc" && <SortDescendingIcon size={16} />}
      {sortIndex !== null && <small>{sortIndex}</small>}
      <IconButton
        type="button"
        aria-label={t("Filter")}
        $active={isFiltered}
        onMouseDown={stop}
        onClick={(event) => onOpenFilter(column.id, event.currentTarget)}
      >
        <FilterIcon />
      </IconButton>
      <IconButton
        type="button"
        aria-label={t("Column options")}
        aria-haspopup="dialog"
        onMouseDown={stop}
        onClick={(event) => onOpenMenu(column.id, event.currentTarget)}
      >
        <MoreIcon size={18} />
      </IconButton>
      {isEditable && (
        <ResizeHandle
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Resize column")}
          $active={isResizing}
          onMouseDown={(event) => {
            event.stopPropagation();
            onResizeStart(column.id, event);
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            onAutoSize(column.id);
          }}
        />
      )}
    </HeaderBox>
  );
}

export const HeaderCell = React.memo(HeaderCellComponent);
