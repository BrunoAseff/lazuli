import { describe, expect, it } from "vitest";

import { splitImportFileName } from "./document-import-dialog.tsx";

describe("DocumentImportDialog", () => {
  it("separates the editable title without allowing the format extension to be lost", () => {
    expect(splitImportFileName("Aula de cálculo.pdf")).toEqual({
      title: "Aula de cálculo",
      extension: ".pdf",
    });
    expect(splitImportFileName("anotações.markdown")).toEqual({
      title: "anotações",
      extension: ".markdown",
    });
  });
});
