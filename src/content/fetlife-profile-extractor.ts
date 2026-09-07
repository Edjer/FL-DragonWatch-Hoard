import type {
  FetLifeEvent,
  FetLifeFetish,
  FetLifeGroup,
  FetLifeProfileSnapshot,
  FetLifeRelationship,
  ProfileExtractionResult,
  SectionState,
} from '@/types/fetlife-profile';

const PROFILE_HEADER_SELECTORS = [
  '[data-test-id="profile-header"]',
  '[data-testid="profile-header"]',
  '[data-profile-header]',
  'turbo-frame#profile-header',
];

const SECTION_SELECTORS = {
  relationships: [
    '[data-test-id="profile-relationships"]',
    'turbo-frame#profile-relations',
    'turbo-frame[id^="profile-relations"]',
  ],
  groups: [
    '[data-test-id="profile-groups"]',
    '[data-profile-groups]',
    'turbo-frame#profile-groups',
    'turbo-frame[id^="profile-groups"]',
  ],
  events: [
    '[data-test-id="profile-events"]',
    '[data-profile-events]',
    'turbo-frame#profile-events',
    'turbo-frame[id^="profile-events"]',
  ],
  fetishes: [
    '[data-test-id="profile-fetishes"]',
    '[data-profile-fetishes]',
    'turbo-frame#profile-fetishes',
    'turbo-frame[id^="profile-fetishes"]',
  ],
  about: ['[data-test-id="profile-about"]', '[data-profile-about]'],
  social: [
    '[data-test-id="profile-social"]',
    '[data-profile-social]',
    '[data-test-id="profile-friends"]',
    '[data-test-id="profile-followers"]',
    '[data-test-id="profile-following"]',
  ],
} as const;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const MAX_FETISHES = 75;

function text(element: Element | null, preserveLines = false): string {
  if (!element) return '';
  const value = element.textContent ?? '';
  if (!preserveLines) return value.replace(/\s+/g, ' ').trim();
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function directText(element: Element | null): string {
  if (!element) return '';
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(root: ParentNode, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) return element;
  }
  return null;
}

function all(root: ParentNode, selectors: readonly string[]): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const selector of selectors) {
    elements.push(...Array.from(root.querySelectorAll<HTMLElement>(selector)));
  }
  return elements;
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements));
}

function uniqueText(elements: Element[]): string[] {
  return Array.from(new Set(elements.map((element) => text(element)).filter(Boolean)));
}

