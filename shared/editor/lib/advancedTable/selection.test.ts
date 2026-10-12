import { createEmptyTable, setCell, updateColumn } from "./operations";
import {
  getPasteDelimiter,
  getRangeBounds,
  isMultiCellRange,
  rangeToMatrix,
} from "./selection";

describe("getRangeBounds", () => {
  const expected = { top: 1, bottom: 3, left: 0, right: 2 };

  it.each([
    ["down and right", { row: 1, col: 0 }, { row: 3, col: 2 }],
    ["up and left", { row: 3, col: 2 }, { row: 1, col: 0 }],
    ["down and left", { row: 1, col: 2 }, { row: 3, col: 0 }],
    ["up and right", { row: 3, col: 0 }, { row: 1, col: 2 }],
  ])("normalizes a drag %s", (_direction, anchor, focus) => {
    expect(getRangeBounds(anchor, focus)).toEqual(expected);
  });

  it("returns a single cell without an anchor", () => {
    expect(getRangeBounds(null, { row: 2, col: 1 })).toEqual({
      top: 2,
      bottom: 2,
      left: 1,
      right: 1,
    });
  });
});

describe("isMultiCellRange", () => {
  it("detects single and multi cell ranges", () => {
    expect(isMultiCellRange({ top: 1, bottom: 1, left: 2, right: 2 })).toBe(
      false
    );
    expect(isMultiCellRange({ top: 1, bottom: 2, left: 2, right: 2 })).toBe(
      true
    );
    expect(isMultiCellRange({ top: 1, bottom: 1, left: 0, right: 2 })).toBe(
      true
    );
  });
});

describe("rangeToMatrix", () => {
  it("returns formatted values for the given visible columns", () => {
    let data = createEmptyTable(3, 3);
    const [a, b, c] = data.columns;
    data = updateColumn(data, b.id, { type: "number", hidden: true });
    data = updateColumn(data, c.id, { type: "boolean", pinned: "left" });
    data = setCell(data, data.rows[0].id, a.id, "one");
    data = setCell(data, data.rows[1].id, a.id, "two");
    data = setCell(data, data.rows[1].id, c.id, true);

    // Visible columns in display order: pinned column first, hidden excluded.
    const columns = [data.columns[2], data.columns[0]];
    expect(
      rangeToMatrix(
        { top: 0, bottom: 1, left: 0, right: 1 },
        data.rows,
        columns
      )
    ).toEqual([
      ["false", "one"],
      ["true", "two"],
    ]);
    expect(
      rangeToMatrix(
        { top: 1, bottom: 2, left: 1, right: 1 },
        data.rows,
        columns
      )
    ).toEqual([["two"], [""]]);
  });
});

describe("getPasteDelimiter", () => {
  it("prefers commas and falls back to tabs for spreadsheet text", () => {
    expect(getPasteDelimiter("a,b\nc,d")).toBe(",");
    expect(getPasteDelimiter("a\tb\nc\td")).toBe("\t");
    expect(getPasteDelimiter('"a\tb",c')).toBe(",");
    expect(getPasteDelimiter("single")).toBe(",");
  });
});
