const here = "https://lazuli.invalid";

/** A path inside the app, or nothing: "//host" and "/\host" are other sites to the browser. */
export const safeReturnTo = (value: string | null | undefined) => {
  if (!value?.startsWith("/")) return null;
  try {
    return new URL(value, here).origin === here ? value : null;
  } catch {
    return null;
  }
};

export const documentLocation = ({
  anchorId,
  blockId,
  documentId,
  params: additionalParams,
  projectId,
  returnTo,
}: {
  anchorId?: string | null;
  blockId?: string | null;
  documentId: string;
  params?: Record<string, string>;
  projectId: string;
  returnTo?: string | null;
}) => {
  const params = new URLSearchParams();
  if (anchorId) params.set("anchor", anchorId);
  if (blockId) params.set("block", blockId);
  if (safeReturnTo(returnTo)) params.set("returnTo", returnTo!);
  for (const [key, value] of Object.entries(additionalParams ?? {})) params.set(key, value);
  const query = params.toString();
  return `/documents/${projectId}/document/${documentId}${query ? `?${query}` : ""}`;
};
