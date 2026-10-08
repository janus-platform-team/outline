import type MarkdownIt from "markdown-it";

/** The info string used for fenced blocks that contain advanced table data. */
export const AdvancedTableFenceInfo = "advanced-table";

/**
 * A markdown-it plugin that converts fenced code blocks with the
 * `advanced-table` info string into `advanced_table` tokens.
 *
 * @param md the markdown-it instance.
 */
export default function markdownItAdvancedTable(md: MarkdownIt): void {
  md.core.ruler.after("block", "advanced_table", (state) => {
    for (const token of state.tokens) {
      if (
        token.type === "fence" &&
        token.info.trim() === AdvancedTableFenceInfo
      ) {
        token.type = "advanced_table";
      }
    }
    return false;
  });
}
