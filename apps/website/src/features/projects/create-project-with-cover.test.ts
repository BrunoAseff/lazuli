import { describe, it, expect, vi } from "vitest";
import type { ProjectSummary } from "@lazuli/shared";
import { createProjectWithCover } from "./create-project-with-cover.ts";
import type { CoverSelection } from "./components/project-cover-editor.tsx";

const project: ProjectSummary = {
  id: "586b1c0d-9542-4546-9e2f-c7cb96bf2d8a",
  title: "Projeto",
  coverKey: null,
  documentCount: 0,
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
};
const selection: CoverSelection = {
  mode: "upload",
  preset: "library",
  presetChanged: false,
  uploadId: crypto.randomUUID(),
  crop: { x: 50, y: 50, zoom: 1 },
};
describe("project creation with a cover", () => {
  it("uploads the selected image to the project just created", async () => {
    const operations = {
      create: vi.fn().mockResolvedValue(project),
      upload: vi.fn().mockResolvedValue({ ...project, coverAssetId: crypto.randomUUID() }),
      update: vi.fn(),
    };
    const onCreated = vi.fn();
    const result = await createProjectWithCover({
      input: { id: project.id, title: project.title, coverKey: "library" },
      selection,
      existing: null,
      onCreated,
      operations,
    });
    expect(operations.create).toHaveBeenCalledWith({
      id: project.id,
      title: project.title,
      coverKey: null,
    });
    expect(operations.upload).toHaveBeenCalledWith(project, selection);
    expect(onCreated).toHaveBeenCalledWith(project);
    expect(result.coverAssetId).toBeTruthy();
  });
  it("retries a failed cover without creating a second project or changing the upload identity", async () => {
    const operations = {
      create: vi.fn().mockResolvedValue(project),
      upload: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(project),
      update: vi.fn(),
    };
    let existing: ProjectSummary | null = null;
    const run = () =>
      createProjectWithCover({
        input: { id: project.id, title: project.title, coverKey: "library" },
        selection,
        existing,
        onCreated: (value) => {
          existing = value;
        },
        operations,
      });
    await expect(run()).rejects.toThrow("offline");
    expect(existing).toEqual(project);
    await run();
    expect(operations.create).toHaveBeenCalledTimes(1);
    expect(operations.upload).toHaveBeenNthCalledWith(2, project, selection);
  });
  it("does not run an image upload for a gallery choice", async () => {
    const operations = {
      create: vi.fn().mockResolvedValue({ ...project, coverKey: "library" }),
      upload: vi.fn(),
      update: vi.fn(),
    };
    await createProjectWithCover({
      input: { id: project.id, title: project.title, coverKey: "library" },
      selection: { ...selection, mode: "gallery" },
      existing: null,
      onCreated: vi.fn(),
      operations,
    });
    expect(operations.upload).not.toHaveBeenCalled();
    expect(operations.update).not.toHaveBeenCalled();
  });
});
