import {
  DownloadIcon,
  EyeIcon,
  ImportIcon,
  PlusIcon,
  TableColumnsDistributeIcon,
  TrashIcon,
} from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import type { AdvancedTableColumn } from "../../lib/advancedTable";
import { Popover } from "./Popover";
import {
  Checkbox,
  CheckRow,
  SearchInput,
  Status,
  Toolbar as ToolbarBox,
  ToolbarButton,
  ToolbarSpacer,
} from "./styles";

interface Props {
  /** The quick filter text. */
  query: string;
  /** Total number of rows in the table. */
  totalRows: number;
  /** Number of rows after filtering. */
  filteredRows: number;
  /** Number of selected rows. */
  selectedCount: number;
  /** All columns, including hidden ones. */
  columns: AdvancedTableColumn[];
  /** Whether the grid is editable. */
  isEditable: boolean;
  /** Whether more rows can be added. */
  canAddRow: boolean;
  /** Whether the grid is paginated rather than scrolling. */
  paginate: boolean;
  /** Whether any column filters are active. */
  hasFilters: boolean;
  onQueryChange: (query: string) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onDeleteSelected: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onToggleColumn: (columnId: string, hidden: boolean) => void;
  onTogglePaginate: () => void;
  onClearFilters: () => void;
}

/**
 * The toolbar shown above the grid with search, row and column actions, and
 * CSV import and export.
 */
function ToolbarComponent({
  query,
  totalRows,
  filteredRows,
  selectedCount,
  columns,
  isEditable,
  canAddRow,
  paginate,
  hasFilters,
  onQueryChange,
  onAddRow,
  onAddColumn,
  onDeleteSelected,
  onImport,
  onExport,
  onToggleColumn,
  onTogglePaginate,
  onClearFilters,
}: Props) {
  const { t } = useTranslation();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [columnsAnchor, setColumnsAnchor] = React.useState<HTMLElement | null>(
    null
  );
  const visibleCount = columns.filter((c) => !c.hidden).length;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
    event.target.value = "";
  };

  return (
    <ToolbarBox role="toolbar" aria-label={t("Table toolbar")}>
      <SearchInput
        type="search"
        aria-label={t("Search table")}
        placeholder={`${t("Search")}…`}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.stopPropagation()}
      />
      <Status aria-live="polite">
        {filteredRows === totalRows
          ? t("{{ count }} rows", { count: totalRows })
          : t("{{ filtered }} of {{ count }} rows", {
              filtered: filteredRows,
              count: totalRows,
            })}
        {selectedCount > 0 &&
          ` · ${t("{{ count }} selected", { count: selectedCount })}`}
      </Status>
      {hasFilters && (
        <ToolbarButton type="button" onClick={onClearFilters}>
          {t("Clear filters")}
        </ToolbarButton>
      )}
      <ToolbarSpacer />
      {isEditable && (
        <>
          <ToolbarButton type="button" disabled={!canAddRow} onClick={onAddRow}>
            <PlusIcon size={18} /> {t("Row")}
          </ToolbarButton>
          <ToolbarButton type="button" onClick={onAddColumn}>
            <PlusIcon size={18} /> {t("Column")}
          </ToolbarButton>
          {selectedCount > 0 && (
            <ToolbarButton type="button" onClick={onDeleteSelected}>
              <TrashIcon size={18} /> {t("Delete")}
            </ToolbarButton>
          )}
          <ToolbarButton
            type="button"
            aria-haspopup="dialog"
            onClick={(event) => setColumnsAnchor(event.currentTarget)}
          >
            <EyeIcon size={18} /> {t("Columns")}
          </ToolbarButton>
          <ToolbarButton type="button" onClick={() => fileRef.current?.click()}>
            <ImportIcon size={18} /> {t("Import")}
          </ToolbarButton>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
            hidden
            onChange={handleFileChange}
          />
        </>
      )}
      <ToolbarButton type="button" onClick={onExport}>
        <DownloadIcon size={18} /> {t("Export")}
      </ToolbarButton>
      <ToolbarButton
        type="button"
        aria-pressed={paginate}
        onClick={onTogglePaginate}
        title={paginate ? t("Show all rows") : t("Show rows in pages")}
      >
        <TableColumnsDistributeIcon size={18} />{" "}
        {paginate ? t("Pages") : t("Scroll")}
      </ToolbarButton>
      {columnsAnchor && (
        <Popover
          anchor={columnsAnchor}
          onClose={() => setColumnsAnchor(null)}
          label={t("Columns")}
        >
          {columns.map((column) => (
            <CheckRow key={column.id}>
              <Checkbox
                type="checkbox"
                checked={!column.hidden}
                disabled={!column.hidden && visibleCount <= 1}
                onChange={() => onToggleColumn(column.id, !column.hidden)}
              />
              {column.name || t("Untitled")}
            </CheckRow>
          ))}
        </Popover>
      )}
    </ToolbarBox>
  );
}

export const Toolbar = React.memo(ToolbarComponent);
