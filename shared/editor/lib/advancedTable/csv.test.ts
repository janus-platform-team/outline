import {
  inferColumnType,
  parseCsv,
  tableFromCsv,
  tableToCsv,
  toCsv,
} from "./csv";
import { tableDataLength } from "./operations";
import { MaxDataLength, MaxRows } from "./types";

describe("parseCsv", () => {
  it("parses quoted fields with commas, quotes and newlines", () => {
    expect(parseCsv('a,"b,c","d ""e""","f\ng"\r\n1,2,3,4')).toEqual([
      ["a", "b,c", 'd "e"', "f\ng"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("detects tab and semicolon delimiters", () => {
    expect(parseCsv("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a byte order mark and keeps empty fields", () => {
    expect(parseCsv("\uFEFFa,,c")).toEqual([["a", "", "c"]]);
  });
});

describe("toCsv", () => {
  it("quotes fields that need it", () => {
    expect(
      toCsv([
        ["a", "b,c"],
        ['say "hi"', "x\ny"],
      ])
    ).toBe('a,"b,c"\r\n"say ""hi""","x\ny"');
  });

  it("round trips through parseCsv", () => {
    const rows = [
      ["name", "notes"],
      ["one", 'with "quotes", commas\nand lines'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("inferColumnType", () => {
  it("infers types from values", () => {
    expect(inferColumnType(["1", "2.5", "-3", ""])).toBe("number");
    expect(inferColumnType(["true", "No"])).toBe("boolean");
    expect(inferColumnType(["2024-01-01", "2024-12-31"])).toBe("date");
    expect(inferColumnType(["hello", "1"])).toBe("text");
    expect(inferColumnType([])).toBe("text");
    expect(
      inferColumnType(Array.from({ length: 12 }, (_, i) => (i % 2 ? "A" : "B")))
    ).toBe("select");
  });
});

describe("tableFromCsv", () => {
  it("creates typed columns from the header and values", () => {
    const { data, truncated } = tableFromCsv(
      "Name,Qty,Due\nApple,5,2024-01-01\nBanana,,2024-02-01\n"
    );
    expect(truncated).toBe(false);
    expect(data.columns.map((c) => [c.name, c.type])).toEqual([
      ["Name", "text"],
      ["Qty", "number"],
      ["Due", "date"],
    ]);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0].cells[data.columns[1].id]).toBe(5);
    expect(data.rows[1].cells[data.columns[1].id]).toBeNull();
  });

  it("pads ragged rows and names missing headers", () => {
    const { data } = tableFromCsv("A\n1,2");
    expect(data.columns.map((c) => c.name)).toEqual(["A", "Column 2"]);
  });

  it("truncates rows beyond the limit", () => {
    const lines = [
      "n",
      ...Array.from({ length: MaxRows + 5 }, (_, i) => `${i}`),
    ];
    const { data, truncated } = tableFromCsv(lines.join("\n"));
    expect(truncated).toBe(true);
    expect(data.rows).toHaveLength(MaxRows);
  });

  it("truncates rows that would exceed the size limit", () => {
    const value = "x".repeat(500);
    const lines = ["a,b", ...Array.from({ length: 2000 }, () => `${value},1`)];
    const { data, truncated } = tableFromCsv(lines.join("\n"));
    expect(truncated).toBe(true);
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.length).toBeLessThan(2000);
    expect(tableDataLength(data)).toBeLessThanOrEqual(MaxDataLength);
  });
});

describe("tableToCsv", () => {
  it("exports visible columns and selected rows", () => {
    const { data } = tableFromCsv("Name,Done\nApple,true\nBanana,false");
    expect(tableToCsv(data)).toBe("Name,Done\r\nApple,true\r\nBanana,false");
    expect(tableToCsv(data, { rowIds: [data.rows[1].id] })).toBe(
      "Name,Done\r\nBanana,false"
    );
  });
});
