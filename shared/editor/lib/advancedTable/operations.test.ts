import {
  addColumn,
  addRow,
  coerceValue,
  compareValues,
  createEmptyTable,
  deleteColumn,
  deleteRows,
  moveColumn,
  normalizeTableData,
  parseTableData,
  pinColumn,
  setCell,
  setColumnWidth,
  setSort,
  tableToPlainText,
  updateColumn,
} from "./operations";
import { MaxColumnWidth, MinColumnWidth } from "./types";

describe("createEmptyTable", () => {
  it("creates the requested dimensions with empty cells", () => {
    const data = createEmptyTable(2, 4);
    expect(data.columns).toHaveLength(2);
    expect(data.rows).toHaveLength(4);
    expect(data.rows[0].cells[data.columns[0].id]).toBeNull();
    expect(new Set(data.rows.map((r) => r.id)).size).toBe(4);
  });
});

describe("normalizeTableData", () => {
  it("falls back to an empty table for invalid input", () => {
    expect(normalizeTableData(null).columns).toHaveLength(3);
    expect(normalizeTableData("nope").rows).toHaveLength(3);
    expect(normalizeTableData({ rows: [] }).columns).toHaveLength(3);
  });

  it("repairs invalid columns, rows and sort entries", () => {
    const data = normalizeTableData({
      columns: [
        { id: "a", name: "A", type: "number", width: 5 },
        { id: "a", name: "Dup", type: "bogus", width: 9999, pinned: "top" },
        "garbage",
      ],
      rows: [
        { id: "r1", cells: { a: "12", extra: "x" } },
        { id: "r1", cells: null },
        42,
      ],
      sort: [
        { columnId: "a", desc: true },
        { columnId: "missing", desc: false },
      ],
    });

    expect(data.columns).toHaveLength(2);
    expect(data.columns[0]).toMatchObject({
      id: "a",
      type: "number",
      width: MinColumnWidth,
    });
    expect(data.columns[1].id).not.toBe("a");
    expect(data.columns[1].type).toBe("text");
    expect(data.columns[1].width).toBe(MaxColumnWidth);
    expect(data.columns[1].pinned).toBeUndefined();

    expect(data.rows).toHaveLength(2);
    expect(data.rows[0].cells).toEqual({ a: 12, [data.columns[1].id]: null });
    expect(data.rows[1].id).not.toBe("r1");
    expect(data.sort).toEqual([{ columnId: "a", desc: true }]);
  });
});

describe("parseTableData", () => {
  it("handles invalid JSON", () => {
    expect(parseTableData("{not json").columns).toHaveLength(3);
    expect(parseTableData(undefined).columns).toHaveLength(3);
  });

  it("round trips valid JSON", () => {
    const data = createEmptyTable(1, 1);
    expect(parseTableData(JSON.stringify(data))).toEqual(data);
  });
});

describe("coerceValue", () => {
  it("coerces numbers", () => {
    expect(coerceValue("1,234.5", { type: "number" })).toBe(1234.5);
    expect(coerceValue("abc", { type: "number" })).toBeNull();
    expect(coerceValue("", { type: "number" })).toBeNull();
    expect(coerceValue(Infinity, { type: "number" })).toBeNull();
  });

  it("coerces booleans", () => {
    expect(coerceValue("Yes", { type: "boolean" })).toBe(true);
    expect(coerceValue("0", { type: "boolean" })).toBe(false);
    expect(coerceValue("maybe", { type: "boolean" })).toBeNull();
  });

  it("coerces dates to ISO format", () => {
    expect(coerceValue("2024-02-29", { type: "date" })).toBe("2024-02-29");
    expect(coerceValue("2023-02-29", { type: "date" })).toBeNull();
    expect(coerceValue("2024-03-05T10:00:00Z", { type: "date" })).toBe(
      "2024-03-05"
    );
    expect(coerceValue("not a date", { type: "date" })).toBeNull();
  });

  it("keeps text and treats empty strings as null", () => {
    expect(coerceValue(" hi ", { type: "text" })).toBe(" hi ");
    expect(coerceValue("", { type: "text" })).toBeNull();
    expect(coerceValue(5, { type: "text" })).toBe("5");
  });
});

