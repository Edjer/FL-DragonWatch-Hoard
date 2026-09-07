import { captureProfile, checkApiHealth, lookupAccounts } from '@/api/watchdragon-client';
import { browser } from '@/platform/browser';
import { getSettings } from '@/storage/settings';
import type { RuntimeMessage } from '@/types/watchdragon';

browser.runtime.onMessage.addListener(async (message: unknown) => {
  if (!message || typeof message !== 'object' || !('type' in message)) return undefined;
  const typedMessage = message as RuntimeMessage;
  if (typedMessage.type === 'get-settings') return getSettings();
  if (typedMessage.type === 'check-api') return checkApiHealth(await getSettings());
  if (typedMessage.type === 'lookup-accounts')
    return lookupAccounts(typedMessage.ids, await getSettings());
  if (typedMessage.type === 'capture-profile')
    return captureProfile(typedMessage.snapshot, await getSettings());
  if (typedMessage.type === 'open-web-url') {
    const settings = await getSettings();
    const base = new URL(settings.webUrl);
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Invalid DragonWatch URL.');
    await browser.tabs.create({
      url: `${base.origin}${base.pathname.replace(/\/$/, '')}/entities/${encodeURIComponent(typedMessage.entityId)}`,
    });
    return { opened: true };
  }
  return undefined;
});
