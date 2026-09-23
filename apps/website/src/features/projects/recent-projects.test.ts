import { describe, expect, it } from "vitest";

import {
  readRecentProjects,
  rememberRecentProject,
  type RecentProject,
  writeRecentProjects,
} from "./recent-projects";

const createStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
};

describe("recent projects", () => {
  it("updates a reopened project without moving it while the list is visible", () => {
    const result = rememberRecentProject(
      [
        { id: "one", title: "One", lastOpenedAt: "2026-09-22T10:00:00.000Z" },
        { id: "two", title: "Two", lastOpenedAt: "2026-09-22T09:00:00.000Z" },
      ],
      { id: "two", title: "Two renamed" },
      "2026-09-23T10:00:00.000Z",
    );

    expect(result).toEqual([
      { id: "one", title: "One", lastOpenedAt: "2026-09-22T10:00:00.000Z" },
      { id: "two", title: "Two renamed", lastOpenedAt: "2026-09-23T10:00:00.000Z" },
    ]);
  });

  it("keeps only the four most recent projects", () => {
    const result = ["one", "two", "three", "four", "five"].reduce<RecentProject[]>(
      (projects, id, index) =>
        rememberRecentProject(projects, { id, title: id }, `2026-09-23T10:00:0${index}.000Z`),
      [],
    );

    expect(result.map(({ id }) => id)).toEqual(["five", "four", "three", "two"]);
  });

  it("ignores invalid persisted values", () => {
    const storage = createStorage();
    storage.setItem(
      "lazuli-recent-projects:user",
      JSON.stringify([{ id: "valid", title: "Valid", lastOpenedAt: "today" }, { id: 1 }]),
    );

    expect(readRecentProjects(storage, "user")).toHaveLength(1);
    writeRecentProjects(storage, "user", []);
    expect(readRecentProjects(storage, "user")).toEqual([]);
  });
});
