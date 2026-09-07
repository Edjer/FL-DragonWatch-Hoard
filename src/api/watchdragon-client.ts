import { mockLookup } from '@/api/mock-data';
import type {
  ApiHealthResult,
  ExtensionSettings,
  ProfileCaptureResponse,
  ProfileCaptureAction,
  WatchDragonLookupResult,
  WatchDragonDisposition,
  WatchDragonStatus,
  WatchDragonSummary,
} from '@/types/watchdragon';
import type { FetLifeProfileSnapshot } from '@/types/fetlife-profile';
import { mockCapture } from '@/api/mock-data';

const REQUEST_TIMEOUT_MS = 8_000;
const statuses: readonly WatchDragonStatus[] = ['known', 'watch', 'flagged', 'reviewed', 'linked'];
const dispositions: readonly WatchDragonDisposition[] = ['none', 'watch', 'flagged', 'reviewed'];

export async function checkApiHealth(settings: ExtensionSettings): Promise<ApiHealthResult> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let lastStatus: number | null = null;
  try {
    const base = new URL(settings.apiUrl);
    if (!['http:', 'https:'].includes(base.protocol))
      throw new Error('Use an HTTP or HTTPS API URL.');
    const apiBase = `${base.origin}${base.pathname.replace(/\/$/, '')}`;
    const response = await fetch(`${apiBase}/health`, {
      signal: controller.signal,
    });
    lastStatus = response.status;
    if (!response.ok) {
      return {
        connected: false,
        mode: settings.mockMode ? 'mock' : 'api',
        authenticated: null,
        httpStatus: response.status,
        phase: 'health',
        endpoint: settings.apiUrl,
        message: `Server returned HTTP ${response.status}`,
        checkedAt,
      };
    }
    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== 'object' ||
      (payload as Record<string, unknown>).status !== 'ok'
    ) {
      return {
        connected: false,
        mode: settings.mockMode ? 'mock' : 'api',
        authenticated: null,
        httpStatus: response.status,
        phase: 'health',
        endpoint: settings.apiUrl,
        message: 'Server returned an invalid health response',
        checkedAt,
      };
    }
    if (settings.mockMode) {
      return {
        connected: true,
        mode: 'mock',
        authenticated: null,
        httpStatus: response.status,
        phase: 'health',
        endpoint: settings.apiUrl,
        message: 'DragonWatch API reachable; mock data enabled',
        checkedAt,
      };
    }
    if (settings.apiToken.trim() === '') {
      return {
        connected: false,
        mode: 'api',
        authenticated: false,
        httpStatus: response.status,
        phase: 'authentication',
        endpoint: settings.apiUrl,
        message: 'API reachable; token is missing',
        checkedAt,
      };
    }
    const authorization = await fetch(`${apiBase}/api/summary`, {
      headers: {
        Authorization: `Bearer ${settings.apiToken}`,
        'X-API-Token': settings.apiToken,
      },
      signal: controller.signal,
    });
    lastStatus = authorization.status;
    if (!authorization.ok) {
      return {
        connected: false,
        mode: 'api',
        authenticated: false,
        httpStatus: authorization.status,
        phase: 'authentication',
        endpoint: settings.apiUrl,
        message: `API reachable; token rejected (HTTP ${authorization.status})`,
        checkedAt,
      };
    }
    return {
      connected: true,
      mode: 'api',
      authenticated: true,
      httpStatus: authorization.status,
      phase: 'authentication',
      endpoint: settings.apiUrl,
      message: 'DragonWatch API connected and authenticated',
      checkedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Connection timed out'
        : 'Unable to reach API';
    return {
      connected: false,
      mode: settings.mockMode ? 'mock' : 'api',
      authenticated: null,
      httpStatus: lastStatus,
      phase: 'network',
      endpoint: settings.apiUrl,
      message,
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function isSummary(value: unknown, id: string): value is WatchDragonSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.platformUserId === id &&
    candidate.fetlifeUserId === id &&
    typeof candidate.entityId === 'string' &&
    typeof candidate.status === 'string' &&
    statuses.includes(candidate.status as WatchDragonStatus) &&
    typeof candidate.disposition === 'string' &&
    dispositions.includes(candidate.disposition as WatchDragonDisposition) &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence >= 0 &&
    candidate.confidence <= 1 &&
    typeof candidate.displayName === 'string' &&
    Array.isArray(candidate.aliases) &&
    candidate.aliases.every((alias) => typeof alias === 'string') &&
    typeof candidate.aliasCount === 'number' &&
    candidate.aliasCount >= 0 &&
    typeof candidate.flagCount === 'number' &&
    typeof candidate.relationshipCount === 'number' &&
    typeof candidate.linkedAccountCount === 'number' &&
    (candidate.lastReviewedAt === null || typeof candidate.lastReviewedAt === 'string')
  );
}

