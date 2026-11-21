import { pt } from "@blocknote/core/locales";

/*
 * Portuguese as the rest of the app writes it: sentence case ("Lista numerada", not "Lista
 * Numerada"), and "Título 1" beside "Título 2" so the levels read as a series.
 */
const titles: Partial<Record<keyof typeof pt.slash_menu, string>> = {
  heading: "Título 1",
  toggle_heading: "Título recolhível 1",
  toggle_heading_2: "Título recolhível 2",
  toggle_heading_3: "Título recolhível 3",
  numbered_list: "Lista numerada",
  bullet_list: "Lista com marcadores",
  toggle_list: "Lista recolhível",
  code_block: "Bloco de código",
};

const slashMenu = Object.fromEntries(
  Object.entries(pt.slash_menu).map(([key, entry]) => [
    key,
    titles[key as keyof typeof titles]
      ? { ...entry, title: titles[key as keyof typeof titles] }
      : entry,
  ]),
) as typeof pt.slash_menu;

export const lazuliBlockNoteDictionary = {
  ...pt,
  slash_menu: slashMenu,
  file_panel: {
    ...pt.file_panel,
    upload: { ...pt.file_panel.upload, title: "Enviar" },
  },
};
