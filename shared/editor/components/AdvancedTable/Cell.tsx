import * as React from "react";
import styled from "styled-components";
import { s } from "../../../styles";
import { formatValue } from "../../lib/advancedTable";
import type {
  AdvancedTableCellValue,
  AdvancedTableColumn,
} from "../../lib/advancedTable";
import { CellBox, CellText, Checkbox, EditorInput } from "./styles";

export type MoveDirection = "up" | "down" | "left" | "right" | "none";

interface Props {
  /** The id of the row the cell belongs to. */
  rowId: string;
  /** Index of the row in the visible row list. */
  rowIndex: number;
  /** Index of the column in the visible column list. */
  colIndex: number;
  /** The column definition. */
  column: AdvancedTableColumn;
  /** The stored value. */
  value: AdvancedTableCellValue;
  /** Inline styles for width and sticky offsets. */
  style: React.CSSProperties;
  /** Whether the cell is the keyboard focused cell. */
  isActive: boolean;
  /** Whether the cell is currently being edited. */
  isEditing: boolean;
  /** Initial text when editing was started by typing a character. */
  initialText?: string;
  /** Whether the grid is editable. */
  isEditable: boolean;
  /** Called when the cell is clicked. */
  onActivate: (rowIndex: number, colIndex: number) => void;
  /** Called to begin editing the cell. */
  onStartEdit: (rowIndex: number, colIndex: number) => void;
  /** Called with the new value when editing completes. */
  onCommit: (
    rowId: string,
    columnId: string,
    value: unknown,
    move: MoveDirection
  ) => void;
  /** Called when editing is cancelled. */
  onCancel: () => void;
}

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 10,
});

/**
 * A single grid cell with a type-aware display and inline editor.
 */
function CellComponent({
  rowId,
  rowIndex,
  colIndex,
  column,
  value,
  style,
  isActive,
  isEditing,
  initialText,
  isEditable,
  onActivate,
  onStartEdit,
  onCommit,
  onCancel,
}: Props) {
  const align =
    column.type === "number"
      ? "right"
      : column.type === "boolean"
        ? "center"
        : "left";

  const handleMouseDown = React.useCallback(() => {
    onActivate(rowIndex, colIndex);
  }, [onActivate, rowIndex, colIndex]);

  const handleDoubleClick = React.useCallback(() => {
    if (isEditable && column.type !== "boolean") {
      onStartEdit(rowIndex, colIndex);
    }
  }, [isEditable, column.type, onStartEdit, rowIndex, colIndex]);

  const handleToggle = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onCommit(rowId, column.id, event.target.checked, "none");
    },
    [onCommit, rowId, column.id]
  );

  return (
    <CellBox
      role="gridcell"
      aria-selected={isActive}
      aria-colindex={colIndex + 1}
      $align={align}
      $active={isActive && !isEditing}
      $pinned={!!column.pinned}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      title={
        column.type === "text" && typeof value === "string" && value.length > 30
          ? value
          : undefined
      }
    >
      {isEditing ? (
        <CellEditor
          column={column}
          value={value}
          initialText={initialText}
          onCommit={(next, move) => onCommit(rowId, column.id, next, move)}
          onCancel={onCancel}
        />
      ) : column.type === "boolean" ? (
        <Checkbox
          type="checkbox"
          tabIndex={-1}
          checked={value === true}
          disabled={!isEditable}
          aria-label={column.name}
          onMouseDown={(event) => event.preventDefault()}
          onChange={handleToggle}
        />
      ) : column.type === "select" && value !== null ? (
        <Pill>{String(value)}</Pill>
      ) : (
        <CellText>
          {column.type === "number" && typeof value === "number"
            ? numberFormat.format(value)
            : formatValue(value, column)}
        </CellText>
      )}
    </CellBox>
  );
}

export const Cell = React.memo(CellComponent);

interface EditorProps {
  column: AdvancedTableColumn;
  value: AdvancedTableCellValue;
  initialText?: string;
  onCommit: (value: unknown, move: MoveDirection) => void;
  onCancel: () => void;
}

function CellEditor({
  column,
  value,
  initialText,
  onCommit,
  onCancel,
}: EditorProps) {
  const [text, setText] = React.useState(
    initialText ?? formatValue(value, column)
  );
  const doneRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `advanced-table-options-${column.id}`;

  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus();
    if (initialText === undefined && input.type !== "date") {
      input.select();
    }
  }, [initialText]);

  const finish = (move: MoveDirection) => {
    if (doneRef.current) {
      return;
    }
    doneRef.current = true;
    onCommit(text, move);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      finish(event.shiftKey ? "up" : "down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      finish(event.shiftKey ? "left" : "right");
    } else if (event.key === "Escape") {
      event.preventDefault();
      doneRef.current = true;
      onCancel();
    }
  };

  return (
    <>
      <EditorInput
        ref={inputRef}
        type={column.type === "date" ? "date" : "text"}
        inputMode={column.type === "number" ? "decimal" : undefined}
        list={column.type === "select" ? listId : undefined}
        value={text}
        aria-label={column.name}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => finish("none")}
        onMouseDown={(event) => event.stopPropagation()}
      />
      {column.type === "select" && (
        <datalist id={listId}>
          {(column.options ?? []).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </>
  );
}

const Pill = styled.span`
  display: inline-block;
  max-width: 100%;
  padding: 1px 8px;
  border-radius: 10px;
  background: ${s("backgroundTertiary")};
  color: ${s("text")};
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
`;
