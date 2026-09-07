import type { CacheEntry } from '@/types/watchdragon';

export function isCacheEntryFresh(
  entry: CacheEntry | undefined,
  now = Date.now(),
): entry is CacheEntry {
  return Boolean(entry && entry.expiresAt > now);
}
