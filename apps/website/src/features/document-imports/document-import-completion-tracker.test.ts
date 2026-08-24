import type { DocumentImport } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { collectNewlyCompletedImports } from "./document-import-completion-tracker.ts";

const importItem = (id: string, status: DocumentImport["status"]): DocumentImport => ({
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
  resultDocumentId: status === "completed" ? "33333333-3333-4333-8333-333333333333" : null,
  createdAt: "2026-08-20T12:00:00.000Z",
  updatedAt: "2026-08-20T12:00:00.000Z",
  finishedAt: status === "completed" ? "2026-08-20T12:01:00.000Z" : null,
});

describe("document import completion tracker", () => {
  it("ignores historical completions that were never observed as active", () => {
    const tracked = new Set<string>();

    expect(collectNewlyCompletedImports([importItem("historical", "completed")], tracked)).toEqual(
      [],
    );
  });

  it("reports an active import completion exactly once", () => {
    const tracked = new Set<string>();
    const active = importItem("current", "processing");
    const completed = importItem("current", "completed");

    expect(collectNewlyCompletedImports([active], tracked)).toEqual([]);
    expect(collectNewlyCompletedImports([completed], tracked)).toEqual([completed]);
    expect(collectNewlyCompletedImports([completed], tracked)).toEqual([]);
  });
});
