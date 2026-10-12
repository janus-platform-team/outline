import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { ThemeProvider } from "styled-components";
import { buildLightTheme } from "../../../styles/theme";
import {
  createEmptyTable,
  MaxDataLength,
  setCell,
  tableDataLength,
} from "../../lib/advancedTable";
import type { AdvancedTableData } from "../../lib/advancedTable";
import { AdvancedTableGrid } from "./Grid";

// Rendering requires a document, which is only present in jsdom runs.
const describeDom = typeof document === "undefined" ? describe.skip : describe;

describeDom("AdvancedTableGrid", () => {
  let container: HTMLDivElement;

  const renderGrid = (data: AdvancedTableData, onChange = vi.fn()) => {
    act(() => {
      ReactDOM.render(
        <ThemeProvider theme={buildLightTheme({})}>
          <AdvancedTableGrid
            data={data}
            isEditable
            isSelected={false}
            onChange={onChange}
          />
        </ThemeProvider>,
        container
      );
    });
    return onChange;
  };

  // jsdom performs no layout, so give elements a size for the virtualizer to
  // render rows into.
  const sizeProps = ["offsetHeight", "offsetWidth"] as const;

  beforeAll(() => {
    for (const prop of sizeProps) {
      Object.defineProperty(HTMLElement.prototype, prop, {
        configurable: true,
        get: () => 400,
      });
    }
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    for (const prop of sizeProps) {
      Reflect.deleteProperty(HTMLElement.prototype, prop);
    }
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it("resizes a column by dragging the header handle", () => {
    const data = createEmptyTable(2, 2);
    const onChange = renderGrid(data);
    const handle = container.querySelector('[role="separator"]');
    const header = container.querySelector<HTMLElement>(
      '[role="columnheader"]'
    );

    act(() => {
      handle?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientX: 100 })
      );
    });
    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 160 }));
    });
    expect(header?.style.width).toBe(`${data.columns[0].width + 60}px`);
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup", { clientX: 160 }));
    });
    const saved: AdvancedTableData = onChange.mock.calls[0][0];
    expect(saved.columns[0].width).toBe(data.columns[0].width + 60);
    expect(saved.columns[1].width).toBe(data.columns[1].width);
  });

  it("edits a cell with the keyboard and writes it to the document", () => {
    vi.useFakeTimers();
    const data = createEmptyTable(1, 2);
    const onChange = renderGrid(data);
    const grid = container.querySelector<HTMLElement>('[role="grid"]');
    const firstCell = container.querySelector('[role="gridcell"]');
    expect(firstCell).toBeTruthy();

    act(() => {
      firstCell?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    act(() => {
      grid?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "x", bubbles: true })
      );
    });
    const input = container.querySelector("input[aria-label='Column 1']");
    expect(input).toBeTruthy();

    act(() => {
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    act(() => {
      vi.runAllTimers();
    });

    const saved: AdvancedTableData = onChange.mock.calls[0][0];
    expect(saved.rows[0].cells[data.columns[0].id]).toBe("x");
    expect(
      container.querySelectorAll('[role="gridcell"][aria-selected="true"]')
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it("rejects edits that would exceed the size limit", () => {
    const data = createEmptyTable(1, 1);
    const columnId = data.columns[0].id;
    data.rows[0].cells[columnId] = "x".repeat(
      MaxDataLength - tableDataLength(data) - 10
    );
    const onChange = renderGrid(data);
    const addRow = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Row"
    );

    act(() => {
      addRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[role="row"]')).toHaveLength(2);
    expect(container.textContent).toContain(
      "The table has reached its maximum size"
    );
  });

  describe("cell ranges", () => {
    const sampleData = () => {
      let data = createEmptyTable(3, 3);
      const [a, b] = data.columns;
      data = setCell(data, data.rows[0].id, a.id, "a,b");
      data = setCell(data, data.rows[0].id, b.id, "x");
      data = setCell(data, data.rows[1].id, a.id, 'say "hi"');
      data = setCell(data, data.rows[1].id, b.id, "y");
      return data;
    };

    const cellAt = (row: number, col: number) =>
      container.querySelector<HTMLElement>(
        `[data-row-index="${row}"] [aria-colindex="${col + 1}"]`
      );

    const selectedCount = () =>
      container.querySelectorAll('[role="gridcell"][aria-selected="true"]')
        .length;

    const press = (row: number, col: number, shiftKey = false) => {
      act(() => {
        cellAt(row, col)?.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, button: 0, shiftKey })
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup"));
      });
    };

    const keyDown = (key: string, shiftKey = false) => {
      act(() => {
        container
          .querySelector('[role="grid"]')
          ?.dispatchEvent(
            new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })
          );
      });
    };

    const clipboardEvent = (type: "copy" | "paste", text = "") => {
      const data = new Map<string, string>([["text/plain", text]]);
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "clipboardData", {
        value: {
          getData: (format: string) => data.get(format) ?? "",
          setData: (format: string, value: string) => data.set(format, value),
        },
      });
      act(() => {
        container.querySelector('[role="grid"]')?.dispatchEvent(event);
      });
      return data;
    };

    const lastSaved = (onChange: ReturnType<typeof vi.fn>) => {
      act(() => {
        vi.runAllTimers();
      });
      const calls = onChange.mock.calls;
      const saved: AdvancedTableData = calls[calls.length - 1][0];
      return saved;
    };

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("extends the range with Shift-click", () => {
      renderGrid(sampleData());
      press(0, 0);
      expect(selectedCount()).toBe(1);
      press(1, 1, true);
      expect(selectedCount()).toBe(4);
    });

    it("extends the range by dragging across cells", () => {
      renderGrid(sampleData());
      act(() => {
        cellAt(0, 0)?.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, button: 0 })
        );
      });
      act(() => {
        cellAt(2, 1)?.dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true, relatedTarget: null })
        );
      });
      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup"));
      });
      expect(selectedCount()).toBe(6);

      // Hovering after the mouse is released does not change the range.
      act(() => {
        cellAt(0, 2)?.dispatchEvent(
          new MouseEvent("mouseover", { bubbles: true, relatedTarget: null })
        );
      });
      expect(selectedCount()).toBe(6);
    });

    it("extends the range with Shift and the arrow keys", () => {
      renderGrid(sampleData());
      press(0, 0);
      keyDown("ArrowDown", true);
      keyDown("ArrowRight", true);
      expect(selectedCount()).toBe(4);
      keyDown("ArrowRight");
      expect(selectedCount()).toBe(1);
    });

    it("collapses the range with Escape", () => {
      renderGrid(sampleData());
      press(0, 0);
      press(1, 1, true);
      keyDown("Escape");
      expect(selectedCount()).toBe(1);
    });

    it("copies a range as CSV", () => {
      renderGrid(sampleData());
      press(0, 0);
      press(1, 1, true);
      const clipboard = clipboardEvent("copy");
      const expected = '"a,b",x\r\n"say ""hi""",y';
      expect(clipboard.get("text/plain")).toBe(expected);
      expect(clipboard.get("text/csv")).toBe(expected);
    });

    it("copies a single cell as its plain value", () => {
      renderGrid(sampleData());
      press(0, 0);
      const clipboard = clipboardEvent("copy");
      expect(clipboard.get("text/plain")).toBe("a,b");
      expect(clipboard.has("text/csv")).toBe(false);
    });

    it("pastes CSV across multiple cells and selects them", () => {
      const data = sampleData();
      const onChange = renderGrid(data);
      press(1, 1);
      clipboardEvent("paste", '1,"two, too"\n3,4\n');
      const saved = lastSaved(onChange);
      const [, b, c] = data.columns;
      expect(saved.rows[1].cells[b.id]).toBe("1");
      expect(saved.rows[1].cells[c.id]).toBe("two, too");
      expect(saved.rows[2].cells[b.id]).toBe("3");
      expect(saved.rows[2].cells[c.id]).toBe("4");
      expect(selectedCount()).toBe(4);
    });

    it("pastes from the top-left cell of the range", () => {
      const data = sampleData();
      const onChange = renderGrid(data);
      press(1, 1);
      press(0, 0, true);
      clipboardEvent("paste", "p,q");
      const saved = lastSaved(onChange);
      const [a, b] = data.columns;
      expect(saved.rows[0].cells[a.id]).toBe("p");
      expect(saved.rows[0].cells[b.id]).toBe("q");
      expect(saved.rows[1].cells[a.id]).toBe('say "hi"');
    });

    it("fills the range when pasting a single value", () => {
      const data = sampleData();
      const onChange = renderGrid(data);
      press(0, 0);
      press(1, 1, true);
      clipboardEvent("paste", "z");
      const saved = lastSaved(onChange);
      const [a, b, c] = data.columns;
      for (const row of saved.rows.slice(0, 2)) {
        expect(row.cells[a.id]).toBe("z");
        expect(row.cells[b.id]).toBe("z");
        expect(row.cells[c.id]).toBeNull();
      }
      expect(saved.rows[2].cells[a.id]).toBeNull();
    });

    it("clears every cell in the range with Delete", () => {
      const data = sampleData();
      const onChange = renderGrid(data);
      press(0, 0);
      press(1, 1, true);
      keyDown("Delete");
      const saved = lastSaved(onChange);
      for (const row of saved.rows) {
        for (const column of saved.columns) {
          expect(row.cells[column.id]).toBeNull();
        }
      }
    });
  });
});
