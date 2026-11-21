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
    upload: {
      title: "Enviar",
      file_placeholder: {
        image: "Escolher imagem",
        video: "Escolher vídeo",
        audio: "Escolher áudio",
        file: "Escolher arquivo",
      },
      upload_error: "Não foi possível enviar o arquivo. Tente novamente.",
    },
    embed: {
      ...pt.file_panel.embed,
      url_placeholder: "Cole o endereço (https://…)",
    },
  },
  link_toolbar: {
    ...pt.link_toolbar,
    form: { title_placeholder: "O texto que aparece", url_placeholder: "https://…" },
  },
  formatting_toolbar: {
    ...pt.formatting_toolbar,
    file_caption: { tooltip: "Editar legenda", input_placeholder: "Aparece abaixo da imagem" },
    file_rename: {
      ...pt.formatting_toolbar.file_rename,
      input_placeholder: {
        image: "Usado ao baixar a imagem",
        video: "Usado ao baixar o vídeo",
        audio: "Usado ao baixar o áudio",
        file: "Usado ao baixar o arquivo",
      },
    },
  },
};
