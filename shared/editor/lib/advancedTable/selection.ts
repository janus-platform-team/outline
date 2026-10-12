import { formatValue } from "./operations";
import type { AdvancedTableColumn, AdvancedTableRow } from "./types";

export interface CellPosition {
  /** Index of the row in the visible row list. */
  row: number;
  /** Index of the column in the visible column list. */
  col: number;
}

export interface RangeBounds {
  /** Index of the first row in the range. */
  top: number;
  /** Index of the last row in the range. */
  bottom: number;
  /** Index of the first column in the range. */
  left: number;
  /** Index of the last column in the range. */
  right: number;
}

/**
 * Returns the rectangle of cells between an anchor and a focus cell, in any
 * drag direction.
 *
 * @param anchor the cell where the selection started, or null for a single cell.
 * @param focus the cell where the selection currently ends.
 * @returns the inclusive bounds of the range.
 */
export function getRangeBounds(
  anchor: CellPosition | null,
  focus: CellPosition
): RangeBounds {
  const start = anchor ?? focus;
  return {
    top: Math.min(start.row, focus.row),
    bottom: Math.max(start.row, focus.row),
    left: Math.min(start.col, focus.col),
    right: Math.max(start.col, focus.col),
  };
}

/**
 * Whether the range covers more than a single cell.
 *
 * @param bounds the range bounds.
 * @returns true if more than one cell is selected.
 */
export function isMultiCellRange(bounds: RangeBounds): boolean {
  return bounds.top !== bounds.bottom || bounds.left !== bounds.right;
}

/**
 * Returns the formatted values of the cells within a range, one array per row.
 *
 * @param bounds the range bounds.
 * @param rows the visible rows, in display order.
 * @param columns the visible columns, in display order.
 * @returns the formatted cell values.
 */
export function rangeToMatrix(
  bounds: RangeBounds,
  rows: AdvancedTableRow[],
  columns: AdvancedTableColumn[]
): string[][] {
  const selectedColumns = columns.slice(bounds.left, bounds.right + 1);
  return rows
    .slice(bounds.top, bounds.bottom + 1)
    .map((row) =>
      selectedColumns.map((column) =>
        formatValue(row.cells[column.id] ?? null, column)
      )
    );
}

/**
 * Chooses the delimiter for pasted text. Pasted text is treated as CSV, except
 * tab separated text without commas, which is what spreadsheet apps copy.
 *
 * @param text the pasted text.
 * @returns the delimiter to parse with.
 */
export function getPasteDelimiter(text: string): string {
  return text.includes("\t") && !text.includes(",") ? "\t" : ",";
}
