import { v4 as uuidv4 } from "uuid";
import {
  AdvancedTableColumnTypes,
  DefaultColumnWidth,
  MaxColumns,
  MaxColumnWidth,
  MaxDataLength,
  MaxRows,
  MinColumnWidth,
} from "./types";
import type {
  AdvancedTableCellValue,
  AdvancedTableColumn,
  AdvancedTableColumnType,
  AdvancedTableData,
  AdvancedTablePinned,
  AdvancedTableRow,
  AdvancedTableSort,
} from "./types";

/**
 * Creates a new unique identifier for a row or column.
 *
 * @returns a short unique identifier.
 */
export function createId(): string {
  return uuidv4().replace(/-/g, "").slice(0, 12);
}

/**
 * Creates a new empty table with the given dimensions.
 *
 * @param columnCount the number of text columns to create.
 * @param rowCount the number of empty rows to create.
 * @returns the new table data.
 */
export function createEmptyTable(
  columnCount = 3,
  rowCount = 3
): AdvancedTableData {
  const columns: AdvancedTableColumn[] = Array.from(
    { length: columnCount },
    (_, index) => ({
      id: createId(),
      name: `Column ${index + 1}`,
      type: "text",
      width: DefaultColumnWidth,
    })
  );

  return {
    version: 1,
    columns,
    rows: Array.from({ length: rowCount }, () => createRow(columns)),
    sort: [],
  };
}

/**
 * Validates and normalizes arbitrary input, such as parsed JSON, into table
 * data. Invalid input results in an empty table rather than an error.
 *
 * @param input the value to normalize.
 * @returns valid table data.
 */
export function normalizeTableData(input: unknown): AdvancedTableData {
  if (!isRecord(input) || !Array.isArray(input.columns)) {
    return createEmptyTable();
  }

  const seenColumns = new Set<string>();
  const columns: AdvancedTableColumn[] = [];

  for (const raw of input.columns.slice(0, MaxColumns)) {
    if (!isRecord(raw)) {
      continue;
    }
    const id =
      typeof raw.id === "string" && raw.id && !seenColumns.has(raw.id)
        ? raw.id
        : createId();
    seenColumns.add(id);

    const type = isColumnType(raw.type) ? raw.type : "text";
    const column: AdvancedTableColumn = {
      id,
      name: typeof raw.name === "string" ? raw.name : "",
      type,
      width: clampWidth(
        typeof raw.width === "number" ? raw.width : DefaultColumnWidth
      ),
    };

    if (raw.pinned === "left" || raw.pinned === "right") {
      column.pinned = raw.pinned;
    }
    if (raw.hidden === true) {
      column.hidden = true;
    }
    if (Array.isArray(raw.options)) {
      column.options = uniqueStrings(
        raw.options.filter((o): o is string => typeof o === "string")
      );
    }
    columns.push(column);
  }

  const rawRows = Array.isArray(input.rows) ? input.rows : [];
  const seenRows = new Set<string>();
  const rows: AdvancedTableRow[] = [];

  for (const raw of rawRows.slice(0, MaxRows)) {
    if (!isRecord(raw)) {
      continue;
    }
    const id =
      typeof raw.id === "string" && raw.id && !seenRows.has(raw.id)
        ? raw.id
        : createId();
    seenRows.add(id);

    const rawCells = isRecord(raw.cells) ? raw.cells : {};
    const cells: Record<string, AdvancedTableCellValue> = {};
    for (const column of columns) {
      cells[column.id] = coerceValue(rawCells[column.id], column);
    }
    rows.push({ id, cells });
  }

  const sort: AdvancedTableSort[] = [];
  if (Array.isArray(input.sort)) {
    for (const raw of input.sort) {
      if (
        isRecord(raw) &&
        typeof raw.columnId === "string" &&
        seenColumns.has(raw.columnId)
      ) {
        sort.push({ columnId: raw.columnId, desc: raw.desc === true });
      }
    }
  }

  return { version: 1, columns, rows, sort };
}

/**
 * Parses a JSON string into table data, falling back to an empty table.
 *
 * @param json the serialized table.
 * @returns valid table data.
 */
