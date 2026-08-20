import type { LazuliDocumentBlock } from "./document-schema.tsx";

const IMPORT_CONCURRENCY = 3;
const isExternalImageUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);
type ImageBlock = LazuliDocumentBlock[number] & { props: { url: string } };

export class ExternalImageImportError extends Error {
  readonly blockId: string;
  readonly sourceUrl: string;
  readonly cleanupFailedAssetUrls: string[] = [];

  constructor(blockId: string, sourceUrl: string, cause: unknown) {
    super("Não foi possível importar a imagem externa.", { cause });
    this.blockId = blockId;
    this.sourceUrl = sourceUrl;
  }
}

const visitImages = (blocks: LazuliDocumentBlock, visit: (block: ImageBlock) => void) => {
  for (const block of blocks) {
    if (block.type === "image") visit(block as ImageBlock);
    if (block.children.length) visitImages(block.children, visit);
  }
};

export const importExternalImages = async ({
  content,
  importImage,
  removeImage,
}: {
  content: LazuliDocumentBlock;
  importImage: (url: string) => Promise<string>;
  removeImage: (url: string) => Promise<void>;
}) => {
  const localized = JSON.parse(JSON.stringify(content)) as LazuliDocumentBlock;
  const sourceBlocks = new Map<string, string[]>();
  visitImages(localized, (block) => {
    if (!isExternalImageUrl(block.props.url)) return;
    const blockIds = sourceBlocks.get(block.props.url) ?? [];
    blockIds.push(block.id);
    sourceBlocks.set(block.props.url, blockIds);
  });
  if (sourceBlocks.size === 0) return { content: localized, importedAssetUrls: [] };

  const pending = [...sourceBlocks.keys()];
  const replacements = new Map<string, string>();
  let cursor = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const source = pending[index]!;
      try {
        replacements.set(source, await importImage(source));
      } catch (error) {
        failed = true;
        throw new ExternalImageImportError(sourceBlocks.get(source)![0]!, source, error);
      }
    }
  };

  const results = await Promise.allSettled(
    Array.from({ length: Math.min(IMPORT_CONCURRENCY, pending.length) }, () => worker()),
  );
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") {
    const importedUrls = [...replacements.values()];
    const cleanup = await Promise.allSettled(importedUrls.map((url) => removeImage(url)));
    if (failure.reason instanceof ExternalImageImportError)
      failure.reason.cleanupFailedAssetUrls.push(
        ...importedUrls.filter((_, index) => cleanup[index]?.status === "rejected"),
      );
    throw failure.reason;
  }

  visitImages(localized, (block) => {
    const replacement = replacements.get(String(block.props.url));
    if (replacement) block.props.url = replacement;
  });
  return { content: localized, importedAssetUrls: [...replacements.values()] };
};
