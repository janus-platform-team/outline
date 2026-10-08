import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  ColumnSizingState,
  SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BackIcon, NextIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  addColumn,
  addRow,
  compareValues,
  deleteColumn,
  deleteRows,
  filterRows,
  formatValue,
  isFilterActive,
  MaxColumnWidth,
  MaxRows,
  MinColumnWidth,
  moveColumn,
  parseCsv,
  pinColumn,
  setCell,
  setColumnWidth,
  setSort,
  tableFromCsv,
  toCsv,
  updateColumn,
} from "../../lib/advancedTable";
import type {
  AdvancedTableColumn,
  AdvancedTableData,
  AdvancedTableRow,
  AdvancedTableSort,
  ColumnFilter,
} from "../../lib/advancedTable";
import { Cell } from "./Cell";
import type { MoveDirection } from "./Cell";
import { ColumnMenu } from "./ColumnMenu";
import { FilterPopover } from "./FilterPopover";
import { HeaderCell } from "./HeaderCell";
import {
  Body,
  CellBox,
  Checkbox,
  DropIndicator,
  Empty,
  Footer,
  HeaderBox,
  HeaderHeight,
  HeaderRow,
  IconButton,
  PageSize,
  Row,
  RowHeight,
  Scroller,
  SelectionColumnWidth,
  Wrapper,
} from "./styles";
import { Toolbar } from "./Toolbar";
import { useTableState } from "./useTableState";

export interface AdvancedTableGridProps {
  /** The table data stored in the document. */
  data: AdvancedTableData;
  /** Whether the document is editable. */
  isEditable: boolean;
  /** Whether the node is selected in the editor. */
  isSelected: boolean;
  /** Called to write updated data to the document. */
  onChange: (data: AdvancedTableData) => void;
  /** Called to return focus to the editor with the node selected. */
  onExit?: () => void;
  /** Called to undo the last document change. */
  onUndo?: () => void;
  /** Called to redo the last undone document change. */
  onRedo?: () => void;
}

/** Attribute used to identify events that originate inside the grid. */
export const GridAttribute = "data-advanced-table-grid";

/** Number of center columns above which horizontal virtualization is used. */
const ColumnVirtualizationThreshold = 30;

interface CellPosition {
  row: number;
  col: number;
}

interface EditingState extends CellPosition {
  initialText?: string;
}

interface PopoverState {
  columnId: string;
  anchor: HTMLElement;
}

interface Layout {
  left: AdvancedTableColumn[];
  center: AdvancedTableColumn[];
  right: AdvancedTableColumn[];
  ordered: AdvancedTableColumn[];
  styles: Record<string, React.CSSProperties>;
  leftWidth: number;
  totalWidth: number;
}

/**
 * A spreadsheet-like data grid with virtualized rows and columns, sorting,
 * filtering, column pinning, resizing and reordering, inline editing, row
 * selection and CSV import and export.
 */
