import injectedStyles from '@/styles/injected.css?inline';
import { dedupeIds, missingIds } from '@/content/batching';
import { Decorator } from '@/content/decorator';
import { IncrementalScanner } from '@/content/scanner';
import { CommunitySiteAdapter, type UserReference } from '@/content/site-adapter';
import { extractFetLifeProfile } from '@/content/fetlife-profile-extractor';
import { browser } from '@/platform/browser';
import { AccountCache } from '@/storage/cache';
import type {
  ExtensionSettings,
  RuntimeMessage,
  WatchDragonLookupResult,
  WatchDragonSummary,
} from '@/types/watchdragon';

browser.runtime.onMessage.addListener((message: unknown) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return undefined;
  if ((message as { type?: string }).type !== 'extract-profile') return undefined;
  return Promise.resolve(extractFetLifeProfile(document));
});

async function getSettings(): Promise<ExtensionSettings> {
  return (await browser.runtime.sendMessage({
    type: 'get-settings',
  } satisfies RuntimeMessage)) as ExtensionSettings;
}

function installStyles(): void {
  if (document.getElementById('wd-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'wd-injected-styles';
  style.textContent = injectedStyles;
  document.head.append(style);
}

async function start(): Promise<void> {
  const settings = await getSettings();
  if (!settings.overlaysEnabled || !document.body) return;
  installStyles();

  const cache = new AccountCache();
  const decorator = new Decorator(settings.webUrl, settings.cardsEnabled);
  const referencesById = new Map<string, Set<UserReference>>();
  const pending = new Set<string>();

  const decorate = (accounts: Record<string, WatchDragonSummary>): void => {
    for (const [id, summary] of Object.entries(accounts)) {
      for (const reference of referencesById.get(id) ?? []) decorator.decorate(reference, summary);
    }
  };

  const handleReferences = async (references: UserReference[]): Promise<void> => {
    for (const reference of references) {
      const existing = referencesById.get(reference.platformUserId) ?? new Set<UserReference>();
      existing.add(reference);
      referencesById.set(reference.platformUserId, existing);
    }

    const ids = dedupeIds(references.map((reference) => reference.platformUserId));
    const cached = await cache.getMany(ids);
    decorate(Object.fromEntries(cached));
    const idsToLookup = missingIds(ids, new Set(cached.keys()), pending);
    if (idsToLookup.length === 0) return;
    idsToLookup.forEach((id) => pending.add(id));
    try {
      const result = (await browser.runtime.sendMessage({
        type: 'lookup-accounts',
        ids: idsToLookup,
      } satisfies RuntimeMessage)) as WatchDragonLookupResult;
      await cache.setMany(result.accounts);
      decorate(result.accounts);
    } catch {
      // A failed lookup should not interfere with the site being viewed.
    } finally {
      idsToLookup.forEach((id) => pending.delete(id));
    }
  };

  new IncrementalScanner(
    new CommunitySiteAdapter(),
    (references) => void handleReferences(references),
  ).start();
}

void start().catch(() => {
  // Extension/API failures are intentionally silent in the page context.
});
