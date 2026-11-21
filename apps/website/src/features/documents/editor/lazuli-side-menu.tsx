import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
} from "@blocknote/react";

import { RiTable2 as TableIcon } from "@/components/editor-icons.tsx";
import { PaletteIcon, Trash2Icon } from "@/components/icons.tsx";

/*
 * The block handle's menu written like the app's menus: each row with its icon, the object named
 * ("Excluir bloco"), colors before the destructive row, which reads in red last.
 */
const BlockHandleMenu = () => (
  <DragHandleMenu>
    <BlockColorsItem>
      <PaletteIcon aria-hidden="true" /> Cores
    </BlockColorsItem>
    <TableRowHeaderItem>
      <TableIcon aria-hidden="true" /> Cabeçalho na primeira linha
    </TableRowHeaderItem>
    <TableColumnHeaderItem>
      <TableIcon aria-hidden="true" /> Cabeçalho na primeira coluna
    </TableColumnHeaderItem>
    <RemoveBlockItem>
      <span className="lazuli-menu-destructive">
        <Trash2Icon aria-hidden="true" /> Excluir bloco
      </span>
    </RemoveBlockItem>
  </DragHandleMenu>
);

export const LazuliSideMenuController = () => (
  <SideMenuController
    sideMenu={(props) => <SideMenu {...props} dragHandleMenu={BlockHandleMenu} />}
  />
);
