import type {
  ProfileCaptureResponse,
  WatchDragonLookupResult,
  WatchDragonSummary,
} from '@/types/watchdragon';
import type { FetLifeProfileSnapshot } from '@/types/fetlife-profile';

const MOCK_ACCOUNTS: Record<string, WatchDragonSummary> = {
  '123456': {
    platformUserId: '123456',
    fetlifeUserId: '123456',
    entityId: '01K00000000000000000000001',
    status: 'flagged',
    disposition: 'flagged',
    confidence: 0.87,
    displayName: 'Example Flagged',
    aliases: ['OldExample'],
    aliasCount: 1,
    flagCount: 3,
    relationshipCount: 5,
    linkedAccountCount: 2,
    lastReviewedAt: '2026-09-07T12:00:00Z',
  },
  '234567': {
    platformUserId: '234567',
    fetlifeUserId: '234567',
    entityId: '01K00000000000000000000002',
    status: 'watch',
    disposition: 'watch',
    confidence: 0.64,
    displayName: 'Example Watch',
    aliases: [],
    aliasCount: 0,
    flagCount: 1,
    relationshipCount: 2,
    linkedAccountCount: 1,
    lastReviewedAt: '2026-09-06T09:30:00Z',
  },
  '345678': {
    platformUserId: '345678',
    fetlifeUserId: '345678',
    entityId: '01K00000000000000000000003',
    status: 'linked',
    disposition: 'none',
    confidence: 0.98,
    displayName: 'Example Linked',
    aliases: ['Example Alias', 'Second Alias'],
    aliasCount: 2,
    flagCount: 0,
    relationshipCount: 8,
    linkedAccountCount: 3,
    lastReviewedAt: '2026-09-01T16:45:00Z',
  },
};

export function mockLookup(ids: string[]): WatchDragonLookupResult {
  return {
    accounts: Object.fromEntries(
      ids.flatMap((id) => {
        const summary = MOCK_ACCOUNTS[id];
        return summary ? [[id, summary]] : [];
      }),
    ),
  };
}

const capturedSnapshots = new Map<string, string>();

export function mockCapture(snapshot: FetLifeProfileSnapshot): ProfileCaptureResponse {
  const id = snapshot.identity.fetlifeUserId ?? 'missing';
  const comparable = JSON.stringify({
    ...snapshot,
    source: { ...snapshot.source, capturedAt: '' },
  });
  const previous = capturedSnapshots.get(id);
  const action =
    previous === undefined ? 'inserted' : previous === comparable ? 'unchanged' : 'updated';
  capturedSnapshots.set(id, comparable);
  return {
    ok: true,
    action,
    entityId: `mock-${id}`,
    accountId: `mock-${id}`,
    fetlifeUserId: id,
    username: snapshot.identity.username,
    warnings: snapshot.warnings,
  };
}
