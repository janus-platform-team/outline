import { formatValue } from "./operations";
import type {
  AdvancedTableCellValue,
  AdvancedTableColumn,
  AdvancedTableRow,
} from "./types";

export type TextFilterOperator =
  | "contains"
  | "notContains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "blank"
  | "notBlank";

export interface TextFilter {
  kind: "text";
  operator: TextFilterOperator;
  value: string;
}

export interface RangeFilter {
  kind: "range";
  /** Inclusive lower bound, a number or ISO date depending on column type. */
  min?: string;
  /** Inclusive upper bound, a number or ISO date depending on column type. */
  max?: string;
}

export interface SetFilter {
  kind: "set";
  /** The allowed display values, empty string represents blank cells. */
  values: string[];
}

export type ColumnFilter = TextFilter | RangeFilter | SetFilter;

/**
 * Returns the filter kind that applies to a column type.
 *
 * @param column the column.
 * @returns the filter kind.
 */
export function filterKindForColumn(
  column: Pick<AdvancedTableColumn, "type">
): ColumnFilter["kind"] {
  switch (column.type) {
    case "number":
    case "date":
      return "range";
    case "boolean":
    case "select":
      return "set";
    default:
      return "text";
  }
}

/**
 * Whether a filter would exclude any values.
 *
 * @param filter the filter to check.
 * @returns true if the filter is active.
 */
export function isFilterActive(filter: ColumnFilter | undefined): boolean {
  if (!filter) {
    return false;
  }
  switch (filter.kind) {
    case "text":
      return (
        filter.operator === "blank" ||
        filter.operator === "notBlank" ||
        filter.value.trim() !== ""
      );
    case "range":
      return !!filter.min?.trim() || !!filter.max?.trim();
    case "set":
      return true;
  }
}

/**
 * Tests whether a cell value passes a column filter.
 *
 * @param value the cell value.
 * @param filter the column filter.
 * @param column the column the value belongs to.
 * @returns true if the value should be shown.
 */
export function matchesFilter(
  value: AdvancedTableCellValue,
  filter: ColumnFilter,
  column: Pick<AdvancedTableColumn, "type">
): boolean {
  const text = formatValue(value, column);

  switch (filter.kind) {
    case "text": {
      const haystack = text.toLocaleLowerCase();
      const needle = filter.value.trim().toLocaleLowerCase();
      switch (filter.operator) {
        case "blank":
          return text.trim() === "";
        case "notBlank":
          return text.trim() !== "";
        case "equals":
          return !needle || haystack === needle;
        case "notContains":
          return !needle || !haystack.includes(needle);
        case "startsWith":
          return !needle || haystack.startsWith(needle);
        case "endsWith":
          return !needle || haystack.endsWith(needle);
        default:
          return !needle || haystack.includes(needle);
      }
    }
    case "range": {
      const min = filter.min?.trim();
      const max = filter.max?.trim();
      if (!min && !max) {
        return true;
      }
      if (value === null || value === "") {
        return false;
      }
      if (column.type === "number") {
        const num = Number(value);
        if (min && Number.isFinite(Number(min)) && num < Number(min)) {
          return false;
        }
        if (max && Number.isFinite(Number(max)) && num > Number(max)) {
          return false;
        }
        return true;
      }
      if (min && text < min) {
        return false;
      }
      if (max && text > max) {
        return false;
      }
      return true;
    }
    case "set":
      return filter.values.includes(text);
  }
}

/**
 * Tests whether any visible cell in a row contains the search query.
 *
 * @param row the row to test.
 * @param columns the columns to search.
 * @param query the search text.
 * @returns true if the row matches.
 */
export function matchesQuickFilter(
  row: AdvancedTableRow,
  columns: AdvancedTableColumn[],
  query: string
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) {
    return true;
  }
  return columns.some((column) =>
    formatValue(row.cells[column.id] ?? null, column)
      .toLocaleLowerCase()
      .includes(needle)
  );
}

/**
 * Returns the rows that pass all column filters and the quick filter.
 *
 * @param rows the rows to filter.
 * @param columns the table columns.
 * @param filters active filters keyed by column id.
 * @param query the quick filter text.
 * @returns the matching rows, in their original order.
 */
export function filterRows(
  rows: AdvancedTableRow[],
  columns: AdvancedTableColumn[],
  filters: Record<string, ColumnFilter | undefined>,
  query: string
): AdvancedTableRow[] {
  const active = columns
    .map((column) => ({ column, filter: filters[column.id] }))
    .filter(
      (entry): entry is { column: AdvancedTableColumn; filter: ColumnFilter } =>
        isFilterActive(entry.filter)
    );
  const searchable = columns.filter((c) => !c.hidden);

  if (!active.length && !query.trim()) {
    return rows;
  }

  return rows.filter(
    (row) =>
      active.every(({ column, filter }) =>
        matchesFilter(row.cells[column.id] ?? null, filter, column)
      ) && matchesQuickFilter(row, searchable, query)
  );
}

/**
 * Returns the distinct display values in a column, used to build set filters.
 *
 * @param rows the table rows.
 * @param column the column.
 * @returns the sorted distinct values, including "" for blank cells.
 */
export function distinctValues(
  rows: AdvancedTableRow[],
  column: AdvancedTableColumn
): string[] {
  const values = new Set<string>(
    column.type === "select" ? (column.options ?? []) : []
  );
  if (column.type === "boolean") {
    values.add("true");
    values.add("false");
  }
  for (const row of rows) {
    values.add(formatValue(row.cells[column.id] ?? null, column));
  }
  return Array.from(values).sort((a, b) => {
    if (a === "") {
      return 1;
    }
    if (b === "") {
      return -1;
    }
    return a.localeCompare(b);
  });
}
