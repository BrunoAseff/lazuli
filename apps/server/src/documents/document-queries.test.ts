import { describe, expect, it } from "vitest";

import { collectDescendantIds, isValidProjectItemParent } from "./document-queries.ts";

const tree = [
  { id: "folder-a", parentId: null, type: "folder" as const },
  { id: "folder-b", parentId: "folder-a", type: "folder" as const },
  { id: "document-a", parentId: "folder-b", type: "document" as const },
];

describe("isValidProjectItemParent", () => {
  it("allows moving an item to the root or another folder", () => {
    expect(isValidProjectItemParent(tree, "document-a", null)).toBe(true);
    expect(isValidProjectItemParent(tree, "document-a", "folder-a")).toBe(true);
  });

  it("rejects documents as parents and cycles", () => {
    expect(isValidProjectItemParent(tree, "folder-a", "document-a")).toBe(false);
    expect(isValidProjectItemParent(tree, "folder-a", "folder-b")).toBe(false);
    expect(isValidProjectItemParent(tree, "folder-a", "folder-a")).toBe(false);
  });
});

describe("collectDescendantIds", () => {
  it("collects a complete subtree", () => {
    expect(collectDescendantIds(tree, "folder-a")).toEqual(
      new Set(["folder-a", "folder-b", "document-a"]),
    );
  });

  it("rejects an identifier outside the authorized tree", () => {
    expect(collectDescendantIds(tree, "foreign-document")).toBeNull();
  });
});
