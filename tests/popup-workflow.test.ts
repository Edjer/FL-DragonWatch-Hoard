import { describe, expect, it, vi } from 'vitest';
import { captureActiveProfile } from '@/popup/capture-workflow';
import type { FetLifeProfileSnapshot } from '@/types/fetlife-profile';
import type { ProfileCaptureResponse } from '@/types/watchdragon';

const snapshot = (id: string | null = '141464'): FetLifeProfileSnapshot => ({
  source: { url: 'https://fetlife.example/ExampleUser', capturedAt: '2026-09-07T17:00:00Z' },
  identity: {
    fetlifeUserId: id,
    username: 'ExampleUser',
    profileUrl: 'https://fetlife.example/ExampleUser',
  },
  profile: {
    demographicsRaw: null,
    age: null,
    gender: null,
    headlineRole: null,
    verified: false,
    supporter: false,
    location: { city: null, region: null, country: null },
    orientation: [],
    pronouns: [],
    roles: [],
    active: null,
    lookingFor: [],
    joined: { raw: null, year: null, month: null },
  },
  social: { friends: null, followers: null, following: null },
  relationships: [],
  groups: { leading: [], memberOf: [] },
  events: { going: [], interested: [] },
  fetishes: { into: [], curiousAbout: [], softLimits: [], hardLimits: [] },
  about: { text: null },
  sections: {
    header: 'present',
    relationships: 'missing',
    groups: 'missing',
    events: 'missing',
    fetishes: 'missing',
    about: 'missing',
    social: 'missing',
  },
  warnings: [],
});

const response = (action: ProfileCaptureResponse['action']): ProfileCaptureResponse => ({
  ok: true,
  action,
  entityId: 'entity-1',
  accountId: 'account-1',
  fetlifeUserId: '141464',
  username: 'ExampleUser',
  warnings: [],
});

describe('manual popup capture workflow', () => {
  it('does not write when the active tab is not a profile', async () => {
    const capture = vi.fn();
    const result = await captureActiveProfile({
      queryActiveTab: async () => [{ id: 1 }],
      extractProfile: async () => ({ detected: false, snapshot: null, warnings: [] }),
      captureProfile: capture,
    });
    expect(result).toEqual({ state: 'not-profile' });
    expect(capture).not.toHaveBeenCalled();
  });

  it('distinguishes an unavailable content script from a non-profile page', async () => {
    const result = await captureActiveProfile({
      queryActiveTab: async () => [{ id: 1 }],
      extractProfile: async () => {
        throw new Error('Could not establish connection. Receiving end does not exist.');
      },
      captureProfile: vi.fn(),
    });
    expect(result).toEqual({
      state: 'unavailable',
      message: 'Could not establish connection. Receiving end does not exist.',
    });
  });

  it('does not write when the stable ID is missing', async () => {
    const capture = vi.fn();
    const result = await captureActiveProfile({
      queryActiveTab: async () => [{ id: 1 }],
      extractProfile: async () => ({ detected: true, snapshot: snapshot(null), warnings: [] }),
      captureProfile: capture,
    });
    expect(result.state).toBe('failure');
    expect(capture).not.toHaveBeenCalled();
  });

  it.each(['inserted', 'updated', 'unchanged'] as const)(
    'passes through %s responses',
    async (action) => {
      const result = await captureActiveProfile({
        queryActiveTab: async () => [{ id: 1 }],
        extractProfile: async () => ({ detected: true, snapshot: snapshot(), warnings: [] }),
        captureProfile: async () => response(action),
      });
      expect(result).toMatchObject({ state: 'success', response: { action } });
    },
  );

  it('returns API failures with the captured snapshot', async () => {
    const result = await captureActiveProfile({
      queryActiveTab: async () => [{ id: 1 }],
      extractProfile: async () => ({ detected: true, snapshot: snapshot(), warnings: [] }),
      captureProfile: async () => {
        throw new Error('API unavailable');
      },
    });
    expect(result).toMatchObject({
      state: 'failure',
      message: 'API unavailable',
      snapshot: snapshot(),
    });
  });
});
