import {
  coerceValue,
  createId,
  fitTableToLength,
  formatValue,
  normalizeTableData,
} from "./operations";
import { DefaultColumnWidth, MaxColumns, MaxRows } from "./types";
import type {
  AdvancedTableCellValue,
  AdvancedTableColumn,
  AdvancedTableColumnType,
  AdvancedTableData,
} from "./types";

export interface CsvImportResult {
  /** The imported table. */
  data: AdvancedTableData;
  /** Whether rows beyond the row or size limit were dropped. */
  truncated: boolean;
}

/**
 * Parses delimited text into rows of fields, following RFC 4180 quoting rules.
 *
 * @param text the delimited text.
 * @param delimiter the field delimiter, detected automatically if omitted.
 * @returns the parsed rows.
 */
export function parseCsv(text: string, delimiter?: string): string[][] {
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Serializes rows of fields into CSV text, quoting fields where required.
 *
 * @param rows the rows to serialize.
 * @param delimiter the field delimiter.
 * @returns the CSV text.
 */
export function toCsv(rows: string[][], delimiter = ","): string {
  return rows
    .map((row) =>
      row
        .map((field) =>
          /[",\r\n\t]/.test(field) || field.includes(delimiter)
            ? `"${field.replace(/"/g, '""')}"`
            : field
        )
        .join(delimiter)
    )
    .join("\r\n");
}

/**
 * Creates table data from delimited text. The first row is used as the header
 * and column types are inferred from the values.
 *
 * @param text the delimited text.
 * @param delimiter the field delimiter, detected automatically if omitted.
 * @returns the imported table and whether it was truncated.
 */
export function tableFromCsv(
  text: string,
  delimiter?: string
): CsvImportResult {
  const parsed = parseCsv(text, delimiter).filter(
    (row) => !(row.length === 1 && row[0] === "")
  );
  const [header = [], ...body] = parsed;
  const width = Math.min(
    MaxColumns,
    Math.max(header.length, ...body.map((row) => row.length), 0)
  );
  const truncated = body.length > MaxRows;
  const records = body.slice(0, MaxRows);

  const columns: AdvancedTableColumn[] = Array.from(
    { length: width },
    (_, index) => {
      const type = inferColumnType(records.map((row) => row[index] ?? ""));
      const column: AdvancedTableColumn = {
        id: createId(),
        name: header[index]?.trim() || `Column ${index + 1}`,
        type,
        width: DefaultColumnWidth,
      };
      if (type === "select") {
        column.options = Array.from(
          new Set(records.map((row) => (row[index] ?? "").trim()))
        ).filter(Boolean);
      }
      return column;
    }
  );

  const rows = records.map((record) => {
    const cells: Record<string, AdvancedTableCellValue> = {};
    columns.forEach((column, index) => {
      cells[column.id] = coerceValue(record[index] ?? "", column);
    });
    return { id: createId(), cells };
  });

  const fitted = fitTableToLength(
    normalizeTableData({ version: 1, columns, rows, sort: [] })
  );
  return {
    data: fitted.data,
    truncated: truncated || fitted.truncated,
  };
}

/**
 * Serializes table data to CSV, including a header row.
 *
 * @param data the table data.
 * @param options optionally include hidden columns or limit to specific rows.
 * @returns the CSV text.
 */
export function tableToCsv(
  data: AdvancedTableData,
  options: {
    includeHidden?: boolean;
    rowIds?: string[];
    delimiter?: string;
  } = {}
): string {
  const columns = options.includeHidden
    ? data.columns
    : data.columns.filter((c) => !c.hidden);
  const rowIds = options.rowIds ? new Set(options.rowIds) : undefined;
  const rows = rowIds ? data.rows.filter((r) => rowIds.has(r.id)) : data.rows;

  return toCsv(
    [
      columns.map((c) => c.name),
      ...rows.map((row) =>
        columns.map((c) => formatValue(row.cells[c.id] ?? null, c))
      ),
    ],
    options.delimiter
  );
}

/**
 * Infers the most specific column type that fits all non-empty values.
 *
 * @param values the raw values in the column.
 * @returns the inferred column type.
 */
export function inferColumnType(values: string[]): AdvancedTableColumnType {
  const filled = values.map((v) => v.trim()).filter(Boolean);
  if (!filled.length) {
    return "text";
  }
  if (filled.every((v) => /^-?[\d,]*\.?\d+(e[+-]?\d+)?$/i.test(v))) {
    return "number";
  }
  if (filled.every((v) => /^(true|false|yes|no)$/i.test(v))) {
    return "boolean";
  }
  if (filled.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) {
    return "date";
  }
  const distinct = new Set(filled);
  if (
    filled.length >= 10 &&
    distinct.size <= 12 &&
    distinct.size <= filled.length / 3 &&
    filled.every((v) => v.length <= 40)
  ) {
    return "select";
  }
  return "text";
}

function detectDelimiter(text: string) {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const tabs = firstLine.split("\t").length;
  const commas = firstLine.split(",").length;
  const semicolons = firstLine.split(";").length;
  if (tabs >= commas && tabs >= semicolons && tabs > 1) {
    return "\t";
  }
  if (semicolons > commas) {
    return ";";
  }
  return ",";
}
