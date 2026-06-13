export async function getListingCached<T>(
  kv: KVNamespace,
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds = 300,
): Promise<T> {
  try {
    const cached = await kv.get<T>(key, 'json');
    if (cached !== null) return cached;
  } catch {
    // Fall through to fetchFn on any KV read error.
  }

  const data = await fetchFn();

  try {
    await kv.put(key, JSON.stringify(data), { expirationTtl: ttlSeconds });
  } catch {
    // Cache write failure must not break the request.
  }

  return data;
}

export async function invalidateAllListingCaches(kv: KVNamespace): Promise<void> {
  let cursor: string | undefined;
  do {
    const res = await kv.list({ prefix: 'jobs:', cursor });
    await Promise.all(res.keys.map((k) => kv.delete(k.name)));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
}
