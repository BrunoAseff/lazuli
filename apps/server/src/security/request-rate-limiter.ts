type RateLimitEntry = { count: number; resetAt: number };

export const createRequestRateLimiter = ({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}) => {
  const entries = new Map<string, RateLimitEntry>();
  return {
    consume(key: string, now = Date.now()) {
      if (entries.size > 1_000)
        for (const [entryKey, entry] of entries) if (entry.resetAt <= now) entries.delete(entryKey);
      const current = entries.get(key);
      if (!current || current.resetAt <= now) {
        entries.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (current.count >= limit) return false;
      current.count += 1;
      return true;
    },
  };
};
