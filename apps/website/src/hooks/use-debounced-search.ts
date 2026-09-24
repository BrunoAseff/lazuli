import { useEffect, useRef, useState } from "react";

export const useDebouncedSearch = (
  value: string,
  onChange: (value: string) => void,
  delay = 300,
) => {
  const [search, setSearch] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => setSearch(value), [value]);
  useEffect(() => {
    const normalized = search.trim();
    if (normalized === value) return;
    const timer = window.setTimeout(() => onChangeRef.current(normalized), delay);
    return () => window.clearTimeout(timer);
  }, [delay, search, value]);

  return [search, setSearch] as const;
};
