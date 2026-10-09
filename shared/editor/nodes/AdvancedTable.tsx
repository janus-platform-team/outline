import type Token from "markdown-it/lib/token.mjs";
import type {
  DOMOutputSpec,
  NodeSpec,
  NodeType,
  Node as ProsemirrorNode,
} from "prosemirror-model";
import type { Command } from "prosemirror-state";
import { NodeSelection, Plugin } from "prosemirror-state";
import { AdvancedTableGrid, GridAttribute } from "../components/AdvancedTable";
import {
  createEmptyTable,
  formatValue,
  normalizeTableData,
  parseTableData,
  tableToPlainText,
} from "../lib/advancedTable";
import type { AdvancedTableData } from "../lib/advancedTable";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import { escapeRawTableCell } from "../lib/markdown/tableCell";
import markdownItAdvancedTable, {
  AdvancedTableFenceInfo,
} from "../rules/advancedTable";
import type { ComponentProps } from "../types";
import Node from "./Node";

/**
 * Returns valid table data for a node, repairing it if the stored attribute is
 * malformed.
 *
 * @param node the advanced table node.
 * @returns the table data.
 */
export function getAdvancedTableData(node: ProsemirrorNode): AdvancedTableData {
  const data: unknown = node.attrs.data;
  if (
    typeof data === "object" &&
    data !== null &&
    "columns" in data &&
    "rows" in data &&
    Array.isArray(data.columns) &&
    Array.isArray(data.rows)
  ) {
    // Data written by the editor is already normalized, avoid the cost of
    // re-validating large tables on every render.
    return data as AdvancedTableData;
  }
  return normalizeTableData(data);
}

export default class AdvancedTable extends Node {
  get name() {
    return "advanced_table";
  }

  get rulePlugins() {
    return [markdownItAdvancedTable];
  }

  get plugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            // The grid manages its own focus and selection; letting the editor
            // handle mousedown would move focus back into the document.
            mousedown: (_view, event) =>
              event.target instanceof Element &&
              !!event.target.closest(`[${GridAttribute}]`),
          },
        },
      }),
    ];
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        data: {
          default: createEmptyTable(),
        },
      },
      group: "block",
      atom: true,
      selectable: true,
      draggable: false,
      defining: true,
      parseDOM: [
        {
          tag: "div[data-advanced-table]",
          priority: 60,
          getAttrs: (dom: HTMLElement) => ({
            data: parseTableData(dom.getAttribute("data-json")),
          }),
        },
      ],
      toDOM: (node) => {
        const data = getAdvancedTableData(node);
        const columns = data.columns.filter((c) => !c.hidden);
        const header: DOMOutputSpec = [
          "thead",
          ["tr", ...columns.map((c): DOMOutputSpec => ["th", c.name])],
        ];
        const body: DOMOutputSpec = [
          "tbody",
          ...data.rows.map(
            (row): DOMOutputSpec => [
              "tr",
              ...columns.map(
                (c): DOMOutputSpec => [
                  "td",
                  formatValue(row.cells[c.id] ?? null, c),
                ]
              ),
            ]
          ),
        ];

        return [
          "div",
          {
            class: "advanced-table",
            "data-advanced-table": "",
            "data-json": JSON.stringify(data),
            contentEditable: "false",
          },
          ["table", header, body],
        ];
      },
      leafText: (node) => tableToPlainText(getAdvancedTableData(node)),
    };
  }

  handleChange =
    ({ getPos }: { getPos: () => number }) =>
    (data: AdvancedTableData) => {
      const { view } = this.editor;
      const pos = getPos();
      const node = view.state.doc.nodeAt(pos);
      if (!node || node.type.name !== this.name) {
        return;
      }

      view.dispatch(
        view.state.tr
          .setNodeMarkup(pos, undefined, { ...node.attrs, data })
          .setMeta("addToHistory", true)
      );
    };

  handleExit =
    ({ getPos }: { getPos: () => number }) =>
    () => {
      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos());
      view.dispatch(view.state.tr.setSelection(new NodeSelection($pos)));
      view.focus();
    };

  handleUndo = () => {
    this.editor.commands.undo?.();
  };

  handleRedo = () => {
    this.editor.commands.redo?.();
  };

  component = (props: ComponentProps) => (
    <AdvancedTableGrid
      data={getAdvancedTableData(props.node)}
      isEditable={props.isEditable}
      isSelected={props.isSelected}
      onChange={this.handleChange(props)}
      onExit={this.handleExit(props)}
      onUndo={this.handleUndo}
      onRedo={this.handleRedo}
    />
  );

  commands({ type }: { type: NodeType }) {
    const insert = (): Command => (state, dispatch) => {
      dispatch?.(
        state.tr
          .replaceSelectionWith(type.create({ data: createEmptyTable() }))
          .scrollIntoView()
      );
      return true;
    };

    return {
      advanced_table: insert,
      createAdvancedTable: insert,
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    const json = JSON.stringify(getAdvancedTableData(node));
    const content = state.inTable ? escapeRawTableCell(json) : json;
    const longestBackticks = Math.max(
      0,
      ...(content.match(/`+/g) ?? []).map((run) => run.length)
    );
    const fence = "`".repeat(Math.max(3, longestBackticks + 1));

    state.write(fence + AdvancedTableFenceInfo + "\n");
    state.text(content, false);
    state.ensureNewLine();
    state.write(fence);
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      node: "advanced_table",
      noCloseToken: true,
      getAttrs: (token: Token) => ({
        data: parseTableData(token.content),
      }),
    };
  }
}
