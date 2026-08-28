export const safeReturnTo = (value: string | null | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : null;

export const documentLocation = ({
  anchorId,
  documentId,
  projectId,
  returnTo,
}: {
  anchorId?: string | null;
  documentId: string;
  projectId: string;
  returnTo?: string | null;
}) => {
  const params = new URLSearchParams();
  if (anchorId) params.set("anchor", anchorId);
  if (safeReturnTo(returnTo)) params.set("returnTo", returnTo!);
  const query = params.toString();
  return `/documents/${projectId}/document/${documentId}${query ? `?${query}` : ""}`;
};