describe("compareValues", () => {
  it("sorts numbers numerically and empty values last", () => {
    const values = [10, null, 2, 33];
    values.sort((a, b) => compareValues(a, b, "number"));
    expect(values).toEqual([2, 10, 33, null]);
  });

  it("sorts text naturally", () => {
    const values = ["item 10", "item 2", "Item 1"];
    values.sort((a, b) => compareValues(a, b, "text"));
    expect(values).toEqual(["Item 1", "item 2", "item 10"]);
  });
});

describe("row and column operations", () => {
  it("adds and deletes rows", () => {
    const data = createEmptyTable(2, 2);
    const added = addRow(data, 0);
    expect(added.rows).toHaveLength(3);
    expect(added.rows[1]).toBe(data.rows[0]);

    const removed = deleteRows(added, [added.rows[0].id, added.rows[2].id]);
    expect(removed.rows.map((r) => r.id)).toEqual([data.rows[0].id]);
    expect(data.rows).toHaveLength(2);
  });

  it("adds, moves and deletes columns", () => {
    const data = createEmptyTable(2, 1);
    const added = addColumn(data, { name: "Price", type: "number", index: 0 });
    expect(added.columns[0].name).toBe("Price");
    const newId = added.columns[0].id;
    expect(added.rows[0].cells[newId]).toBeNull();

    const moved = moveColumn(added, newId, 2);
    expect(moved.columns[2].id).toBe(newId);

    const sorted = setSort(moved, [{ columnId: newId, desc: false }]);
    const removed = deleteColumn(sorted, newId);
    expect(removed.columns).toHaveLength(2);
    expect(removed.rows[0].cells[newId]).toBeUndefined();
    expect(removed.sort).toEqual([]);
  });

  it("converts values when changing column type", () => {
    let data = createEmptyTable(1, 3);
    const columnId = data.columns[0].id;
    data = setCell(data, data.rows[0].id, columnId, "42");
    data = setCell(data, data.rows[1].id, columnId, "hello");

    const numeric = updateColumn(data, columnId, { type: "number" });
    expect(numeric.rows.map((r) => r.cells[columnId])).toEqual([
      42,
      null,
      null,
    ]);

    const select = updateColumn(data, columnId, { type: "select" });
    expect(select.columns[0].options).toEqual(["42", "hello"]);
  });

  it("clamps widths and pins columns", () => {
    const data = createEmptyTable(1, 0);
    const columnId = data.columns[0].id;
    expect(setColumnWidth(data, columnId, 1).columns[0].width).toBe(
      MinColumnWidth
    );
    expect(pinColumn(data, columnId, "left").columns[0].pinned).toBe("left");
    expect(pinColumn(data, columnId, null).columns[0].pinned).toBeNull();
  });

  it("returns the same object when a cell value is unchanged", () => {
    const data = createEmptyTable(1, 1);
    expect(setCell(data, data.rows[0].id, data.columns[0].id, "")).toBe(data);
    expect(setCell(data, "missing", data.columns[0].id, "x")).toBe(data);
  });

  it("adds new select values to the column options", () => {
    let data = addColumn(createEmptyTable(0, 1), { type: "select" });
    data = setCell(data, data.rows[0].id, data.columns[0].id, "Open");
    expect(data.columns[0].options).toEqual(["Open"]);
  });
});

describe("tableToPlainText", () => {
  it("includes the header and skips hidden columns", () => {
    let data = createEmptyTable(2, 1);
    const [a, b] = data.columns;
    data = setCell(data, data.rows[0].id, a.id, "one");
    data = setCell(data, data.rows[0].id, b.id, "two");
    data = updateColumn(data, b.id, { hidden: true });
    expect(tableToPlainText(data)).toBe(`${a.name}\none`);
  });
});
