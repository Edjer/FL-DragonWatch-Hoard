import type { FetLifeProfileSnapshot, ProfileExtractionResult } from '@/types/fetlife-profile';
import type { ProfileCaptureResponse } from '@/types/watchdragon';

export interface CaptureBridge {
  queryActiveTab: () => Promise<Array<{ id?: number }>>;
  extractProfile: (tabId: number) => Promise<ProfileExtractionResult>;
  captureProfile: (snapshot: FetLifeProfileSnapshot) => Promise<ProfileCaptureResponse>;
  onSaving?: () => void;
}

export type CaptureWorkflowResult =
  | { state: 'not-profile' }
  | { state: 'unavailable'; message: string }
  | { state: 'failure'; message: string; snapshot?: FetLifeProfileSnapshot }
  | { state: 'success'; snapshot: FetLifeProfileSnapshot; response: ProfileCaptureResponse };

export async function captureActiveProfile(bridge: CaptureBridge): Promise<CaptureWorkflowResult> {
  const tabs = await bridge.queryActiveTab();
  const tabId = tabs[0]?.id;
  if (!tabId) return { state: 'not-profile' };

  let extraction: ProfileExtractionResult;
  try {
    extraction = await bridge.extractProfile(tabId);
  } catch (error) {
    return {
      state: 'unavailable',
      message:
        error instanceof Error
          ? error.message
          : 'The page content script is unavailable. Reload the page and try again.',
    };
  }
  if (!extraction.detected || !extraction.snapshot) return { state: 'not-profile' };

  const snapshot = extraction.snapshot;
  if (!snapshot.identity.fetlifeUserId) {
    return {
      state: 'failure',
      message: snapshot.warnings.join(' ') || 'No stable FetLife user ID could be determined.',
      snapshot,
    };
  }
  if (!snapshot.identity.username) {
    return { state: 'failure', message: 'The profile username was not visible.', snapshot };
  }
  try {
    bridge.onSaving?.();
    return { state: 'success', snapshot, response: await bridge.captureProfile(snapshot) };
  } catch (error) {
    return {
      state: 'failure',
      message: error instanceof Error ? error.message : 'The profile could not be saved.',
      snapshot,
    };
  }
}
