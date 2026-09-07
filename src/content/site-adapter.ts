export interface UserReference {
  platformUserId: string;
  href: string;
  element: HTMLAnchorElement;
}

export interface SiteAdapter {
  findUserReferences(root: ParentNode): UserReference[];
}

export function extractProfileId(
  href: string,
  baseUrl = typeof window === 'undefined'
    ? 'https://community.example.invalid/'
    : window.location.href,
): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const match = url.pathname.match(/(?:^|\/)users\/(\d+)(?:\/|$)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizedPath(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

function extractStoryActorId(element: HTMLAnchorElement): string | null {
  const story = element.closest<HTMLElement>('[data-story-actor-id]');
  if (!story) return null;

  const actorId = story.dataset.storyActorId;
  const authorPath = story.dataset.dwellAuthorPath ?? story.dataset.storyAuthorPath;
  const linkPath = normalizedPath(element.href, window.location.href);
  if (!actorId || !/^\d+$/.test(actorId) || !authorPath || !linkPath) return null;

  return normalizedPath(authorPath, window.location.href) === linkPath ? actorId : null;
}

export class CommunitySiteAdapter implements SiteAdapter {
  findUserReferences(root: ParentNode): UserReference[] {
    const anchors: HTMLAnchorElement[] = [];
    if (root instanceof HTMLAnchorElement) anchors.push(root);
    anchors.push(...Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]')));
    return anchors.flatMap((element) => {
      const platformUserId = extractProfileId(element.href) ?? extractStoryActorId(element);
      return platformUserId ? [{ platformUserId, href: element.href, element }] : [];
    });
  }
}