function AdvancedTableGridComponent({
  data,
  isEditable,
  isSelected,
  onChange,
  onExit,
  onUndo,
  onRedo,
}: AdvancedTableGridProps) {
  const { t } = useTranslation();
  const { draft, update, flush } = useTableState(data, onChange);

  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<
    Record<string, ColumnFilter | undefined>
  >({});
  const [localSort, setLocalSort] = React.useState<AdvancedTableSort[] | null>(
    null
  );
  const [liveWidths, setLiveWidths] = React.useState<ColumnSizingState>({});
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [active, setActive] = React.useState<CellPosition | null>(null);
  const [editing, setEditing] = React.useState<EditingState | null>(null);
  const [paginate, setPaginate] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [menu, setMenu] = React.useState<PopoverState | null>(null);
  const [filterMenu, setFilterMenu] = React.useState<PopoverState | null>(null);
  const [dropX, setDropX] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const selectionAnchorRef = React.useRef<number | null>(null);

  // Layout of visible columns, pinned columns are grouped at either side.
  const layout = React.useMemo<Layout>(() => {
    const visible = draft.columns
      .filter((column) => !column.hidden)
      .map((column) =>
        liveWidths[column.id] === undefined
          ? column
          : { ...column, width: liveWidths[column.id] }
      );
    const left = visible.filter((c) => c.pinned === "left");
    const right = visible.filter((c) => c.pinned === "right");
    const center = visible.filter((c) => !c.pinned);
    const styles: Record<string, React.CSSProperties> = {};

    let offset = SelectionColumnWidth;
    for (const column of left) {
      styles[column.id] = { width: column.width, left: offset };
      offset += column.width;
    }
    const leftWidth = offset;
    for (const column of center) {
      styles[column.id] = { width: column.width };
      offset += column.width;
    }
    let rightOffset = 0;
    for (const column of [...right].reverse()) {
      styles[column.id] = { width: column.width, right: rightOffset };
      rightOffset += column.width;
    }

    return {
      left,
      center,
      right,
      ordered: [...left, ...center, ...right],
      styles,
      leftWidth,
      totalWidth: offset + rightOffset,
    };
  }, [draft.columns, liveWidths]);

  const filteredRows = React.useMemo(
    () => filterRows(draft.rows, draft.columns, filters, query),
    [draft.rows, draft.columns, filters, query]
  );

  const columnDefs = React.useMemo<ColumnDef<AdvancedTableRow>[]>(
    () =>
      draft.columns.map((column) => ({
        id: column.id,
        accessorFn: (row) => row.cells[column.id] ?? undefined,
        size: column.width,
        minSize: MinColumnWidth,
        maxSize: MaxColumnWidth,
        sortUndefined: "last",
        sortingFn: (a, b) =>
          compareValues(
            a.original.cells[column.id] ?? null,
            b.original.cells[column.id] ?? null,
            column.type
          ),
      })),
    [draft.columns]
  );

  const activeSort = React.useMemo(
    () => (isEditable ? draft.sort : (localSort ?? draft.sort)) ?? [],
    [isEditable, draft.sort, localSort]
  );
  const sorting = React.useMemo<SortingState>(
    () => activeSort.map((s) => ({ id: s.columnId, desc: s.desc })),
    [activeSort]
  );

  const table = useReactTable({
    data: filteredRows,
    columns: columnDefs,
    state: {
      sorting,
      columnSizing: liveWidths,
      pagination: { pageIndex, pageSize: PageSize },
    },
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !paginate,
    autoResetPageIndex: false,
    enableMultiSort: true,
    columnResizeMode: "onChange",
    onColumnSizingChange: setLiveWidths,
  });

  const rows = table.getRowModel().rows;
  const pageCount = paginate ? Math.max(1, table.getPageCount()) : 1;
  const resizingColumn = table.getState().columnSizingInfo.isResizingColumn;
  const hasFilters = Object.values(filters).some(isFilterActive);

  const latest = React.useRef({ rows, layout, active, editing, draft });
  latest.current = { rows, layout, active, editing, draft };

  React.useEffect(() => {
    if (pageIndex > pageCount - 1) {
      setPageIndex(pageCount - 1);
    }
  }, [pageIndex, pageCount]);

  // Persist column widths once a resize gesture completes.
  React.useEffect(() => {
    if (resizingColumn || !Object.keys(liveWidths).length) {
      return;
    }
    const widths = liveWidths;
    update(
      (current) =>
        Object.entries(widths).reduce(
          (acc, [id, width]) => setColumnWidth(acc, id, width),
          current
        ),
      { immediate: true }
    );
    setLiveWidths({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingColumn]);

  React.useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => RowHeight,
    overscan: 12,
    scrollPaddingStart: HeaderHeight,
  });

  const virtualizeColumns =
    layout.center.length > ColumnVirtualizationThreshold;
  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: virtualizeColumns ? layout.center.length : 0,
    getScrollElement: () => scrollerRef.current,
    estimateSize: (index) => layout.center[index]?.width ?? 0,
    scrollMargin: layout.leftWidth,
    overscan: 4,
  });

  React.useEffect(() => {
    columnVirtualizer.measure();
  }, [layout, columnVirtualizer]);

  const virtualColumns = columnVirtualizer.getVirtualItems();
  const firstColumn = virtualColumns[0]?.index ?? 0;
  const lastColumn =
    virtualColumns[virtualColumns.length - 1]?.index ??
    layout.center.length - 1;

  const centerSlice = React.useMemo(() => {
    if (!virtualizeColumns) {
      return { columns: layout.center, start: 0, padLeft: 0, padRight: 0 };
    }
    const columns = layout.center.slice(firstColumn, lastColumn + 1);
    const before = layout.center
      .slice(0, firstColumn)
      .reduce((sum, c) => sum + c.width, 0);
    const after = layout.center
      .slice(lastColumn + 1)
      .reduce((sum, c) => sum + c.width, 0);
    return { columns, start: firstColumn, padLeft: before, padRight: after };
  }, [layout, virtualizeColumns, firstColumn, lastColumn]);

  const focusGrid = React.useCallback(() => {
    scrollerRef.current?.focus({ preventScroll: true });
  }, []);

  const scrollToCell = React.useCallback(
    (position: CellPosition) => {
      rowVirtualizer.scrollToIndex(position.row, { align: "auto" });
      requestAnimationFrame(() => {
        const element = scrollerRef.current?.querySelector(
          `[data-row-index="${position.row}"] [aria-colindex="${
            position.col + 1
          }"]`
        );
        element?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    },
    [rowVirtualizer]
  );

  const moveActive = React.useCallback(
    (direction: MoveDirection, from?: CellPosition) => {
      const { rows: currentRows, layout: currentLayout } = latest.current;
      const origin = from ?? latest.current.active;
      if (!origin || direction === "none") {
        return;
      }
      const maxRow = currentRows.length - 1;
      const maxCol = currentLayout.ordered.length - 1;
      const next = { ...origin };
      if (direction === "up") {
        next.row = Math.max(0, origin.row - 1);
      } else if (direction === "down") {
        next.row = Math.min(maxRow, origin.row + 1);
      } else if (direction === "left") {
        if (origin.col > 0) {
          next.col = origin.col - 1;
        } else if (origin.row > 0) {
          next.row = origin.row - 1;
          next.col = maxCol;
        }
      } else if (direction === "right") {
        if (origin.col < maxCol) {
          next.col = origin.col + 1;
        } else if (origin.row < maxRow) {
          next.row = origin.row + 1;
          next.col = 0;
        }
      }
      setActive(next);
      scrollToCell(next);
    },
    [scrollToCell]
  );

  const handleActivate = React.useCallback(
    (row: number, col: number) => {
      setActive({ row, col });
      setEditing((current) =>
        current && (current.row !== row || current.col !== col) ? null : current
      );
      focusGrid();
    },
    [focusGrid]
  );

  const handleStartEdit = React.useCallback(
    (row: number, col: number) => {
      if (!isEditable) {
        return;
      }
      setActive({ row, col });
      setEditing({ row, col });
    },
    [isEditable]
  );

  const handleCommit = React.useCallback(
    (rowId: string, columnId: string, value: unknown, move: MoveDirection) => {
      const position = latest.current.editing ?? latest.current.active;
      update((current) => setCell(current, rowId, columnId, value));
      setEditing(null);
      if (position && move !== "none") {
        moveActive(move, position);
        focusGrid();
      }
    },
    [update, moveActive, focusGrid]
  );

  const handleCancel = React.useCallback(() => {
    setEditing(null);
    focusGrid();
  }, [focusGrid]);

  const cycleSort = React.useCallback(
    (columnId: string, multi: boolean) => {
      const apply = (current: AdvancedTableSort[]) => {
        const existing = current.find((s) => s.columnId === columnId);
        const others = multi
          ? current.filter((s) => s.columnId !== columnId)
          : [];
        if (!existing) {
          return [...others, { columnId, desc: false }];
        }
        if (!existing.desc) {
          return multi
            ? current.map((s) =>
                s.columnId === columnId ? { columnId, desc: true } : s
              )
            : [{ columnId, desc: true }];
        }
        return others;
      };

      if (isEditable) {
        update((current) => setSort(current, apply(current.sort ?? [])), {
          immediate: true,
        });
      } else {
        setLocalSort((current) => apply(current ?? draft.sort ?? []));
      }
    },
    [isEditable, update, draft.sort]
  );

  const setColumnSort = React.useCallback(
    (columnId: string, desc: boolean | null) => {
      const next = desc === null ? [] : [{ columnId, desc }];
      if (isEditable) {
        update((current) => setSort(current, next), { immediate: true });
      } else {
        setLocalSort(next);
      }
    },
    [isEditable, update]
  );

  const handleHeaderMouseDown = React.useCallback(
    (columnId: string, event: React.MouseEvent) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const startX = event.clientX;
      const multi = event.shiftKey;
      let dragging = false;
      let beforeId: string | null = null;

      const computeDrop = (clientX: number) => {
        const header = headerRef.current;
        const wrapper = wrapperRef.current;
        if (!header || !wrapper) {
          return;
        }
        const cells = Array.from(
          header.querySelectorAll<HTMLElement>("[data-column-id]")
        );
        const wrapperLeft = wrapper.getBoundingClientRect().left;
        beforeId = null;
        let indicator = 0;
        for (const cell of cells) {
          const rect = cell.getBoundingClientRect();
          indicator = rect.right - wrapperLeft;
          if (clientX < rect.left + rect.width / 2) {
            beforeId = cell.dataset.columnId ?? null;
            indicator = rect.left - wrapperLeft;
            break;
          }
        }
        setDropX(indicator);
      };

      const handleMove = (moveEvent: MouseEvent) => {
        if (!isEditable) {
          return;
        }
        if (!dragging && Math.abs(moveEvent.clientX - startX) > 5) {
          dragging = true;
        }
        if (dragging) {
          computeDrop(moveEvent.clientX);
        }
      };

      const handleUp = () => {
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        setDropX(null);

        if (!dragging) {
          cycleSort(columnId, multi);
          return;
        }
        if (beforeId === columnId) {
          return;
        }
        update(
          (current) => {
            const without = current.columns.filter((c) => c.id !== columnId);
            const index = beforeId
              ? without.findIndex((c) => c.id === beforeId)
              : without.length;
            return moveColumn(current, columnId, index);
          },
          { immediate: true }
        );
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
    },
    [isEditable, cycleSort, update]
  );

  const handleResizeStart = React.useCallback(
    (columnId: string, event: React.MouseEvent) => {
      const header = table
        .getFlatHeaders()
        .find((h) => h.column.id === columnId);
      header?.getResizeHandler()(event);
    },
    [table]
  );

  const handleAutoSize = React.useCallback(
    (columnId: string) => {
      const column = latest.current.draft.columns.find(
        (c) => c.id === columnId
      );
      if (!column) {
        return;
      }
      const longest = latest.current.draft.rows
        .slice(0, 500)
        .reduce(
          (max, row) =>
            Math.max(
              max,
              formatValue(row.cells[columnId] ?? null, column).length
            ),
          column.name.length + 6
        );
      update(
        (current) => setColumnWidth(current, columnId, longest * 7.5 + 24),
        {
          immediate: true,
        }
      );
    },
    [update]
  );

  const handleOpenMenu = React.useCallback(
    (columnId: string, anchor: HTMLElement) => setMenu({ columnId, anchor }),
    []
  );

  const handleOpenFilter = React.useCallback(
    (columnId: string, anchor: HTMLElement) =>
      setFilterMenu({ columnId, anchor }),
    []
  );

  const toggleRowSelection = React.useCallback(
    (rowIndex: number, range: boolean) => {
      const currentRows = latest.current.rows;
      const anchor = selectionAnchorRef.current;
      setSelected((current) => {
        const next = new Set(current);
        if (range && anchor !== null) {
          const [from, to] =
            anchor < rowIndex ? [anchor, rowIndex] : [rowIndex, anchor];
          for (let i = from; i <= to; i++) {
            const id = currentRows[i]?.original.id;
            if (id) {
              next.add(id);
            }
          }
        } else {
          const id = currentRows[rowIndex]?.original.id;
          if (id && next.has(id)) {
            next.delete(id);
          } else if (id) {
            next.add(id);
          }
        }
        return next;
      });
      selectionAnchorRef.current = rowIndex;
    },
    []
  );

  const selectedVisibleCount = React.useMemo(
    () => filteredRows.filter((row) => selected.has(row.id)).length,
    [filteredRows, selected]
  );
  const allSelected =
    filteredRows.length > 0 && selectedVisibleCount === filteredRows.length;

  const handleToggleAll = React.useCallback(() => {
    setSelected(
      allSelected ? new Set() : new Set(filteredRows.map((row) => row.id))
    );
  }, [allSelected, filteredRows]);

  const handleAddRow = React.useCallback(() => {
    update((current) => addRow(current), { immediate: true });
    setQuery("");
    setFilters({});
    requestAnimationFrame(() => {
      const index = latest.current.rows.length - 1;
      if (paginate) {
        setPageIndex(
          Math.max(
            0,
            Math.ceil(latest.current.draft.rows.length / PageSize) - 1
          )
        );
      }
      const position = { row: Math.max(0, index), col: 0 };
      setActive(position);
      scrollToCell(position);
      focusGrid();
    });
  }, [update, paginate, scrollToCell, focusGrid]);

  const handleAddColumn = React.useCallback(() => {
    update((current) => addColumn(current), { immediate: true });
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({
        left: scrollerRef.current.scrollWidth,
      });
    });
  }, [update]);

  const handleDeleteSelected = React.useCallback(() => {
    update((current) => deleteRows(current, selected), { immediate: true });
    setSelected(new Set());
    setActive(null);
  }, [update, selected]);

  const handleImport = React.useCallback(
    async (file: File) => {
      const text = await file.text();
      const hasContent = latest.current.draft.rows.some((row) =>
        Object.values(row.cells).some((value) => value !== null)
      );
      if (
        hasContent &&
        !window.confirm(t("Replace the table contents with the imported file?"))
      ) {
        return;
      }
      const result = tableFromCsv(text);
      update(() => result.data, { immediate: true });
      setFilters({});
      setQuery("");
      setSelected(new Set());
      setActive(null);
      setNotice(
        result.truncated
          ? t("Only the first {{ count }} rows were imported", {
              count: MaxRows,
            })
          : t("Imported {{ count }} rows", { count: result.data.rows.length })
      );
    },
    [t, update]
  );

  const handleExport = React.useCallback(() => {
    const columns = latest.current.layout.ordered;
    const exportRows = table.getPrePaginationRowModel().rows;
    const csv = toCsv([
      columns.map((c) => c.name),
      ...exportRows.map((row) =>
        columns.map((c) => formatValue(row.original.cells[c.id] ?? null, c))
      ),
    ]);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "table.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [table]);

  const handleToggleColumn = React.useCallback(
    (columnId: string, hidden: boolean) => {
      update((current) => updateColumn(current, columnId, { hidden }), {
        immediate: true,
      });
      setActive(null);
    },
    [update]
  );

  const handleTogglePaginate = React.useCallback(() => {
    setPaginate((value) => !value);
    setPageIndex(0);
    setActive(null);
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setFilters({});
    setQuery("");
  }, []);

  const handleQueryChange = React.useCallback((value: string) => {
    setQuery(value);
    setPageIndex(0);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== scrollerRef.current || editing) {
      return;
    }
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key;

    if (mod && (key === "z" || key === "Z" || key === "y")) {
      event.preventDefault();
      event.stopPropagation();
      flush();
      if (key === "y" || event.shiftKey) {
        onRedo?.();
      } else {
        onUndo?.();
      }
      return;
    }

    if (mod && key === "a") {
      event.preventDefault();
      event.stopPropagation();
      setSelected(new Set(filteredRows.map((row) => row.id)));
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (selected.size) {
        setSelected(new Set());
        return;
      }
      setActive(null);
      flush();
      onExit?.();
      return;
    }

    if (!rows.length || !layout.ordered.length) {
      return;
    }

    if (!active) {
      if (key.startsWith("Arrow") || key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        setActive({ row: 0, col: 0 });
      }
      return;
    }

    const column = layout.ordered[active.col];
    const row = rows[active.row]?.original;
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };

    switch (key) {
      case "ArrowUp":
        handled();
        if (mod) {
          setActive({ ...active, row: 0 });
          scrollToCell({ ...active, row: 0 });
        } else {
          moveActive("up");
        }
        return;
      case "ArrowDown":
        handled();
        if (mod) {
          const last = { ...active, row: rows.length - 1 };
          setActive(last);
          scrollToCell(last);
        } else {
          moveActive("down");
        }
        return;
      case "ArrowLeft":
        handled();
        if (active.col > 0) {
          moveActive("left");
        }
        return;
      case "ArrowRight":
        handled();
        if (active.col < layout.ordered.length - 1) {
          moveActive("right");
        }
        return;
      case "Home": {
        handled();
        const next = mod ? { row: 0, col: 0 } : { ...active, col: 0 };
        setActive(next);
        scrollToCell(next);
        return;
      }
      case "End": {
        handled();
        const next = mod
          ? { row: rows.length - 1, col: layout.ordered.length - 1 }
          : { ...active, col: layout.ordered.length - 1 };
        setActive(next);
        scrollToCell(next);
        return;
      }
      case "PageUp":
      case "PageDown": {
        handled();
        const delta = key === "PageUp" ? -10 : 10;
        const next = {
          ...active,
          row: Math.min(rows.length - 1, Math.max(0, active.row + delta)),
        };
        setActive(next);
        scrollToCell(next);
        return;
      }
      case "Tab": {
        const atEnd =
          active.row === rows.length - 1 &&
          active.col === layout.ordered.length - 1;
        const atStart = active.row === 0 && active.col === 0;
        if ((event.shiftKey && atStart) || (!event.shiftKey && atEnd)) {
          return;
        }
        handled();
        moveActive(event.shiftKey ? "left" : "right");
        return;
      }
      case "Enter":
      case "F2":
        handled();
        if (!isEditable || !column || !row) {
          return;
        }
        if (column.type === "boolean") {
          update((current) =>
            setCell(current, row.id, column.id, row.cells[column.id] !== true)
          );
        } else {
          setEditing({ ...active });
        }
        return;
      case " ":
        handled();
        if (event.shiftKey) {
          toggleRowSelection(active.row, false);
        } else if (isEditable && column?.type === "boolean" && row) {
          update((current) =>
            setCell(current, row.id, column.id, row.cells[column.id] !== true)
          );
        } else if (isEditable) {
          setEditing({ ...active, initialText: " " });
        }
        return;
      case "Delete":
      case "Backspace":
        handled();
        if (isEditable && column && row) {
          update((current) => setCell(current, row.id, column.id, null));
        }
        return;
      default:
        if (
          isEditable &&
          !mod &&
          !event.altKey &&
          key.length === 1 &&
          column?.type !== "boolean"
        ) {
          handled();
          setEditing({ ...active, initialText: key });
        }
    }
  };

  const handleCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (event.target !== scrollerRef.current) {
      return;
    }
    const columns = layout.ordered;
    let text: string | null = null;

    if (selected.size) {
      const selectedRows = table
        .getPrePaginationRowModel()
        .rows.filter((row) => selected.has(row.original.id));
      text = toCsv(
        [
          columns.map((c) => c.name),
          ...selectedRows.map((row) =>
            columns.map((c) => formatValue(row.original.cells[c.id] ?? null, c))
          ),
        ],
        "\t"
      );
    } else if (active) {
      const column = columns[active.col];
      const row = rows[active.row]?.original;
      if (column && row) {
        text = formatValue(row.cells[column.id] ?? null, column);
      }
    }

    if (text !== null) {
      event.preventDefault();
      event.clipboardData.setData("text/plain", text);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (event.target !== scrollerRef.current || !isEditable || !active) {
      return;
    }
    const text = event.clipboardData.getData("text/plain");
    if (!text) {
      return;
    }
    event.preventDefault();
    const grid = parseCsv(
      text.replace(/\r?\n$/, ""),
      text.includes("\t") ? "\t" : ","
    );
    const columns = layout.ordered;
    const targetRowIds = rows.map((row) => row.original.id);
    const start = active;

    update(
      (current) => {
        let next = current;
        grid.forEach((values, rowOffset) => {
          let rowId = targetRowIds[start.row + rowOffset];
          if (!rowId) {
            next = addRow(next);
            rowId = next.rows[next.rows.length - 1]?.id;
          }
          if (!rowId) {
            return;
          }
          values.forEach((value, colOffset) => {
            const column = columns[start.col + colOffset];
            if (column && rowId) {
              next = setCell(next, rowId, column.id, value);
            }
          });
        });
        return next;
      },
      { immediate: true }
    );
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      wrapperRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    flush();
  };

  const menuColumn = menu
    ? draft.columns.find((c) => c.id === menu.columnId)
    : undefined;
  const filterColumn = filterMenu
    ? draft.columns.find((c) => c.id === filterMenu.columnId)
    : undefined;
  const sortFor = (columnId: string) => {
    const index = activeSort.findIndex((s) => s.columnId === columnId);
    if (index === -1) {
      return { direction: false as const, index: null };
    }
    return {
      direction: activeSort[index].desc ? ("desc" as const) : ("asc" as const),
      index: activeSort.length > 1 ? index + 1 : null,
    };
  };

  const renderHeader = (column: AdvancedTableColumn, colIndex: number) => {
    const sort = sortFor(column.id);
    return (
      <HeaderCell
        key={column.id}
        column={column}
        colIndex={colIndex}
        style={layout.styles[column.id]}
        sortDirection={sort.direction}
        sortIndex={sort.index}
        isFiltered={isFilterActive(filters[column.id])}
        isResizing={resizingColumn === column.id}
        isEditable={isEditable}
        onHeaderMouseDown={handleHeaderMouseDown}
        onResizeStart={handleResizeStart}
        onAutoSize={handleAutoSize}
        onOpenMenu={handleOpenMenu}
        onOpenFilter={handleOpenFilter}
      />
    );
  };

  const virtualRows = rowVirtualizer.getVirtualItems();
  const centerOffset = layout.left.length;
  const rightOffset = layout.left.length + layout.center.length;

  return (
    <Wrapper
      ref={wrapperRef}
      $selected={isSelected}
      onBlur={handleBlur}
      {...{ [GridAttribute]: "" }}
    >
      <Toolbar
        query={query}
        totalRows={draft.rows.length}
        filteredRows={filteredRows.length}
        selectedCount={selectedVisibleCount}
        columns={draft.columns}
        isEditable={isEditable}
        canAddRow={draft.rows.length < MaxRows}
        paginate={paginate}
        hasFilters={hasFilters}
        onQueryChange={handleQueryChange}
        onAddRow={handleAddRow}
        onAddColumn={handleAddColumn}
        onDeleteSelected={handleDeleteSelected}
        onImport={handleImport}
        onExport={handleExport}
        onToggleColumn={handleToggleColumn}
        onTogglePaginate={handleTogglePaginate}
        onClearFilters={handleClearFilters}
      />
      <Scroller
        ref={scrollerRef}
        role="grid"
        aria-label={t("Advanced table")}
        aria-rowcount={filteredRows.length + 1}
        aria-colcount={layout.ordered.length}
        aria-multiselectable
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onCopy={handleCopy}
        onPaste={handlePaste}
      >
        <HeaderRow
          ref={headerRef}
          role="row"
          aria-rowindex={1}
          style={{ width: layout.totalWidth }}
        >
          <HeaderBox
            $pinned
            $align="center"
            style={{ width: SelectionColumnWidth, left: 0, padding: 0 }}
          >
            <Checkbox
              type="checkbox"
              aria-label={t("Select all rows")}
              checked={allSelected}
              ref={(element: HTMLInputElement | null) => {
                if (element) {
                  element.indeterminate =
                    selectedVisibleCount > 0 && !allSelected;
                }
              }}
              onChange={handleToggleAll}
              onMouseDown={(event) => event.stopPropagation()}
            />
          </HeaderBox>
          {layout.left.map((column, i) => renderHeader(column, i))}
          {centerSlice.padLeft > 0 && (
            <div style={{ width: centerSlice.padLeft, flex: "none" }} />
          )}
          {centerSlice.columns.map((column, i) =>
            renderHeader(column, centerOffset + centerSlice.start + i)
          )}
          {centerSlice.padRight > 0 && (
            <div style={{ width: centerSlice.padRight, flex: "none" }} />
          )}
          {layout.right.map((column, i) =>
            renderHeader(column, rightOffset + i)
          )}
        </HeaderRow>
        <Body
          role="rowgroup"
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: layout.totalWidth,
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) {
              return null;
            }
            return (
              <GridRow
                key={row.original.id}
                row={row.original}
                rowIndex={virtualRow.index}
                top={virtualRow.start}
                width={layout.totalWidth}
                layout={layout}
                centerSlice={centerSlice}
                isRowSelected={selected.has(row.original.id)}
                activeCol={active?.row === virtualRow.index ? active.col : null}
                editing={editing?.row === virtualRow.index ? editing : null}
                isEditable={isEditable}
                onToggleSelection={toggleRowSelection}
                onActivate={handleActivate}
                onStartEdit={handleStartEdit}
                onCommit={handleCommit}
                onCancel={handleCancel}
              />
            );
          })}
        </Body>
        {rows.length === 0 && (
          <Empty>
            {draft.rows.length ? t("No matching rows") : t("No rows")}
          </Empty>
        )}
      </Scroller>
      {(paginate || notice) && (
        <Footer>
          {notice && <span aria-live="polite">{notice}</span>}
          {paginate && (
            <>
              <IconButton
                type="button"
                aria-label={t("Previous page")}
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((index) => index - 1)}
              >
                <BackIcon size={18} />
              </IconButton>
              <span>
                {t("Page {{ page }} of {{ count }}", {
                  page: pageIndex + 1,
                  count: pageCount,
                })}
              </span>
              <IconButton
                type="button"
                aria-label={t("Next page")}
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((index) => index + 1)}
              >
                <NextIcon size={18} />
              </IconButton>
            </>
          )}
        </Footer>
      )}
      {dropX !== null && <DropIndicator style={{ left: dropX }} />}
      {menu && menuColumn && (
        <ColumnMenu
          key={menuColumn.id}
          column={menuColumn}
          anchor={menu.anchor}
          isEditable={isEditable}
          sortDirection={sortFor(menuColumn.id).direction}
          isLastVisible={layout.ordered.length <= 1}
          onClose={() => setMenu(null)}
          onRename={(name) =>
            update(
              (current) => updateColumn(current, menuColumn.id, { name }),
              {
                immediate: true,
              }
            )
          }
          onChangeType={(type) =>
            update(
              (current) => updateColumn(current, menuColumn.id, { type }),
              {
                immediate: true,
              }
            )
          }
          onSort={(desc) => setColumnSort(menuColumn.id, desc)}
          onPin={(pinned) =>
            update((current) => pinColumn(current, menuColumn.id, pinned), {
              immediate: true,
            })
          }
          onHide={() => handleToggleColumn(menuColumn.id, true)}
          onInsert={(side) =>
            update(
              (current) => {
                const index = current.columns.findIndex(
                  (c) => c.id === menuColumn.id
                );
                return addColumn(current, {
                  index: side === "left" ? index : index + 1,
                });
              },
              { immediate: true }
            )
          }
          onDelete={() => {
            update((current) => deleteColumn(current, menuColumn.id), {
              immediate: true,
            });
            setFilters(({ [menuColumn.id]: _removed, ...rest }) => rest);
            setActive(null);
          }}
        />
      )}
      {filterMenu && filterColumn && (
        <FilterPopover
          column={filterColumn}
          rows={draft.rows}
          filter={filters[filterColumn.id]}
          anchor={filterMenu.anchor}
          onChange={(filter) => {
            setFilters((current) => ({
              ...current,
              [filterColumn.id]: filter,
            }));
            setPageIndex(0);
            setActive(null);
          }}
          onClose={() => setFilterMenu(null)}
        />
      )}
    </Wrapper>
  );
}

