type SearchParamValue = boolean | number | string | null | undefined;

export const buildSearchParams = (values: Record<string, SearchParamValue>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params;
};