export function parseTableData(json: string | null | undefined) {
  if (!json) {
    return createEmptyTable();
  }
  try {
    return normalizeTableData(JSON.parse(json));
  } catch (_err) {
    return createEmptyTable();
  }
}

/**
 * Coerces a value into the representation stored for the given column type.
 *
 * @param value the raw value.
 * @param column the column the value belongs to.
 * @returns the coerced value, or null if empty or invalid.
 */
export function coerceValue(
  value: unknown,
  column: Pick<AdvancedTableColumn, "type" | "options">
): AdvancedTableCellValue {
  if (value === null || value === undefined) {
    return null;
  }

  switch (column.type) {
    case "number": {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
      }
      if (typeof value === "string") {
        const trimmed = value.trim().replace(/,/g, "");
        if (!trimmed) {
          return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    }
    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value !== 0;
      }
      if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (["true", "yes", "y", "1", "x", "✓"].includes(lower)) {
          return true;
        }
        if (["false", "no", "n", "0", ""].includes(lower)) {
          return false;
        }
      }
      return null;
    }
    case "date": {
      const text = primitiveToText(value).trim();
      if (!text) {
        return null;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return isValidIsoDate(text) ? text : null;
      }
      const time = Date.parse(text);
      if (Number.isNaN(time)) {
        return null;
      }
      return new Date(time).toISOString().slice(0, 10);
    }
    case "select": {
      const text = primitiveToText(value).trim();
      return text ? text : null;
    }
    default: {
      const text = primitiveToText(value);
      return text ? text : null;
    }
  }
}

/**
 * Formats a stored value as display text.
 *
 * @param value the stored value.
 * @param column the column the value belongs to.
 * @returns the formatted text.
 */
export function formatValue(
  value: AdvancedTableCellValue,
  column: Pick<AdvancedTableColumn, "type">
): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (column.type === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

/**
 * Compares two cell values of the same column type for sorting. Empty values
 * always sort last.
 *
 * @param a the first value.
 * @param b the second value.
 * @param type the column type.
 * @returns a negative number, zero or a positive number.
 */
export function compareValues(
  a: AdvancedTableCellValue,
  b: AdvancedTableCellValue,
  type: AdvancedTableColumnType
): number {
  const aEmpty = a === null || a === "";
  const bEmpty = b === null || b === "";
  if (aEmpty && bEmpty) {
    return 0;
  }
  if (aEmpty) {
    return 1;
  }
  if (bEmpty) {
    return -1;
  }

  if (type === "number") {
    return Number(a) - Number(b);
  }
  if (type === "boolean") {
    return Number(a) - Number(b);
  }
  return collator.compare(String(a), String(b));
}

/**
 * Creates an empty row for the given columns.
 *
 * @param columns the table columns.
 * @returns the new row.
 */
export function createRow(columns: AdvancedTableColumn[]): AdvancedTableRow {
  const cells: Record<string, AdvancedTableCellValue> = {};
  for (const column of columns) {
    cells[column.id] = null;
  }
  return { id: createId(), cells };
}

/**
 * Inserts a new empty row.
 *
 * @param data the table data.
 * @param index the index to insert at, defaults to the end.
 * @returns the updated table data.
 */
export function addRow(
  data: AdvancedTableData,
  index = data.rows.length
): AdvancedTableData {
  if (data.rows.length >= MaxRows) {
    return data;
  }
  const rows = [...data.rows];
  rows.splice(clampIndex(index, rows.length), 0, createRow(data.columns));
  return { ...data, rows };
}

/**
 * Removes the rows with the given ids.
 *
 * @param data the table data.
 * @param rowIds the ids of the rows to remove.
 * @returns the updated table data.
 */
export function deleteRows(
  data: AdvancedTableData,
  rowIds: Iterable<string>
): AdvancedTableData {
  const ids = new Set(rowIds);
  if (!ids.size) {
    return data;
  }
  return { ...data, rows: data.rows.filter((row) => !ids.has(row.id)) };
}

/**
 * Inserts a new column.
 *
 * @param data the table data.
 * @param options optional name, type and index of the new column.
 * @returns the updated table data.
 */
export function addColumn(
  data: AdvancedTableData,
  options: {
    name?: string;
    type?: AdvancedTableColumnType;
    index?: number;
  } = {}
): AdvancedTableData {
  if (data.columns.length >= MaxColumns) {
    return data;
  }
  const column: AdvancedTableColumn = {
    id: createId(),
    name: options.name ?? `Column ${data.columns.length + 1}`,
    type: options.type ?? "text",
    width: DefaultColumnWidth,
  };
  if (column.type === "select") {
    column.options = [];
  }
  const columns = [...data.columns];
  columns.splice(
    clampIndex(options.index ?? columns.length, columns.length),
    0,
    column
  );
  return {
    ...data,
    columns,
    rows: data.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [column.id]: null },
    })),
  };
}