export const AdvancedTableGrid = React.memo(AdvancedTableGridComponent);

interface GridRowProps {
  row: AdvancedTableRow;
  rowIndex: number;
  top: number;
  width: number;
  layout: Layout;
  centerSlice: {
    columns: AdvancedTableColumn[];
    start: number;
    padLeft: number;
    padRight: number;
  };
  isRowSelected: boolean;
  activeCol: number | null;
  editing: EditingState | null;
  isEditable: boolean;
  onToggleSelection: (rowIndex: number, range: boolean) => void;
  onActivate: (row: number, col: number) => void;
  onStartEdit: (row: number, col: number) => void;
  onCommit: (
    rowId: string,
    columnId: string,
    value: unknown,
    move: MoveDirection
  ) => void;
  onCancel: () => void;
}

const GridRow = React.memo(function GridRow_({
  row,
  rowIndex,
  top,
  width,
  layout,
  centerSlice,
  isRowSelected,
  activeCol,
  editing,
  isEditable,
  onToggleSelection,
  onActivate,
  onStartEdit,
  onCommit,
  onCancel,
}: GridRowProps) {
  const { t } = useTranslation();
  const renderCell = (column: AdvancedTableColumn, colIndex: number) => (
    <Cell
      key={column.id}
      rowId={row.id}
      rowIndex={rowIndex}
      colIndex={colIndex}
      column={column}
      value={row.cells[column.id] ?? null}
      style={layout.styles[column.id]}
      isActive={activeCol === colIndex}
      isEditing={editing?.col === colIndex}
      initialText={editing?.col === colIndex ? editing.initialText : undefined}
      isEditable={isEditable}
      onActivate={onActivate}
      onStartEdit={onStartEdit}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
  const centerOffset = layout.left.length;
  const rightOffset = layout.left.length + layout.center.length;

  return (
    <Row
      role="row"
      aria-rowindex={rowIndex + 2}
      aria-selected={isRowSelected}
      data-row-index={rowIndex}
      $selected={isRowSelected}
      style={{ transform: `translateY(${top}px)`, width }}
    >
      <CellBox
        $pinned
        $align="center"
        style={{ width: SelectionColumnWidth, left: 0, padding: 0 }}
      >
        <Checkbox
          type="checkbox"
          tabIndex={-1}
          aria-label={t("Select row")}
          checked={isRowSelected}
          onChange={() => undefined}
          onMouseDown={(event) => event.preventDefault()}
          onClick={(event) => onToggleSelection(rowIndex, event.shiftKey)}
        />
      </CellBox>
      {layout.left.map((column, i) => renderCell(column, i))}
      {centerSlice.padLeft > 0 && (
        <div style={{ width: centerSlice.padLeft, flex: "none" }} />
      )}
      {centerSlice.columns.map((column, i) =>
        renderCell(column, centerOffset + centerSlice.start + i)
      )}
      {centerSlice.padRight > 0 && (
        <div style={{ width: centerSlice.padRight, flex: "none" }} />
      )}
      {layout.right.map((column, i) => renderCell(column, rightOffset + i))}
    </Row>
  );
});
