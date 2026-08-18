import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  projectListQuerySchema,
  projectTitleSchema,
  updateProjectSchema,
} from "./project-contracts.ts";

describe("project contracts", () => {
  it("normalizes a valid title", () => {
    expect(projectTitleSchema.parse("  Física   moderna  ")).toBe("Física moderna");
  });

  it("rejects invalid titles and cover keys", () => {
    expect(projectTitleSchema.safeParse("   ").success).toBe(false);
    expect(projectTitleSchema.safeParse("A".repeat(101)).success).toBe(false);
    expect(
      createProjectSchema.safeParse({
        id: "2a36ca27-f1e7-4b07-bd5a-bf831fee8f62",
        title: "Geometria",
        coverKey: "remote-url",
      }).success,
    ).toBe(false);
  });

  it("requires an actual project update", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ coverKey: null }).success).toBe(true);
  });

  it("coerces pagination and keeps it within the public limit", () => {
    expect(projectListQuerySchema.parse({ page: "2" })).toMatchObject({
      page: 2,
      pageSize: 12,
      query: "",
    });
    expect(projectListQuerySchema.safeParse({ pageSize: 25 }).success).toBe(false);
  });
});
