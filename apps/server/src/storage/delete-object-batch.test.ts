import { describe, expect, it, vi } from "vitest";

import type { ObjectStorage } from "./object-storage.ts";
import { deleteObjectBatch, ObjectStorageCleanupError } from "./delete-object-batch.ts";

describe("deleteObjectBatch", () => {
  it("deletes every requested object", async () => {
    const deleteObject = vi.fn().mockResolvedValue(undefined);
    const storage = { delete: deleteObject } as unknown as ObjectStorage;
    await deleteObjectBatch(storage, ["first", "second"]);
    expect(deleteObject).toHaveBeenCalledTimes(2);
  });

  it("reports failures without exposing object keys", async () => {
    const storage = {
      delete: vi.fn((key: string) =>
        key === "private-key" ? Promise.reject(new Error("unavailable")) : Promise.resolve(),
      ),
    } as unknown as ObjectStorage;
    const error = await deleteObjectBatch(storage, ["private-key", "other"]).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ObjectStorageCleanupError);
    expect((error as Error).message).not.toContain("private-key");
  });
});
