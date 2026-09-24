type SearchParamValue = boolean | number | string | null | undefined;

type MergeSearchParamsOptions = {
  defaults?: Record<string, string>;
  resetPage?: boolean;
};

export const buildSearchParams = (values: Record<string, SearchParamValue>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
};

export const mergeSearchParams = (
  current: URLSearchParams,
  changes: Record<string, string | undefined>,
  { defaults = {}, resetPage = true }: MergeSearchParamsOptions = {},
) => {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || defaults[key] === value) next.delete(key);
    else next.set(key, value);
  }
  if (resetPage) next.delete("page");
  return next;
};