/**
 * Removes a column and its cell values.
 *
 * @param data the table data.
 * @param columnId the id of the column to remove.
 * @returns the updated table data.
 */
export function deleteColumn(
  data: AdvancedTableData,
  columnId: string
): AdvancedTableData {
  if (!data.columns.some((c) => c.id === columnId)) {
    return data;
  }
  return {
    ...data,
    columns: data.columns.filter((c) => c.id !== columnId),
    rows: data.rows.map((row) => {
      const { [columnId]: _removed, ...cells } = row.cells;
      return { ...row, cells };
    }),
    sort: (data.sort ?? []).filter((s) => s.columnId !== columnId),
  };
}

/**
 * Moves a column to a new position.
 *
 * @param data the table data.
 * @param columnId the id of the column to move.
 * @param toIndex the destination index.
 * @returns the updated table data.
 */
export function moveColumn(
  data: AdvancedTableData,
  columnId: string,
  toIndex: number
): AdvancedTableData {
  const fromIndex = data.columns.findIndex((c) => c.id === columnId);
  if (fromIndex === -1) {
    return data;
  }
  const columns = [...data.columns];
  const [column] = columns.splice(fromIndex, 1);
  columns.splice(clampIndex(toIndex, columns.length), 0, column);
  return { ...data, columns };
}

/**
 * Updates the properties of a column. Changing the type converts all existing
 * values in the column to the new type.
 *
 * @param data the table data.
 * @param columnId the id of the column to update.
 * @param patch the properties to change.
 * @returns the updated table data.
 */
export function updateColumn(
  data: AdvancedTableData,
  columnId: string,
  patch: Partial<Omit<AdvancedTableColumn, "id">>
): AdvancedTableData {
  const existing = data.columns.find((c) => c.id === columnId);
  if (!existing) {
    return data;
  }

  const column: AdvancedTableColumn = { ...existing, ...patch };
  if (patch.width !== undefined) {
    column.width = clampWidth(patch.width);
  }

  const typeChanged = patch.type !== undefined && patch.type !== existing.type;
  let rows = data.rows;

  if (typeChanged) {
    rows = data.rows.map((row) => ({
      ...row,
      cells: {
        ...row.cells,
        [columnId]: coerceValue(
          formatValue(row.cells[columnId] ?? null, existing),
          column
        ),
      },
    }));

    if (column.type === "select" && !patch.options) {
      column.options = uniqueStrings(
        rows
          .map((row) => row.cells[columnId])
          .filter((v): v is string => typeof v === "string")
      );
    }
  }

  return {
    ...data,
    columns: data.columns.map((c) => (c.id === columnId ? column : c)),
    rows,
  };
}

/**
 * Sets the width of a column, clamped to the allowed range.
 *
 * @param data the table data.
 * @param columnId the id of the column.
 * @param width the new width in pixels.
 * @returns the updated table data.
 */
export function setColumnWidth(
  data: AdvancedTableData,
  columnId: string,
  width: number
): AdvancedTableData {
  return updateColumn(data, columnId, { width });
}

/**
 * Pins or unpins a column.
 *
 * @param data the table data.
 * @param columnId the id of the column.
 * @param pinned the side to pin to, or null to unpin.
 * @returns the updated table data.
 */