function canonicalUrl(href: string | null, baseUrl: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function externalId(href: string | null, segment: string, baseUrl: string): string | null {
  const url = canonicalUrl(href, baseUrl);
  if (!url) return null;
  try {
    const match = new URL(url).pathname.match(new RegExp(`/${segment}/(\\d+)(?:/|$)`, 'i'));
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function numberValue(value: string): number | null {
  const match = value.replace(/,/g, '').match(/\b(\d+)\b/);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function labelledValue(root: ParentNode, label: string): string {
  const normalizedLabel = label.toLowerCase();
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'));
  const match = candidates.find((element) => {
    const declared = element.dataset.label ?? '';
    const normalized = text(element).toLowerCase();
    return (
      declared.toLowerCase() === normalizedLabel ||
      normalized === normalizedLabel ||
      normalized.startsWith(`${normalizedLabel}:`) ||
      normalized.startsWith(`${normalizedLabel} `)
    );
  });
  if (!match) return '';
  if (match.dataset.value) return match.dataset.value.trim();
  const valueElement = match.querySelector<HTMLElement>('[data-value], dd, td:last-child');
  if (valueElement) return text(valueElement);
  return text(match)
    .replace(new RegExp(`^${label}\\s*:?\\s*`, 'i'), '')
    .trim();
}

function hasLabel(root: ParentNode, label: string): boolean {
  const expected = label.toLowerCase();
  return Array.from(root.querySelectorAll<HTMLElement>('*')).some(
    (element) => text(element).toLowerCase() === expected,
  );
}

function profileBadge(root: ParentNode, label: string): boolean {
  const expected = label.toLowerCase();
  return Array.from(root.querySelectorAll<HTMLElement>('*')).some((element) => {
    const attributes = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('data-original-title'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const icon = element.querySelector<SVGUseElement>('use[href]')?.getAttribute('href') ?? '';
    return (
      attributes.includes(expected) ||
      icon.includes(`#icon-${expected}`) ||
      (element.children.length === 0 && text(element).toLowerCase() === expected)
    );
  });
}

function demographicValue(root: ParentNode): string {
  const explicit =
    text(first(root, ['[data-test-id="profile-demographics"]', '[data-profile-demographics]'])) ||
    labelledValue(root, 'Demographics');
  if (explicit) return explicit;
  return (
    Array.from(root.querySelectorAll<HTMLElement>('*'))
      .map((element) => (element.children.length === 0 ? text(element) : directText(element)))
      .find((value) =>
        /^\d{1,3}\s*(?:m|f|nb|enby|nonbinary|non-binary|man|woman)\b/i.test(value),
      ) ?? ''
  );
}

function socialCount(root: ParentNode, label: string): number | null {
  const labelled = labelledValue(root, label);
  if (labelled) return numberValue(labelled);
  for (const element of Array.from(root.querySelectorAll<HTMLElement>('[title], [aria-label]'))) {
    const descriptor = `${element.getAttribute('title') ?? ''} ${element.getAttribute('aria-label') ?? ''}`;
    if (new RegExp(`\\b${label}\\b`, 'i').test(descriptor)) {
      const count = numberValue(descriptor);
      if (count !== null) return count;
    }
  }
  return numberValue(text(first(root, [`[data-test-id="profile-${label.toLowerCase()}"]`])));
}

function profileLocation(root: ParentNode): string[] {
  const explicit = listValues(root, [
    '[data-test-id="profile-location"]',
    '[data-profile-location]',
  ]);
  if (explicit.length > 0) return explicit.slice(0, 3);

  const links = uniqueText(
    Array.from(root.querySelectorAll<HTMLElement>('a[href*="/locations/"]')),
  );
  if (links.length > 0) return links.slice(0, 3);

  const labelled = labelledValue(root, 'Location');
  if (labelled)
    return labelled
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 3);

  const candidate = Array.from(root.querySelectorAll<HTMLElement>('*'))
    .map((element) => (element.children.length === 0 ? text(element) : directText(element)))
    .find((value) => {
      const parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.length >= 2 && parts.length <= 3 && value.length <= 180;
    });
  return candidate
    ? candidate
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 3)
    : [];
}

function relationshipBlocks(
  root: ParentNode,
): Array<{ element: HTMLElement; category: FetLifeRelationship['category'] }> {
  const blocks: Array<{ element: HTMLElement; category: FetLifeRelationship['category'] }> = [];
  for (const label of [
    { text: 'Relationships', category: 'relationship' as const },
    { text: 'D/s relationships', category: 'ds' as const },
  ]) {
    const labelElement = Array.from(root.querySelectorAll<HTMLElement>('*')).find(
      (element) =>
        element.children.length === 0 && text(element).toLowerCase() === label.text.toLowerCase(),
    );
    for (
      let parent = labelElement?.parentElement;
      parent && parent !== root;
      parent = parent.parentElement
    ) {
      if (parent.querySelector('a[href]')) {
        blocks.push({ element: parent, category: label.category });
        break;
      }
    }
  }
  return blocks;
}

function usernameFromProfileUrl(sourceUrl: string): string | null {
  try {
    const path = new URL(sourceUrl).pathname.split('/').filter(Boolean);
    const candidate = path.at(-1);
    return candidate && !/^\d+$/.test(candidate) ? decodeURIComponent(candidate) : null;
  } catch {
    return null;
  }
}

function listValues(root: ParentNode, selectors: readonly string[]): string[] {
  const values = all(root, selectors).flatMap((element) => {
    const items = Array.from(element.querySelectorAll<HTMLElement>('li, a, [data-value]'));
    return items.length > 0 ? items : [element];
  });
  return uniqueText(values);
}

function textWithoutElement(element: HTMLElement, excluded: Element | null): string {
  if (!excluded) return text(element);
  const read = (node: Node): string => {
    if (node === excluded) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    return Array.from(node.childNodes).map(read).join(' ');
  };
  return read(element).replace(/\s+/g, ' ').trim();
}

function relationshipRowForLink(link: HTMLAnchorElement, scope: HTMLElement): HTMLElement {
  let row: HTMLElement = link;
  for (let parent = link.parentElement; parent && parent !== scope; parent = parent.parentElement) {
    if (parent.querySelectorAll('a[href]').length !== 1) break;
    row = parent;
  }
  return row;
}

function precedingRelationshipCategory(
  scope: HTMLElement,
  row: HTMLElement,
): FetLifeRelationship['category'] | null {
  let latest: FetLifeRelationship['category'] | null = null;
  for (const marker of Array.from(scope.querySelectorAll<HTMLElement>('*'))) {
    const normalized = text(marker).replace(/\s+/g, ' ').trim().toLowerCase();
    const category =
      normalized === 'd/s relationships'
        ? 'ds'
        : normalized === 'relationships'
          ? 'relationship'
          : null;
    if (
      category &&
      !marker.contains(row) &&
      marker.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING
    ) {
      latest = category;
    }
  }
  return latest;
}

function statusFromText(value: string): 'going' | 'interested' | null {
  const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
  if (/^(?:events?\s+)?interested(?:\s+in)?\b/.test(normalized)) return 'interested';
  if (/^(?:events?\s+)?going\b/.test(normalized)) return 'going';
  return null;
}

function precedingEventStatus(
  root: ParentNode,
  section: HTMLElement,
  row: HTMLElement,
): FetLifeEvent['status'] | null {
  let latest: FetLifeEvent['status'] | null = null;
  const markers = Array.from(root.querySelectorAll<HTMLElement>('*'));
  for (const marker of markers) {
    const status = statusFromText(text(marker));
    if (
      !status ||
      marker === row ||
      marker.contains(row) ||
      !(marker.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)
    ) {
      continue;
    }
    if (section.contains(marker) || section.parentElement?.contains(marker)) latest = status;
  }
  return latest;
}

function labelledListValues(root: ParentNode, labels: readonly string[]): string[] {
  const expected = new Set(labels.map((label) => label.toLowerCase()));
  const labelElement = Array.from(root.querySelectorAll<HTMLElement>('*')).find(
    (element) => expected.has(text(element).toLowerCase()) && element.children.length === 0,
  );
  if (!labelElement) return [];

  const parent = labelElement.parentElement;
  if (!parent) return [];
  const values = uniqueText(
    Array.from(parent.querySelectorAll<HTMLElement>('a, li, [data-value]')).filter(
      (element) => element !== labelElement && !labelElement.contains(element),
    ),
  );
  if (values.length > 0) return values;

  const leafValues = uniqueText(
    Array.from(parent.querySelectorAll<HTMLElement>('*')).filter(
      (element) =>
        element.children.length === 0 &&
        element !== labelElement &&
        !labelElement.contains(element),
    ),
  );
  if (leafValues.length > 0) return leafValues;

  const siblingValues: string[] = [];
  for (
    let sibling = labelElement.nextElementSibling;
    sibling;
    sibling = sibling.nextElementSibling
  ) {
    const structuredValues = uniqueText(
      Array.from(sibling.querySelectorAll<HTMLElement>('a, li, [data-value]')),
    );
    if (structuredValues.length > 0) {
      siblingValues.push(...structuredValues);
      continue;
    }
    const leafValues = uniqueText(
      Array.from(sibling.querySelectorAll<HTMLElement>('*')).filter(
        (element) => element.children.length === 0,
      ),
    );
    const value = leafValues.length > 0 ? leafValues.join(', ') : text(sibling);
    if (value) siblingValues.push(value);
  }
  return Array.from(new Set(siblingValues.filter(Boolean)));
}

function parseDemographics(raw: string): {
  age: number | null;
  gender: string | null;
  role: string | null;
} {
  const match = raw.match(/^\s*(\d{1,3})\s*([A-Za-z]{1,20})?\s*(.*?)\s*$/);
  if (!match) return { age: null, gender: null, role: raw || null };
  const age = Number(match[1] ?? '');
  const possibleGender = match[2] ?? '';
  const gender = /^(m|f|nb|enby|nonbinary|non-binary|man|woman)$/i.test(possibleGender)
    ? possibleGender
    : null;
  const role = (gender ? (match[3] ?? '') : `${possibleGender} ${match[3] ?? ''}`).trim() || null;
  return { age: Number.isSafeInteger(age) ? age : null, gender, role };
}

function parseJoined(raw: string): { year: number | null; month: number | null } {
  const yearMatch = raw.match(/\b((?:19|20)\d{2})\b/);
  const year = yearMatch?.[1] ? Number(yearMatch[1]) : null;
  const monthMatch = raw
    .toLowerCase()
    .match(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\b`));
  const monthName = monthMatch?.[1];
  return { year, month: monthName ? (MONTHS[monthName] ?? null) : null };
}

function state(root: ParentNode, selectors: readonly string[]): SectionState {
  const section = first(root, selectors);
  if (!section) return 'missing';
  if (
    section.getAttribute('aria-busy') === 'true' ||
    section.hasAttribute('busy') ||
    section.dataset.loading === 'true' ||
    section.getAttribute('data-state') === 'loading'
  ) {
    return 'loading';
  }
  return 'present';
}

function profileHeader(root: ParentNode): HTMLElement | null {
  return first(root, PROFILE_HEADER_SELECTORS);
}

function collectIdCandidates(
  root: ParentNode,
  header: HTMLElement,
  joinedValue: string,
  baseUrl: string,
): Set<string> {
  const candidates = new Set<string>();
  const add = (value: string | null): void => {
    if (value && /^\d+$/.test(value)) candidates.add(value);
  };

  add(joinedValue.match(/#(\d{1,20})\b/)?.[1] ?? null);
  add(header.dataset.profileId ?? null);
  add(header.dataset.userId ?? null);
  for (const element of [
    header,
    ...all(header, ['[data-story-actor-id]', '[data-profile-id]', '[data-user-id]']),
  ]) {
    add(element.dataset.storyActorId ?? null);
    add(element.dataset.profileId ?? null);
    add(element.dataset.userId ?? null);
  }
  for (const frame of all(root, ['turbo-frame[id]'])) {
    add(frame.id.match(/(?:^|_)profile_[a-z0-9_-]+_(\d+)$/i)?.[1] ?? null);
  }
  for (const element of [header, ...all(header, ['a[href]'])]) {
    add(externalId(element.getAttribute('href'), 'users', baseUrl));
  }
  add(externalId(baseUrl, 'users', baseUrl));
  if (candidates.size === 0) {
    for (const element of all(root, ['[data-story-actor-id]'])) {
      add(element.dataset.storyActorId ?? null);
    }
  }
  return candidates;
}

function sectionWarnings(sections: FetLifeProfileSnapshot['sections']): string[] {
  return Object.entries(sections)
    .filter(([, value]) => value === 'loading')
    .map(([name]) => `The ${name} section is still loading.`);
}

function extractRelationships(
  root: ParentNode,
  baseUrl: string,
  header: HTMLElement,
): FetLifeRelationship[] {
  const frame = first(root, SECTION_SELECTORS.relationships);
  const scopes = [
    ...(frame
      ? [{ element: frame, category: null as FetLifeRelationship['category'] | null }]
      : []),
    ...relationshipBlocks(header),
  ];
  if (scopes.length === 0) return [];
  const result: FetLifeRelationship[] = [];
  for (const scope of scopes) {
    const rows = all(scope.element, [
      '[data-test-id="relationship-row"]',
      '[data-relationship-type]',
      'li',
      'tr',
    ]);
    const relationshipRows =
      rows.length > 0
        ? rows
        : uniqueElements(
            all(scope.element, ['a[href]']).map((link) =>
              relationshipRowForLink(link as HTMLAnchorElement, scope.element),
            ),
          );
    for (const row of relationshipRows) {
      const category =
        row.dataset.category === 'ds' || row.dataset.relationshipCategory === 'ds'
          ? 'ds'
          : (scope.category ?? precedingRelationshipCategory(scope.element, row) ?? 'relationship');
      const link = row.matches('a[href]')
        ? (row as HTMLAnchorElement)
        : row.querySelector<HTMLAnchorElement>('a[href]');
      const type =
        row.dataset.relationshipType ??
        (text(first(row, ['[data-test-id="relationship-type"]', 'dt', 'strong'])) ||
          textWithoutElement(row, link)
            .replace(/^\s*(?:Relationships|D\/s relationships)\s*/i, '')
            .trim());
      const profileUrl = canonicalUrl(link?.getAttribute('href') ?? null, baseUrl);
      const username = link ? directText(link) || text(link) || null : null;
      if (!type && !username) continue;
      result.push({ category, type: type || 'Relationship', username, profileUrl });
    }
  }
  const seen = new Set<string>();
  return result.filter((relationship) => {
    const key = [
      relationship.category,
      relationship.type,
      relationship.profileUrl ?? relationship.username ?? '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractGroups(
  root: ParentNode,
  baseUrl: string,
  warnings: string[],
): { leading: FetLifeGroup[]; memberOf: FetLifeGroup[] } {
  const frames = uniqueElements(all(root, ['turbo-frame[id^="profile-groups"]']));
  const sections =
    frames.length > 0
      ? frames
      : uniqueElements(all(root, ['[data-test-id="profile-groups"]', '[data-profile-groups]']));
  if (sections.length === 0) return { leading: [], memberOf: [] };
  const groups: FetLifeGroup[] = [];
  for (const section of sections) {
    const frameRole = /(?:^|[-_])leading(?:$|[-_])/i.test(section.id) ? 'leader' : 'member';
    const rows = uniqueElements(
      all(section, ['[data-test-id="group-row"]', '[data-group-role]', 'li']),
    );
    const groupRows =
      rows.length > 0
        ? rows
        : uniqueElements(all(section, ['a[href*="/groups/"]'])).map(
            (link) => link.closest<HTMLElement>('li') ?? link,
          );
    for (const row of groupRows) {
      const link = row.matches('a[href*="/groups/"]')
        ? (row as HTMLAnchorElement)
        : row.querySelector<HTMLAnchorElement>('a[href*="/groups/"]');
      const href = link?.getAttribute('href') ?? row.dataset.groupUrl ?? null;
      const id = externalId(href, 'groups', baseUrl);
      if (!id) {
        if (link) warnings.push('Skipped a group with a malformed URL.');
        continue;
      }
      const url = canonicalUrl(href, baseUrl);
      if (!url) continue;
      const role =
        row.dataset.groupRole === 'leader' ||
        row.closest('[data-group-section="leading"]') ||
        frameRole === 'leader'
          ? 'leader'
          : 'member';
      const name = text(first(row, ['[data-test-id="group-name"]'])) || text(link);
      if (name) groups.push({ fetlifeGroupId: id, name, role, url });
    }
  }
  const deduped = groups.filter(
    (group, index, values) =>
      values.findIndex(
        (item) => item.fetlifeGroupId === group.fetlifeGroupId && item.role === group.role,
      ) === index,
  );
  return {
    leading: deduped.filter((group) => group.role === 'leader'),
    memberOf: deduped.filter((group) => group.role === 'member'),
  };
}

function extractEvents(
  root: ParentNode,
  baseUrl: string,
): { going: FetLifeEvent[]; interested: FetLifeEvent[] } {
  const section = first(root, SECTION_SELECTORS.events);
  if (!section) return { going: [], interested: [] };
  const rows = all(section, ['[data-test-id="event-row"]', '[data-event-status]', 'li']);
  const result: FetLifeEvent[] = [];
  for (const row of rows) {
    const link = row.querySelector<HTMLAnchorElement>('a[href*="/events/"]');
    const url = canonicalUrl(link?.getAttribute('href') ?? null, baseUrl);
    if (!url) continue;
    let status: FetLifeEvent['status'] = 'going';
    let hasExplicitStatus = false;
    if (row.dataset.eventStatus === 'interested' || row.dataset.eventStatus === 'going') {
      status = row.dataset.eventStatus;
      hasExplicitStatus = true;
    }
    const eventSection = row.closest<HTMLElement>('[data-event-section]');
    if (eventSection?.dataset.eventSection) {
      status =
        statusFromText(eventSection.dataset.eventSection) === 'interested' ? 'interested' : 'going';
      hasExplicitStatus = true;
    }
    if (row.closest('[data-event-section="interested"]')) {
      status = 'interested';
      hasExplicitStatus = true;
    }
    if (row.closest('[id*="interested"], [class*="interested"]')) {
      status = 'interested';
      hasExplicitStatus = true;
    }
    if (!hasExplicitStatus) {
      const precedingStatus = precedingEventStatus(root, section, row);
      if (precedingStatus) status = precedingStatus;
    }
    if (status === 'going' && !hasExplicitStatus) {
      for (
        let ancestor = row.parentElement;
        ancestor && ancestor !== section;
        ancestor = ancestor.parentElement
      ) {
        for (
          let previous = ancestor.previousElementSibling;
          previous;
          previous = previous.previousElementSibling
        ) {
          const previousStatus = statusFromText(text(previous));
          if (previousStatus) {
            status = previousStatus;
            break;
          }
        }
        if (status === 'interested') break;
      }
    }
    const name =
      text(first(row, ['[data-test-id="event-name"]'])) || directText(link) || text(link);
    if (name) {
      result.push({
        name,
        url,
        status,
        displayDate: text(first(row, ['[data-test-id="event-date"]', 'time', 'a > div'])) || null,
      });
    }
  }
  const deduped = result.filter(
    (event, index, values) => values.findIndex((item) => item.url === event.url) === index,
  );
  return {
    going: deduped.filter((event) => event.status === 'going'),
    interested: deduped.filter((event) => event.status === 'interested'),
  };
}

function extractFetishes(
  root: ParentNode,
  baseUrl: string,
  warnings: string[],
): FetLifeProfileSnapshot['fetishes'] {
  const section = first(root, SECTION_SELECTORS.fetishes);
  const result: FetLifeProfileSnapshot['fetishes'] = {
    into: [],
    curiousAbout: [],
    softLimits: [],
    hardLimits: [],
  };
  if (!section) return result;
  const categoryMap: Record<string, FetLifeFetish['category']> = {
    into: 'into',
    curious_about: 'curious_about',
    'curious-about': 'curious_about',
    curious: 'curious_about',
    soft_limit: 'soft_limit',
    'soft-limit': 'soft_limit',
    soft: 'soft_limit',
    hard_limit: 'hard_limit',
    'hard-limit': 'hard_limit',
    hard: 'hard_limit',
  };
  const categoryKeys: Record<FetLifeFetish['category'], keyof FetLifeProfileSnapshot['fetishes']> =
    {
      into: 'into',
      curious_about: 'curiousAbout',
      soft_limit: 'softLimits',
      hard_limit: 'hardLimits',
    };
  const categoryFromText = (value: string): FetLifeFetish['category'] | null => {
    const normalized = value.replace(/\s+/g, ' ').trim().toLowerCase();
    if (/^into\b/.test(normalized)) return 'into';
    if (/^curious\s+about\b/.test(normalized)) return 'curious_about';
    if (/^soft\s+limits?\b/.test(normalized)) return 'soft_limit';
    if (/^hard\s+limits?\b/.test(normalized)) return 'hard_limit';
    return null;
  };
  const precedingCategory = (row: HTMLElement): FetLifeFetish['category'] | null => {
    let latest: FetLifeFetish['category'] | null = null;
    for (const marker of Array.from(section.querySelectorAll<HTMLElement>('*'))) {
      const category = categoryFromText(text(marker));
      if (
        category &&
        !marker.contains(row) &&
        marker.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING
      ) {
        latest = category;
      }
    }
    return latest;
  };
  const links = uniqueElements(all(section, ['a[href*="/fetishes/"]']));
  const rows = links.map(
    (link) =>
      link.closest<HTMLElement>('[data-test-id="fetish-row"], [data-fetish-category], li') ?? link,
  );
  let capped = false;
  for (const row of rows) {
    const category =
      categoryMap[(row.dataset.fetishCategory ?? '').toLowerCase()] ?? precedingCategory(row);
    if (!category) continue;
    const link = row.matches('a[href*="/fetishes/"]')
      ? (row as HTMLAnchorElement)
      : row.querySelector<HTMLAnchorElement>('a[href*="/fetishes/"]');
    const href = link?.getAttribute('href') ?? null;
    const id = row.dataset.fetishId ?? externalId(href, 'fetishes', baseUrl);
    if (href?.includes('/fetishes/') && !id)
      warnings.push('Skipped a fetish with a malformed URL.');
    const name =
      text(first(row, ['[data-test-id="fetish-name"]'])) ||
      directText(link) ||
      text(link) ||
      text(row);
    if (!name) continue;
    const detail =
      text(first(row, ['[data-test-id="fetish-detail"]'])) || row.dataset.fetishDetail || null;
    result[categoryKeys[category]].push({ fetlifeFetishId: id, name, detail, category });
  }
  for (const key of Object.keys(result) as Array<keyof typeof result>) {
    const deduped = result[key].filter(
      (item, index, values) =>
        values.findIndex(
          (candidate) => candidate.name === item.name && candidate.detail === item.detail,
        ) === index,
    );
    if (deduped.length > MAX_FETISHES) capped = true;
    result[key] = deduped.slice(0, MAX_FETISHES);
  }
  if (capped) warnings.push(`Fetish capture capped at ${MAX_FETISHES} items per category.`);
  return result;
}

export function isFetLifeProfilePage(root: ParentNode = document): boolean {
  return profileHeader(root) !== null;
}

export function extractFetLifeProfile(
  root: ParentNode = document,
  sourceUrl = typeof window === 'undefined' ? '' : window.location.href,
  capturedAt = new Date().toISOString(),
): ProfileExtractionResult {
  const header = profileHeader(root);
  if (!header) return { detected: false, snapshot: null, warnings: [] };

  const joined = first(header, ['[data-test-id="profile-joined"]', '[data-profile-joined]']);
  const demographicsRaw = demographicValue(header) || null;
  const demographics = parseDemographics(demographicsRaw ?? '');
  const joinedValue = text(joined) || labelledValue(header, 'Joined');
  const joinedRaw =
    joinedValue
      .replace(/#\d{1,20}\b/g, '')
      .replace(/^joined\s*:?\s*/i, '')
      .trim() || null;
  const joinedDate = parseJoined(joinedRaw ?? '');
  const sections: FetLifeProfileSnapshot['sections'] = {
    header: 'present',
    relationships: state(root, SECTION_SELECTORS.relationships),
    groups: state(root, SECTION_SELECTORS.groups),
    events: state(root, SECTION_SELECTORS.events),
    fetishes: state(root, SECTION_SELECTORS.fetishes),
    about: state(root, SECTION_SELECTORS.about),
    social: state(root, SECTION_SELECTORS.social),
  };
  const warnings = sectionWarnings(sections);
  const ids = collectIdCandidates(root, header, joinedValue, sourceUrl);
  if (ids.size === 0) warnings.push('No stable FetLife profile ID could be determined.');
  if (ids.size > 1) warnings.push('Conflicting FetLife profile ID candidates detected.');
  const location = profileLocation(header);
  const pronounValue =
    text(
      first(header, [
        '[data-test-id="profile-pronouns"] [data-value]',
        '[data-test-id="profile-pronouns"]',
      ]),
    ) || labelledValue(header, 'Pronouns');
  const pronouns = pronounValue
    .replace(/^pronouns\s*:?\s*/i, '')
    .split(/,|;/)
    .map((value) => value.trim())
    .filter(Boolean);
  const lookingFor = Array.from(
    new Set(
      listValues(header, ['[data-test-id="profile-looking-for"]']).concat(
        labelledListValues(header, ['Looking for', 'Interested in']),
        labelledValue(header, 'Looking for')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ),
  );
  const username =
    usernameFromProfileUrl(sourceUrl) ||
    text(first(header, ['[data-test-id="profile-username"]', '[data-profile-username]', 'h1']));
  const profileUrl = canonicalUrl(sourceUrl, sourceUrl) ?? sourceUrl;
  const relationships = extractRelationships(root, sourceUrl, header);
  const groups = extractGroups(root, sourceUrl, warnings);
  const events = extractEvents(root, sourceUrl);
  const fetishes = extractFetishes(root, sourceUrl, warnings);
  const snapshot: FetLifeProfileSnapshot = {
    source: { url: sourceUrl, capturedAt },
    identity: {
      fetlifeUserId: ids.size === 1 ? (ids.values().next().value ?? null) : null,
      username,
      profileUrl,
    },
    profile: {
      demographicsRaw,
      age: demographics.age,
      gender: demographics.gender,
      headlineRole: demographics.role,
      verified:
        profileBadge(header, 'verified') ||
        first(header, [
          '[data-test-id="profile-verified"]',
          '[data-verified="true"]',
          '[aria-label="Verified"]',
        ]) !== null,
      supporter:
        profileBadge(header, 'supporter') ||
        first(header, [
          '[data-test-id="profile-supporter"]',
          '[data-supporter="true"]',
          '[aria-label="Supporter"]',
        ]) !== null,
      location: {
        city: location[0] ?? null,
        region: location[1] ?? null,
        country: location[2] ?? null,
      },
      orientation: uniqueText(
        all(header, [
          '[data-popover-id^="orientation-description-"]',
          '[data-test-id="profile-orientation"] a',
        ]),
      ),
      pronouns,
      roles: uniqueText(
        all(header, ['[data-popover-id^="role-description-"]', '[data-test-id="profile-roles"] a']),
      ),
      active:
        text(first(header, ['[data-test-id="profile-active"]'])) ||
        labelledValue(header, 'Active') ||
        (hasLabel(header, 'Active') ? 'Active' : null),
      lookingFor,
      joined: { raw: joinedRaw, ...joinedDate },
    },
    social: {
      friends: socialCount(header, 'Friends'),
      followers: socialCount(header, 'Followers'),
      following: socialCount(header, 'Following'),
    },
    relationships,
    groups,
    events,
    fetishes,
    about: { text: text(first(root, SECTION_SELECTORS.about), true) || null },
    sections,
    warnings,
  };
  return { detected: true, snapshot, warnings };
}
