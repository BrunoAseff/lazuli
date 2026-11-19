import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FileDropzone } from "./file-dropzone.tsx";

vi.mock("@/hooks/use-mobile.ts", () => ({ useIsMobile: () => false }));
vi.mock("@/components/icons.tsx", () => ({
  PlusIcon: () => <svg data-symbol="add" />,
  ReplaceIcon: () => <svg data-symbol="replace" />,
  UploadCloudIcon: () => <svg />,
}));

describe("FileDropzone action icon", () => {
  it("uses a replacement icon when changing an existing image", () => {
    const markup = renderToStaticMarkup(
      <FileDropzone accept="image/*" replacing buttonLabel="Trocar imagem" onFiles={() => {}} />,
    );
    expect(markup).toContain('data-symbol="replace"');
    expect(markup).not.toContain('data-symbol="add"');
    expect(markup).toContain("Trocar imagem");
  });

  it("keeps the add icon when choosing new files", () => {
    const markup = renderToStaticMarkup(<FileDropzone accept="image/*" onFiles={() => {}} />);
    expect(markup).toContain('data-symbol="add"');
    expect(markup).not.toContain('data-symbol="replace"');
  });
});
