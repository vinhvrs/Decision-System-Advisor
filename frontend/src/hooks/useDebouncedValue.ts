"use client";

import { useEffect, useState } from "react";

/**
 * Delays updating the returned value until `ms` after the last change to `value`.
 * Use for search inputs so API calls don't fire on every keystroke.
 */
export function useDebouncedValue<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);

  return debounced;
}
