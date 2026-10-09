export type AdvancedTableColumnType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select";

export type AdvancedTableCellValue = string | number | boolean | null;

export type AdvancedTablePinned = "left" | "right";

export interface AdvancedTableColumn {
  /** Stable identifier used as the key for row cells. */
  id: string;
  /** Display name shown in the header. */
  name: string;
  /** Data type which controls editing, sorting, filtering and formatting. */
  type: AdvancedTableColumnType;
  /** Width of the column in pixels. */
  width: number;
  /** Whether the column is pinned to one side of the grid. */
  pinned?: AdvancedTablePinned | null;
  /** Whether the column is hidden from view. */
  hidden?: boolean;
  /** Allowed values for select columns. */
  options?: string[];
}

export interface AdvancedTableRow {
  /** Stable identifier for the row. */
  id: string;
  /** Cell values keyed by column id. */
  cells: Record<string, AdvancedTableCellValue>;
}

export interface AdvancedTableSort {
  /** The column being sorted. */
  columnId: string;
  /** Whether the sort is descending. */
  desc: boolean;
}

export interface AdvancedTableData {
  /** Schema version of the stored data. */
  version: 1;
  /** Ordered list of column definitions. */
  columns: AdvancedTableColumn[];
  /** Ordered list of rows. */
  rows: AdvancedTableRow[];
  /** Persisted sort order, first entry has the highest precedence. */
  sort?: AdvancedTableSort[];
}

export const AdvancedTableColumnTypes: AdvancedTableColumnType[] = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
];

/** Soft limit on the number of rows stored in a single table. */
export const MaxRows = 10000;

/** Hard limit on the number of columns stored in a single table. */
export const MaxColumns = 200;

/**
 * Limit on the serialized JSON length of a table. The whole table is stored in
 * a single node attribute that is resent on every edit, so it must stay well
 * below the collaboration server's document state limit or the document can no
 * longer sync.
 */
export const MaxDataLength = 512 * 1024;

export const DefaultColumnWidth = 160;

export const MinColumnWidth = 60;

export const MaxColumnWidth = 800;
