import { browser } from '@/platform/browser';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '@/types/watchdragon';

const SETTINGS_KEY = 'watchdragon-settings';

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  const settings = stored[SETTINGS_KEY];
  if (!settings || typeof settings !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...settings } as ExtensionSettings;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
