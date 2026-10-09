import type { TFunction } from "i18next";
import { TableIcon } from "outline-icons";
import type { MenuItem } from "@shared/editor/types";

/**
 * Block menu items that are specific to this deployment. Kept separate from
 * the upstream list in block.tsx to reduce merge conflicts.
 *
 * @param _t the translation function.
 * @returns the additional block menu items.
 */
export function customBlockItems(_t: TFunction): MenuItem[] {
  return [
    {
      name: "separator",
    },
    {
      name: "advanced_table",
      title: "Advanced Table",
      icon: <TableIcon />,
      keywords: "grid spreadsheet data datagrid ag sort filter csv",
    },
  ];
}
