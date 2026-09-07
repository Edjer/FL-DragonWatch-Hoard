import { statusPresentation } from '@/content/status';
import type { WatchDragonSummary } from '@/types/watchdragon';

export class HoverCard {
  private card: HTMLElement | null = null;
  private closeTimer: number | undefined;

  constructor(private readonly webUrl: string) {
    document.addEventListener('pointerdown', (event) => {
      if (this.card && !this.card.contains(event.target as Node)) this.close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  bind(indicator: HTMLButtonElement, summary: WatchDragonSummary): void {
    indicator.addEventListener('mouseenter', () => this.scheduleOpen(indicator, summary));
    indicator.addEventListener('focus', () => this.open(indicator, summary));
    indicator.addEventListener('mouseleave', () => this.scheduleClose());
    indicator.addEventListener('click', (event) => {
      event.stopPropagation();
      if (this.card?.dataset.wdFor === summary.platformUserId) this.close();
      else this.open(indicator, summary);
    });
  }

  private scheduleOpen(indicator: HTMLButtonElement, summary: WatchDragonSummary): void {
    window.clearTimeout(this.closeTimer);
    this.open(indicator, summary);
  }

  private scheduleClose(): void {
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => this.close(), 180);
  }

  private open(indicator: HTMLButtonElement, summary: WatchDragonSummary): void {
    this.close();
    const presentation = statusPresentation(summary.status);
    const card = document.createElement('section');
    card.className = 'wd-card';
    card.dataset.wdFor = summary.platformUserId;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'DragonWatch summary');
    card.addEventListener('mouseenter', () => window.clearTimeout(this.closeTimer));
    card.addEventListener('mouseleave', () => this.scheduleClose());

    const heading = document.createElement('div');
    heading.className = 'wd-card-heading';
    const title = document.createElement('strong');
    title.textContent = 'DragonWatch';
    const state = document.createElement('span');
    state.className = `wd-card-status wd-status-${summary.status}`;
    state.textContent = `${presentation.marker} ${presentation.label.toUpperCase()}`;
    heading.append(title, state);
    card.append(heading);

    const name = document.createElement('h3');
    name.textContent = summary.displayName;
    card.append(name);
    const confidence = document.createElement('p');
    confidence.className = 'wd-card-confidence';
    confidence.textContent = `Confidence: ${Math.round(summary.confidence * 100)}%`;
    card.append(confidence);

    const facts = document.createElement('dl');
    this.addFact(facts, 'Aliases', String(summary.aliases.length));
    this.addFact(facts, 'Flags', String(summary.flagCount));
    this.addFact(facts, 'Relationships', String(summary.relationshipCount));
    this.addFact(facts, 'Linked accounts', String(summary.linkedAccountCount));
    card.append(facts);

    if (summary.lastReviewedAt) {
      const reviewed = document.createElement('p');
      reviewed.className = 'wd-card-reviewed';
      reviewed.textContent = `Last reviewed: ${this.formatDate(summary.lastReviewedAt)}`;
      card.append(reviewed);
    }

    const link = document.createElement('a');
    link.className = 'wd-card-link';
    link.href = this.entityUrl(summary.entityId);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open DragonWatch';
    card.append(link);

    document.body.append(card);
    this.card = card;
    const rect = indicator.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - cardRect.width - 12);
    const top =
      rect.bottom + 8 + cardRect.height <= window.innerHeight
        ? rect.bottom + 8
        : rect.top - cardRect.height - 8;
    card.style.left = `${left}px`;
    card.style.top = `${Math.max(12, top)}px`;
  }

  private addFact(list: HTMLDListElement, label: string, value: string): void {
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    list.append(term, description);
  }

  private entityUrl(entityId: string): string {
    try {
      const url = new URL(this.webUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return '#';
      return `${url.origin}${url.pathname.replace(/\/$/, '')}/entities/${encodeURIComponent(entityId)}`;
    } catch {
      return '#';
    }
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf())
      ? 'unknown'
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  }

  close(): void {
    window.clearTimeout(this.closeTimer);
    this.card?.remove();
    this.card = null;
  }
}
