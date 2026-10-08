import * as React from "react";
import { useTranslation } from "react-i18next";
import { distinctValues, filterKindForColumn } from "../../lib/advancedTable";
import type {
  AdvancedTableColumn,
  AdvancedTableRow,
  ColumnFilter,
  RangeFilter,
  SetFilter,
  TextFilter,
  TextFilterOperator,
} from "../../lib/advancedTable";
import { Popover } from "./Popover";
import {
  Checkbox,
  CheckRow,
  MenuField,
  MenuItem,
  MenuLabel,
  MenuRow,
  MenuSeparator,
} from "./styles";

interface Props {
  /** The column being filtered. */
  column: AdvancedTableColumn;
  /** All rows, used to build the list of values for set filters. */
  rows: AdvancedTableRow[];
  /** The current filter, if any. */
  filter: ColumnFilter | undefined;
  /** The element the popover is anchored to. */
  anchor: HTMLElement;
  /** Called with the new filter, or undefined to clear it. */
  onChange: (filter: ColumnFilter | undefined) => void;
  onClose: () => void;
}

const MaxSetValues = 500;

/**
 * Filter controls for a single column. The available controls depend on the
 * column type: text conditions, numeric or date ranges, or a value list.
 */
export function FilterPopover({
  column,
  rows,
  filter,
  anchor,
  onChange,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const kind = filterKindForColumn(column);

  return (
    <Popover anchor={anchor} onClose={onClose} label={t("Filter")}>
      {kind === "text" && (
        <TextFilterFields
          filter={filter?.kind === "text" ? filter : undefined}
          onChange={onChange}
        />
      )}
      {kind === "range" && (
        <RangeFilterFields
          type={column.type === "date" ? "date" : "number"}
          filter={filter?.kind === "range" ? filter : undefined}
          onChange={onChange}
        />
      )}
      {kind === "set" && (
        <SetFilterFields
          column={column}
          rows={rows}
          filter={filter?.kind === "set" ? filter : undefined}
          onChange={onChange}
        />
      )}
      <MenuSeparator />
      <MenuItem
        type="button"
        disabled={!filter}
        onClick={() => {
          onChange(undefined);
          onClose();
        }}
      >
        {t("Clear filter")}
      </MenuItem>
    </Popover>
  );
}

interface FieldsProps<T extends ColumnFilter> {
  filter?: T;
  onChange: (filter: ColumnFilter | undefined) => void;
}

function TextFilterFields({ filter, onChange }: FieldsProps<TextFilter>) {
  const { t } = useTranslation();
  const operator = filter?.operator ?? "contains";
  const value = filter?.value ?? "";
  const operators: { value: TextFilterOperator; label: string }[] = [
    { value: "contains", label: t("Contains") },
    { value: "notContains", label: t("Does not contain") },
    { value: "equals", label: t("Equals") },
    { value: "startsWith", label: t("Starts with") },
    { value: "endsWith", label: t("Ends with") },
    { value: "blank", label: t("Is empty") },
    { value: "notBlank", label: t("Is not empty") },
  ];
  const needsValue = operator !== "blank" && operator !== "notBlank";

  return (
    <>
      <MenuLabel>{t("Condition")}</MenuLabel>
      <MenuField>
        <select
          aria-label={t("Condition")}
          value={operator}
          onChange={(event) => {
            const next = operators.find((o) => o.value === event.target.value);
            if (next) {
              onChange({ kind: "text", operator: next.value, value });
            }
          }}
        >
          {operators.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </MenuField>
      {needsValue && (
        <MenuField>
          <input
            aria-label={t("Filter value")}
            placeholder={`${t("Filter")}…`}
            value={value}
            autoFocus
            onChange={(event) =>
              onChange({ kind: "text", operator, value: event.target.value })
            }
          />
        </MenuField>
      )}
    </>
  );
}

function RangeFilterFields({
  type,
  filter,
  onChange,
}: FieldsProps<RangeFilter> & { type: "number" | "date" }) {
  const { t } = useTranslation();
  const min = filter?.min ?? "";
  const max = filter?.max ?? "";

  return (
    <>
      <MenuLabel>{t("Range")}</MenuLabel>
      <MenuRow>
        <MenuField style={{ padding: 0, flex: 1 }}>
          <input
            type={type}
            aria-label={t("Minimum")}
            placeholder={t("Min")}
            value={min}
            autoFocus
            onChange={(event) =>
              onChange({ kind: "range", min: event.target.value, max })
            }
          />
        </MenuField>
        <MenuField style={{ padding: 0, flex: 1 }}>
          <input
            type={type}
            aria-label={t("Maximum")}
            placeholder={t("Max")}
            value={max}
            onChange={(event) =>
              onChange({ kind: "range", min, max: event.target.value })
            }
          />
        </MenuField>
      </MenuRow>
    </>
  );
}

function SetFilterFields({
  column,
  rows,
  filter,
  onChange,
}: FieldsProps<SetFilter> & {
  column: AdvancedTableColumn;
  rows: AdvancedTableRow[];
}) {
  const { t } = useTranslation();
  const [search, setSearch] = React.useState("");
  const values = React.useMemo(
    () => distinctValues(rows, column),
    [rows, column]
  );
  const selected = React.useMemo(
    () => new Set(filter ? filter.values : values),
    [filter, values]
  );
  const visible = values
    .filter((value) => value.toLowerCase().includes(search.toLowerCase()))
    .slice(0, MaxSetValues);
  const allSelected = selected.size === values.length;

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onChange(
      next.size === values.length
        ? undefined
        : { kind: "set", values: Array.from(next) }
    );
  };

  return (
    <>
      <MenuField>
        <input
          aria-label={t("Search values")}
          placeholder={`${t("Search")}…`}
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
        />
      </MenuField>
      <CheckRow>
        <Checkbox
          type="checkbox"
          checked={allSelected}
          onChange={() =>
            onChange(allSelected ? { kind: "set", values: [] } : undefined)
          }
        />
        {t("Select all")}
      </CheckRow>
      {visible.map((value) => (
        <CheckRow key={value || "__blank"}>
          <Checkbox
            type="checkbox"
            checked={selected.has(value)}
            onChange={() => toggle(value)}
          />
          {value === "" ? <em>{t("Empty")}</em> : value}
        </CheckRow>
      ))}
    </>
  );
}
