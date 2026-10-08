import ReactDOM from "react-dom";
import { act } from "react-dom/test-utils";
import { ThemeProvider } from "styled-components";
import { buildLightTheme } from "../../../styles/theme";
import { createEmptyTable } from "../../lib/advancedTable";
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
});
