import type { FetLifeProfileSnapshot } from '@/types/fetlife-profile';

export const WATCHDRAGON_STATUSES = ['known', 'watch', 'flagged', 'reviewed', 'linked'] as const;
export type WatchDragonStatus = (typeof WATCHDRAGON_STATUSES)[number];
export const WATCHDRAGON_DISPOSITIONS = ['none', 'watch', 'flagged', 'reviewed'] as const;
export type WatchDragonDisposition = (typeof WATCHDRAGON_DISPOSITIONS)[number];

export interface WatchDragonSummary {
  platformUserId: string;
  fetlifeUserId: string;
  entityId: string;
  status: WatchDragonStatus;
  disposition: WatchDragonDisposition;
  confidence: number;
  displayName: string;
  aliases: string[];
  aliasCount: number;
  flagCount: number;
  relationshipCount: number;
  linkedAccountCount: number;
  lastReviewedAt: string | null;
}

export interface WatchDragonLookupResult {
  accounts: Record<string, WatchDragonSummary>;
}

export interface ApiHealthResult {
  connected: boolean;
  mode: 'api' | 'mock';
  authenticated: boolean | null;
  httpStatus: number | null;
  phase: 'health' | 'authentication' | 'network' | 'mock';
  endpoint: string;
  message: string;
  checkedAt: string;
}

export interface ExtensionSettings {
  apiUrl: string;
  webUrl: string;
  apiToken: string;
  overlaysEnabled: boolean;
  cardsEnabled: boolean;
  mockMode: boolean;
}

export type ProfileCaptureAction = 'inserted' | 'updated' | 'unchanged';

export interface ProfileCaptureResponse {
  ok: true;
  action: ProfileCaptureAction;
  entityId: string;
  accountId: string;
  fetlifeUserId: string;
  username: string;
  warnings: string[];
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiUrl: 'http://localhost:18080',
  webUrl: 'http://localhost:18080',
  apiToken: '',
  overlaysEnabled: true,
  cardsEnabled: true,
  mockMode: false,
};

export interface CacheEntry {
  summary: WatchDragonSummary;
  expiresAt: number;
}

export type RuntimeMessage =
  | { type: 'get-settings' }
  | { type: 'check-api' }
  | { type: 'lookup-accounts'; ids: string[] }
  | { type: 'extract-profile' }
  | { type: 'capture-profile'; snapshot: FetLifeProfileSnapshot }
  | { type: 'open-web-url'; entityId: string };
