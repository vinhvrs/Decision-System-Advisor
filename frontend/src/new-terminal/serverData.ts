const DATA_BASE = "https://data.aitemple.tech";

export async function readData<T>(path: string, revalidate = 60): Promise<T | undefined> {
  try {
    const response = await fetch(`${DATA_BASE}${path}`, {
      next: { revalidate },
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return undefined;
    return await response.json() as T;
  } catch {
    return undefined;
  }
}
