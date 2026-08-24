import type { DocumentImport } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { getVisibleDocumentImports, isDocumentImportActive } from "./document-import-visibility.ts";

const importItem = (
  id: string,
  status: DocumentImport["status"],
  finishedAt: string | null,
): DocumentImport => ({
  id,
  projectId: "11111111-1111-4111-8111-111111111111",
  parentId: null,
  documentId: "22222222-2222-4222-8222-222222222222",
  originalName: `${id}.pdf`,
  mimeType: "application/pdf",
  byteSize: 100,
  status,
  phase: null,
  progressCurrent: null,
  progressTotal: null,
  errorCode: null,
  warnings: [],
  resultDocumentId: null,
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  finishedAt,
});

describe("document import visibility", () => {
  it("never hides an active import because completed imports were cleared", () => {
    const active = importItem("active", "processing", null);
    const completed = importItem("completed", "completed", "2026-08-20T12:01:00.000Z");

    expect(
      getVisibleDocumentImports([active, completed], Date.parse("2026-08-20T12:02:00Z")),
    ).toEqual([active]);
    expect(isDocumentImportActive(active)).toBe(true);
  });

  it("shows only terminal imports completed after the user cleared the history", () => {
    const older = importItem("older", "completed", "2026-08-20T12:01:00.000Z");
    const newer = importItem("newer", "failed", "2026-08-20T12:03:00.000Z");

    expect(
      getVisibleDocumentImports([newer, older], Date.parse("2026-08-20T12:02:00.000Z")),
    ).toEqual([newer]);
  });

  it("keeps active imports ahead of terminal history when applying the display limit", () => {
    const active = importItem("active", "queued", null);
    const completed = Array.from({ length: 12 }, (_, index) =>
      importItem(`completed-${index}`, "completed", "2026-08-20T12:03:00.000Z"),
    );

    const visible = getVisibleDocumentImports([...completed, active], 0, 10);

    expect(visible).toHaveLength(10);
    expect(visible[0]).toBe(active);
  });
});