export function pinColumn(
  data: AdvancedTableData,
  columnId: string,
  pinned: AdvancedTablePinned | null
): AdvancedTableData {
  return updateColumn(data, columnId, { pinned });
}

/**
 * Sets the value of a single cell, coercing it to the column type. New values
 * in select columns are added to the column options.
 *
 * @param data the table data.
 * @param rowId the id of the row.
 * @param columnId the id of the column.
 * @param value the new value.
 * @returns the updated table data.
 */
export function setCell(
  data: AdvancedTableData,
  rowId: string,
  columnId: string,
  value: unknown
): AdvancedTableData {
  const column = data.columns.find((c) => c.id === columnId);
  const rowIndex = data.rows.findIndex((r) => r.id === rowId);
  if (!column || rowIndex === -1) {
    return data;
  }

  const coerced = coerceValue(value, column);
  const row = data.rows[rowIndex];
  if (row.cells[columnId] === coerced) {
    return data;
  }

  const rows = [...data.rows];
  rows[rowIndex] = { ...row, cells: { ...row.cells, [columnId]: coerced } };

  let columns = data.columns;
  if (
    column.type === "select" &&
    typeof coerced === "string" &&
    !(column.options ?? []).includes(coerced)
  ) {
    columns = data.columns.map((c) =>
      c.id === columnId ? { ...c, options: [...(c.options ?? []), coerced] } : c
    );
  }

  return { ...data, columns, rows };
}

/**
 * Replaces the persisted sort order.
 *
 * @param data the table data.
 * @param sort the new sort order.
 * @returns the updated table data.
 */
export function setSort(
  data: AdvancedTableData,
  sort: AdvancedTableSort[]
): AdvancedTableData {
  const ids = new Set(data.columns.map((c) => c.id));
  return { ...data, sort: sort.filter((s) => ids.has(s.columnId)) };
}

/**
 * Converts the visible table contents to plain text, with tab separated cells
 * and one line per row, starting with the header.
 *
 * @param data the table data.
 * @returns the plain text representation.
 */
export function tableToPlainText(data: AdvancedTableData): string {
  const columns = data.columns.filter((c) => !c.hidden);
  const lines = [columns.map((c) => c.name).join("\t")];
  for (const row of data.rows) {
    lines.push(
      columns.map((c) => formatValue(row.cells[c.id] ?? null, c)).join("\t")
    );
  }
  return lines.join("\n");
}

/**
 * Measures the serialized length of table data as it is stored in the document.
 *
 * @param data the table data.
 * @returns the length of the JSON representation.
 */
export function tableDataLength(data: AdvancedTableData): number {
  return JSON.stringify(data).length;
}

/**
 * Drops rows from the end of the table until its serialized length fits.
 *
 * @param data the table data.
 * @param maxLength the maximum serialized length.
 * @returns the table that fits and whether rows were dropped.
 */
export function fitTableToLength(
  data: AdvancedTableData,
  maxLength = MaxDataLength
): { data: AdvancedTableData; truncated: boolean } {
  let length = tableDataLength({ ...data, rows: [] });
  let count = 0;
  for (const row of data.rows) {
    // Each row after the first is preceded by a comma.
    length += JSON.stringify(row).length + (count ? 1 : 0);
    if (length > maxLength) {
      break;
    }
    count++;
  }
  if (count === data.rows.length) {
    return { data, truncated: false };
  }
  return {
    data: { ...data, rows: data.rows.slice(0, count) },
    truncated: true,
  };
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function primitiveToText(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColumnType(value: unknown): value is AdvancedTableColumnType {
  return AdvancedTableColumnTypes.some((type) => type === value);
}

function isValidIsoDate(text: string) {
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

function clampWidth(width: number) {
  if (!Number.isFinite(width)) {
    return DefaultColumnWidth;
  }
  return Math.round(Math.min(MaxColumnWidth, Math.max(MinColumnWidth, width)));
}

function clampIndex(index: number, length: number) {
  return Math.min(length, Math.max(0, index));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