export function validateLookupResponse(value: unknown, ids: string[]): WatchDragonLookupResult {
  if (!value || typeof value !== 'object')
    throw new Error('WatchDragon returned an invalid response.');
  const accounts = (value as Record<string, unknown>).accounts;
  if (!accounts || typeof accounts !== 'object' || Array.isArray(accounts))
    throw new Error('WatchDragon returned invalid accounts.');
  const valid: Record<string, WatchDragonSummary> = {};
  for (const id of ids) {
    const summary = (accounts as Record<string, unknown>)[id];
    if (summary !== undefined && isSummary(summary, id)) valid[id] = summary;
  }
  return { accounts: valid };
}

export async function lookupAccounts(
  ids: string[],
  settings: ExtensionSettings,
): Promise<WatchDragonLookupResult> {
  if (settings.mockMode) return mockLookup(ids);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${settings.apiUrl.replace(/\/$/, '')}/api/v1/accounts/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiToken}`,
        'X-API-Token': settings.apiToken,
      },
      body: JSON.stringify({ ids }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`WatchDragon lookup failed (${response.status}).`);
    return validateLookupResponse(await response.json(), ids);
  } finally {
    clearTimeout(timer);
  }
}

function validateCaptureResponse(value: unknown, expectedId: string): ProfileCaptureResponse {
  if (!value || typeof value !== 'object')
    throw new Error('WatchDragon returned an invalid capture response.');
  const candidate = value as Record<string, unknown>;
  const actions: readonly ProfileCaptureAction[] = ['inserted', 'updated', 'unchanged'];
  if (
    candidate.ok !== true ||
    !actions.includes(candidate.action as ProfileCaptureAction) ||
    typeof candidate.entityId !== 'string' ||
    typeof candidate.accountId !== 'string' ||
    candidate.fetlifeUserId !== expectedId ||
    typeof candidate.username !== 'string' ||
    !Array.isArray(candidate.warnings) ||
    candidate.warnings.some((warning) => typeof warning !== 'string')
  ) {
    throw new Error('WatchDragon returned an invalid capture response.');
  }
  return candidate as unknown as ProfileCaptureResponse;
}

export async function captureProfile(
  snapshot: FetLifeProfileSnapshot,
  settings: ExtensionSettings,
): Promise<ProfileCaptureResponse> {
  const id = snapshot.identity.fetlifeUserId;
  if (!id) throw new Error('No stable FetLife profile ID was captured.');
  if (settings.mockMode) return mockCapture(snapshot);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${settings.apiUrl.replace(/\/$/, '')}/api/v1/profiles/fetlife/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiToken}`,
          'X-API-Token': settings.apiToken,
        },
        body: JSON.stringify({ profile: snapshot }),
        signal: controller.signal,
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        payload &&
        typeof payload === 'object' &&
        typeof (payload as Record<string, unknown>).error === 'string'
          ? (payload as Record<string, string>).error
          : `WatchDragon capture failed (${response.status}).`;
      throw new Error(message);
    }
    return validateCaptureResponse(payload, id);
  } finally {
    clearTimeout(timer);
  }
}
