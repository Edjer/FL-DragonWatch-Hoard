import './popup.css';
import { captureActiveProfile } from '@/popup/capture-workflow';
import { browser } from '@/platform/browser';
import { getSettings, saveSettings } from '@/storage/settings';
import type { FetLifeProfileSnapshot, ProfileExtractionResult } from '@/types/fetlife-profile';
import type {
  ApiHealthResult,
  ExtensionSettings,
  ProfileCaptureResponse,
  RuntimeMessage,
} from '@/types/watchdragon';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const saved = document.querySelector<HTMLParagraphElement>('#saved');
const connectionStatus = document.querySelector<HTMLParagraphElement>('#connection-status');
const connectionDetail = document.querySelector<HTMLParagraphElement>('#connection-detail');
const connectionDot = document.querySelector<HTMLSpanElement>('#connection-dot');
const checkButton = document.querySelector<HTMLButtonElement>('#check-api');
const captureStatus = document.querySelector<HTMLParagraphElement>('#capture-status');
const captureDetail = document.querySelector<HTMLParagraphElement>('#capture-detail');
const captureData = document.querySelector<HTMLDivElement>('#capture-data');
const captureState = document.querySelector<HTMLSpanElement>('#capture-state');
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh-profile');
const openButton = document.querySelector<HTMLButtonElement>('#open-watchdragon');

function input(id: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(id);
  if (!element) throw new Error(`Missing settings field: ${id}`);
  return element;
}

function renderConnection(result: ApiHealthResult): void {
  if (connectionStatus) {
    connectionStatus.textContent = result.connected
      ? result.message
      : `API unavailable: ${result.message}`;
  }
  if (connectionDetail) {
    const status = result.httpStatus === null ? 'No HTTP response' : `HTTP ${result.httpStatus}`;
    const authentication =
      result.authenticated === true
        ? 'Authenticated'
        : result.authenticated === false
          ? 'Not authenticated'
          : 'Authentication not required';
    connectionDetail.textContent = `${result.mode === 'mock' ? 'Mock data source' : 'Live data source'} · ${status} · ${authentication} · ${result.phase} · ${result.endpoint} · Checked ${new Date(result.checkedAt).toLocaleTimeString()}`;
  }
  connectionDot?.classList.toggle('wd-connection-ok', result.connected);
  connectionDot?.classList.toggle('wd-connection-error', !result.connected);
}

async function checkConnection(): Promise<void> {
  if (checkButton) checkButton.disabled = true;
  if (connectionStatus) connectionStatus.textContent = 'Checking connection...';
  try {
    const result = (await browser.runtime.sendMessage({
      type: 'check-api',
    } satisfies RuntimeMessage)) as ApiHealthResult;
    renderConnection(result);
  } catch {
    if (connectionStatus)
      connectionStatus.textContent = 'API unavailable: extension background worker failed';
    connectionDot?.classList.add('wd-connection-error');
  } finally {
    if (checkButton) checkButton.disabled = false;
  }
}

