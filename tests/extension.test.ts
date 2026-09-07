// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { checkApiHealth, validateLookupResponse } from '@/api/watchdragon-client';
import { dedupeIds, missingIds } from '@/content/batching';
import { Decorator } from '@/content/decorator';
import { CommunitySiteAdapter, extractProfileId } from '@/content/site-adapter';
import { isCacheEntryFresh } from '@/storage/cache-utils';
import { statusPresentation } from '@/content/status';
import type { CacheEntry, WatchDragonSummary } from '@/types/watchdragon';

const summary: WatchDragonSummary = {
  platformUserId: '123456',
  fetlifeUserId: '123456',
  entityId: '01K00000000000000000000001',
  status: 'flagged',
  disposition: 'flagged',
  confidence: 0.87,
  displayName: 'Example',
  aliases: [],
  aliasCount: 0,
  flagCount: 1,
  relationshipCount: 2,
  linkedAccountCount: 1,
  lastReviewedAt: null,
};

describe('site adapter and batching', () => {
  it('extracts stable profile IDs from relative and absolute URLs', () => {
    expect(extractProfileId('/users/123456', 'https://community.example.invalid/page')).toBe(
      '123456',
    );
    expect(extractProfileId('https://community.example.invalid/users/234567/')).toBe('234567');
    expect(extractProfileId('/people/123456', 'https://community.example.invalid/page')).toBeNull();
    expect(
      extractProfileId('/users/not-a-number', 'https://community.example.invalid/page'),
    ).toBeNull();
  });

  it('uses a story actor ID for matching username-style author links', () => {
    document.body.innerHTML = `
      <article data-story-actor-id="7654321" data-dwell-author-path="/example-author">
        <a href="/example-author">Example Author</a>
        <a href="/mentioned-person">Mentioned Person</a>
      </article>
    `;
    const references = new CommunitySiteAdapter().findUserReferences(document);
    expect(references.map((reference) => reference.platformUserId)).toEqual(['7654321']);
  });

  it('deduplicates IDs and only batches uncached, non-pending IDs', () => {
    expect(dedupeIds(['123456', '123456', 'bad', '234567'])).toEqual(['123456', '234567']);
    expect(
      missingIds(['123456', '234567', '345678'], new Set(['123456']), new Set(['345678'])),
    ).toEqual(['234567']);
  });
});

describe('cache and API validation', () => {
  it('reports server reachability while mock data is enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      }),
    );
    const result = await checkApiHealth({
      apiUrl: 'http://localhost:18080',
      webUrl: 'http://localhost:18080',
      apiToken: '',
      overlaysEnabled: true,
      cardsEnabled: true,
      mockMode: true,
    });
    expect(result).toMatchObject({
      connected: true,
      mode: 'mock',
      authenticated: null,
      httpStatus: 200,
      phase: 'health',
      endpoint: 'http://localhost:18080',
      message: 'DragonWatch API reachable; mock data enabled',
    });
    vi.unstubAllGlobals();
  });

  it('checks the API token when mock mode is disabled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const result = await checkApiHealth({
      apiUrl: 'http://localhost:18080',
      webUrl: 'http://localhost:18080',
      apiToken: 'secret-token',
      overlaysEnabled: true,
      cardsEnabled: true,
      mockMode: false,
    });
    expect(result).toMatchObject({
      connected: true,
      mode: 'api',
      authenticated: true,
      httpStatus: 200,
      phase: 'authentication',
      endpoint: 'http://localhost:18080',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:18080/api/summary',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
          'X-API-Token': 'secret-token',
        }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('recognizes cache expiration', () => {
    const entry: CacheEntry = { summary, expiresAt: 2_000 };
    expect(isCacheEntryFresh(entry, 1_999)).toBe(true);
    expect(isCacheEntryFresh(entry, 2_000)).toBe(false);
  });

  it('keeps only valid lookup records', () => {
    expect(
      validateLookupResponse({ accounts: { '123456': summary, '234567': { status: 'bad' } } }, [
        '123456',
        '234567',
      ]).accounts,
    ).toEqual({ '123456': summary });
    expect(() => validateLookupResponse({ nope: {} }, ['123456'])).toThrow();
  });

  it('centralizes accessible status mapping', () => {
    expect(statusPresentation('flagged')).toEqual({ label: 'flagged', marker: '!' });
  });
});

describe('decoration', () => {
  it('does not add duplicate indicators to one link', () => {
    document.body.innerHTML = '<a href="/users/123456">Example</a>';
    const element = document.querySelector<HTMLAnchorElement>('a');
    if (!element) throw new Error('Test anchor missing');
    const decorator = new Decorator('http://localhost:5174', false);
    const reference = { platformUserId: '123456', href: element.href, element };
    decorator.decorate(reference, summary);
    decorator.decorate(reference, summary);
    expect(document.querySelectorAll('.wd-indicator')).toHaveLength(1);
  });
});
