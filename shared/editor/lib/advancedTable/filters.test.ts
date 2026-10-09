import {
  distinctValues,
  filterRows,
  isFilterActive,
  matchesFilter,
  matchesQuickFilter,
} from "./filters";
import type { AdvancedTableColumn, AdvancedTableRow } from "./types";

const columns: AdvancedTableColumn[] = [
  { id: "name", name: "Name", type: "text", width: 100 },
  { id: "qty", name: "Qty", type: "number", width: 100 },
  { id: "due", name: "Due", type: "date", width: 100 },
  { id: "done", name: "Done", type: "boolean", width: 100 },
  {
    id: "status",
    name: "Status",
    type: "select",
    width: 100,
    options: ["Open", "Closed", "Blocked"],
  },
  { id: "secret", name: "Secret", type: "text", width: 100, hidden: true },
];

const rows: AdvancedTableRow[] = [
  {
    id: "1",
    cells: {
      name: "Apple",
      qty: 5,
      due: "2024-01-10",
      done: true,
      status: "Open",
      secret: "zebra",
    },
  },
  {
    id: "2",
    cells: {
      name: "Banana",
      qty: 12,
      due: "2024-03-01",
      done: false,
      status: "Closed",
      secret: null,
    },
  },
  {
    id: "3",
    cells: {
      name: null,
      qty: null,
      due: null,
      done: null,
      status: null,
      secret: null,
    },
  },
];

describe("matchesFilter", () => {
  it("supports text operators", () => {
    const col = columns[0];
    expect(
      matchesFilter(
        "Apple",
        { kind: "text", operator: "contains", value: "PP" },
        col
      )
    ).toBe(true);
    expect(
      matchesFilter(
        "Apple",
        { kind: "text", operator: "equals", value: "app" },
        col
      )
    ).toBe(false);
    expect(
      matchesFilter(
        "Apple",
        { kind: "text", operator: "startsWith", value: "ap" },
        col
      )
    ).toBe(true);
    expect(
      matchesFilter(
        "Apple",
        { kind: "text", operator: "endsWith", value: "le" },
        col
      )
    ).toBe(true);
    expect(
      matchesFilter(
        "Apple",
        { kind: "text", operator: "notContains", value: "x" },
        col
      )
    ).toBe(true);
    expect(
      matchesFilter(null, { kind: "text", operator: "blank", value: "" }, col)
    ).toBe(true);
    expect(
      matchesFilter("a", { kind: "text", operator: "notBlank", value: "" }, col)
    ).toBe(true);
  });

  it("supports numeric and date ranges", () => {
    expect(
      matchesFilter(5, { kind: "range", min: "1", max: "10" }, columns[1])
    ).toBe(true);
    expect(matchesFilter(12, { kind: "range", max: "10" }, columns[1])).toBe(
      false
    );
    expect(matchesFilter(null, { kind: "range", min: "1" }, columns[1])).toBe(
      false
    );
    expect(
      matchesFilter(
        "2024-02-01",
        { kind: "range", min: "2024-01-15" },
        columns[2]
      )
    ).toBe(true);
    expect(
      matchesFilter(
        "2024-01-01",
        { kind: "range", min: "2024-01-15" },
        columns[2]
      )
    ).toBe(false);
  });

  it("supports set filters including blanks", () => {
    const filter = { kind: "set" as const, values: ["true", ""] };
    expect(matchesFilter(true, filter, columns[3])).toBe(true);
    expect(matchesFilter(false, filter, columns[3])).toBe(false);
    expect(matchesFilter(null, filter, columns[3])).toBe(true);
  });
});

describe("isFilterActive", () => {
  it("ignores empty filters", () => {
    expect(isFilterActive(undefined)).toBe(false);
    expect(
      isFilterActive({ kind: "text", operator: "contains", value: " " })
    ).toBe(false);
    expect(isFilterActive({ kind: "text", operator: "blank", value: "" })).toBe(
      true
    );
    expect(isFilterActive({ kind: "range", min: "", max: "" })).toBe(false);
    expect(isFilterActive({ kind: "set", values: [] })).toBe(true);
  });
});

describe("matchesQuickFilter", () => {
  it("searches the given columns case-insensitively", () => {
    expect(matchesQuickFilter(rows[0], columns, "APP")).toBe(true);
    expect(matchesQuickFilter(rows[0], columns, "nothing")).toBe(false);
    expect(matchesQuickFilter(rows[0], columns, "  ")).toBe(true);
  });
});

describe("filterRows", () => {
  it("combines column filters and the quick filter", () => {
    expect(
      filterRows(rows, columns, { qty: { kind: "range", min: "1" } }, "").map(
        (r) => r.id
      )
    ).toEqual(["1", "2"]);

    expect(
      filterRows(
        rows,
        columns,
        { qty: { kind: "range", min: "1" } },
        "banana"
      ).map((r) => r.id)
    ).toEqual(["2"]);
  });

  it("does not search hidden columns", () => {
    expect(filterRows(rows, columns, {}, "zebra")).toEqual([]);
  });

  it("returns the original array when nothing is active", () => {
    expect(filterRows(rows, columns, {}, "")).toBe(rows);
  });
});

describe("distinctValues", () => {
  it("includes select options and blanks last", () => {
    expect(distinctValues(rows, columns[4])).toEqual([
      "Blocked",
      "Closed",
      "Open",
      "",
    ]);
    expect(distinctValues(rows, columns[3])).toEqual(["false", "true", ""]);
  });
});