function clear(element: HTMLElement): void {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function row(parent: HTMLElement, label: string, value: string): void {
  if (!value) return;
  const element = document.createElement('p');
  element.className = 'wd-capture-row';
  element.textContent = `${label}: ${value}`;
  parent.append(element);
}

function details(
  parent: HTMLElement,
  title: string,
  content: (section: HTMLElement) => void,
  open = false,
): void {
  const element = document.createElement('details');
  element.open = open;
  const summary = document.createElement('summary');
  summary.textContent = title;
  element.append(summary);
  const section = document.createElement('div');
  content(section);
  element.append(section);
  parent.append(element);
}

function list(parent: HTMLElement, values: string[]): void {
  if (values.length === 0) return;
  const element = document.createElement('ul');
  element.className = 'wd-capture-list';
  for (const value of values) {
    const item = document.createElement('li');
    item.textContent = value;
    element.append(item);
  }
  parent.append(element);
}

function sectionCount(state: string, count: number): string {
  return state === 'present' ? `${count} loaded` : state;
}

function renderSnapshot(snapshot: FetLifeProfileSnapshot): void {
  if (!captureData) return;
  clear(captureData);
  captureData.hidden = false;
  details(
    captureData,
    'Identity',
    (section) => {
      row(section, 'Username', snapshot.identity.username);
      row(section, 'FetLife ID', snapshot.identity.fetlifeUserId ?? 'not determined');
      row(section, 'Joined', snapshot.profile.joined.raw ?? 'not displayed');
      row(section, 'Profile URL', snapshot.identity.profileUrl);
    },
    true,
  );
  details(
    captureData,
    'Profile',
    (section) => {
      row(section, 'Demographics', snapshot.profile.demographicsRaw ?? 'not displayed');
      row(section, 'Pronouns', snapshot.profile.pronouns.join(', '));
      row(section, 'Orientation', snapshot.profile.orientation.join(', '));
      row(section, 'Location', Object.values(snapshot.profile.location).filter(Boolean).join(', '));
      row(section, 'Active', snapshot.profile.active ?? '');
      row(section, 'Verified', snapshot.profile.verified ? 'yes' : 'no');
      row(section, 'Supporter', snapshot.profile.supporter ? 'yes' : 'no');
    },
    true,
  );
  details(captureData, `Roles (${snapshot.profile.roles.length})`, (section) =>
    list(section, snapshot.profile.roles),
  );
  details(captureData, `Interested in (${snapshot.profile.lookingFor.length})`, (section) =>
    list(section, snapshot.profile.lookingFor),
  );
  details(captureData, `Relationships (${snapshot.relationships.length})`, (section) => {
    list(
      section,
      snapshot.relationships.map(
        (item) => `${item.type}${item.username ? ` ${item.username}` : ''}`,
      ),
    );
  });
  details(captureData, 'Groups', (section) => {
    row(section, 'Leading', sectionCount(snapshot.sections.groups, snapshot.groups.leading.length));
    row(
      section,
      'Member of',
      sectionCount(snapshot.sections.groups, snapshot.groups.memberOf.length),
    );
    list(
      section,
      [...snapshot.groups.leading, ...snapshot.groups.memberOf].map(
        (item) => `${item.name} (${item.role})`,
      ),
    );
  });
  details(captureData, 'Events', (section) => {
    row(section, 'Going', sectionCount(snapshot.sections.events, snapshot.events.going.length));
    row(
      section,
      'Interested',
      sectionCount(snapshot.sections.events, snapshot.events.interested.length),
    );
    list(
      section,
      [...snapshot.events.going, ...snapshot.events.interested].map((item) => item.name),
    );
  });
  details(captureData, 'Fetishes', (section) => {
    row(section, 'Into', sectionCount(snapshot.sections.fetishes, snapshot.fetishes.into.length));
    row(
      section,
      'Curious about',
      sectionCount(snapshot.sections.fetishes, snapshot.fetishes.curiousAbout.length),
    );
    row(
      section,
      'Soft limits',
      sectionCount(snapshot.sections.fetishes, snapshot.fetishes.softLimits.length),
    );
    row(
      section,
      'Hard limits',
      sectionCount(snapshot.sections.fetishes, snapshot.fetishes.hardLimits.length),
    );
  });
  details(captureData, 'Social', (section) => {
    row(section, 'Friends', snapshot.social.friends?.toLocaleString() ?? 'not displayed');
    row(section, 'Followers', snapshot.social.followers?.toLocaleString() ?? 'not displayed');
    row(section, 'Following', snapshot.social.following?.toLocaleString() ?? 'not displayed');
  });
  details(captureData, 'About', (section) =>
    row(section, 'Text', snapshot.about.text ?? 'not displayed'),
  );
}

function setCaptureState(
  status: string,
  detail = '',
  variant: 'ok' | 'error' | 'working' = 'working',
): void {
  if (captureStatus) captureStatus.textContent = status;
  if (captureDetail) captureDetail.textContent = detail;
  captureState?.classList.toggle('wd-capture-ok', variant === 'ok');
  captureState?.classList.toggle('wd-capture-error', variant === 'error');
}

function showNotProfile(): void {
  if (captureData) {
    clear(captureData);
    captureData.hidden = true;
  }
  if (openButton) openButton.hidden = true;
  setCaptureState('No FetLife profile detected on this page.', '', 'error');
}

function showUnavailable(message: string): void {
  if (captureData) {
    clear(captureData);
    captureData.hidden = true;
  }
  if (openButton) openButton.hidden = true;
  setCaptureState('DragonWatch is not active on this page.', message, 'error');
}

function showCaptureFailure(message: string, snapshot: FetLifeProfileSnapshot | null = null): void {
  if (snapshot) renderSnapshot(snapshot);
  if (openButton) openButton.hidden = true;
  setCaptureState('Could not capture profile', message, 'error');
}

function captureMessage(response: ProfileCaptureResponse): string {
  if (response.action === 'inserted') return 'Profile added to WatchDragon';
  if (response.action === 'updated') return 'Profile updated in WatchDragon';
  return 'WatchDragon is already current';
}

async function captureCurrentProfile(): Promise<void> {
  if (refreshButton) refreshButton.disabled = true;
  if (openButton) openButton.hidden = true;
  setCaptureState('Reading FetLife profile...');
  try {
    const result = await captureActiveProfile({
      queryActiveTab: async () => browser.tabs.query({ active: true, currentWindow: true }),
      extractProfile: async (tabId) =>
        (await browser.tabs.sendMessage(tabId, {
          type: 'extract-profile',
        } satisfies RuntimeMessage)) as ProfileExtractionResult,
      captureProfile: async (snapshot) =>
        (await browser.runtime.sendMessage({
          type: 'capture-profile',
          snapshot,
        } satisfies RuntimeMessage)) as ProfileCaptureResponse,
      onSaving: () => setCaptureState('Saving profile...'),
    });
    if (result.state === 'not-profile') {
      showNotProfile();
      return;
    }
    if (result.state === 'unavailable') {
      showUnavailable(
        `${result.message} Confirm the extension was built for https://fetlife.com, then reload the profile page.`,
      );
      return;
    }
    if (result.state === 'failure') {
      showCaptureFailure(result.message, result.snapshot);
      return;
    }
    renderSnapshot(result.snapshot);
    const response = result.response;
    const warningText = response.warnings.length > 0 ? response.warnings.join(' ') : '';
    setCaptureState(
      captureMessage(response),
      warningText ||
        (response.action === 'unchanged'
          ? 'No stored profile data changed.'
          : 'Captured data is shown below.'),
      'ok',
    );
    if (openButton) openButton.hidden = false;
    openButton?.setAttribute('data-entity-id', response.entityId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The profile could not be saved.';
    showCaptureFailure(message);
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function load(): Promise<void> {
  const settings = await getSettings();
  input('#api-url').value = settings.apiUrl;
  input('#web-url').value = settings.webUrl;
  input('#api-token').value = settings.apiToken;
  input('#overlays-enabled').checked = settings.overlaysEnabled;
  input('#cards-enabled').checked = settings.cardsEnabled;
  input('#mock-mode').checked = settings.mockMode;
  await checkConnection();
  await captureCurrentProfile();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const settings: ExtensionSettings = {
    apiUrl: input('#api-url').value.trim().replace(/\/$/, ''),
    webUrl: input('#web-url').value.trim().replace(/\/$/, ''),
    apiToken: input('#api-token').value,
    overlaysEnabled: input('#overlays-enabled').checked,
    cardsEnabled: input('#cards-enabled').checked,
    mockMode: input('#mock-mode').checked,
  };
  try {
    new URL(settings.apiUrl);
    new URL(settings.webUrl);
    await saveSettings(settings);
    if (saved) saved.textContent = 'Settings saved.';
    await checkConnection();
  } catch {
    if (saved) saved.textContent = 'Use valid HTTP or HTTPS URLs.';
  }
});

refreshButton?.addEventListener('click', () => void captureCurrentProfile());
openButton?.addEventListener('click', async () => {
  const entityId = openButton.dataset.entityId;
  if (!entityId) return;
  await browser.runtime.sendMessage({ type: 'open-web-url', entityId } satisfies RuntimeMessage);
});
checkButton?.addEventListener('click', () => void checkConnection());
void load();
