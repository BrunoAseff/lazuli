/*
 * Several documents go to the model as one list of blocks. Their ids are prefixed with the
 * document's position ("2::blockId"), so a reference names its document; a single document keeps
 * its plain ids. Each block also carries its document's title, so the model knows which is which.
 */
export const SOURCE_SEPARATOR = "::";
export const splitSourceBlockId = (id: string) => {
  const at = id.indexOf(SOURCE_SEPARATOR);
  if (at === -1) return { sourceIndex: 0, blockId: id };
  return {
    sourceIndex: Number(id.slice(0, at)) - 1,
    blockId: id.slice(at + SOURCE_SEPARATOR.length),
  };
};
