import { browser } from '@/platform/browser';
import { isCacheEntryFresh } from '@/storage/cache-utils';
import type { CacheEntry, WatchDragonSummary } from '@/types/watchdragon';

export const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY = 'watchdragon-account-cache';

export class AccountCache {
  async getMany(ids: string[]): Promise<Map<string, WatchDragonSummary>> {
    const stored = await browser.storage.local.get(CACHE_KEY);
    const entries = (stored[CACHE_KEY] ?? {}) as Record<string, CacheEntry>;
    const fresh = new Map<string, WatchDragonSummary>();
    for (const id of ids) {
      if (isCacheEntryFresh(entries[id])) fresh.set(id, entries[id].summary);
    }
    return fresh;
  }

  async setMany(accounts: Record<string, WatchDragonSummary>): Promise<void> {
    const stored = await browser.storage.local.get(CACHE_KEY);
    const entries = (stored[CACHE_KEY] ?? {}) as Record<string, CacheEntry>;
    const expiresAt = Date.now() + CACHE_TTL_MS;
    for (const [id, summary] of Object.entries(accounts)) entries[id] = { summary, expiresAt };
    await browser.storage.local.set({ [CACHE_KEY]: entries });
  }
}
