import { HoverCard } from '@/content/hover-card';
import { statusPresentation } from '@/content/status';
import type { UserReference } from '@/content/site-adapter';
import type { WatchDragonSummary } from '@/types/watchdragon';

export class Decorator {
  private readonly card: HoverCard;

  constructor(
    webUrl: string,
    private readonly cardsEnabled: boolean,
  ) {
    this.card = new HoverCard(webUrl);
  }

  decorate(reference: UserReference, summary: WatchDragonSummary): void {
    if (reference.element.dataset.watchdragonDecorated === 'true') return;
    reference.element.dataset.watchdragonDecorated = 'true';
    const presentation = statusPresentation(summary.status);
    const indicator = document.createElement('button');
    indicator.type = 'button';
    indicator.className = `wd-indicator wd-status-${summary.status}`;
    indicator.dataset.watchdragonDecorated = 'true';
    indicator.dataset.wdUserId = summary.platformUserId;
    indicator.setAttribute('aria-label', `DragonWatch status: ${presentation.label}`);
    indicator.title = `DragonWatch status: ${presentation.label}`;
    indicator.textContent = presentation.marker;
    indicator.addEventListener('click', (event) => event.stopPropagation());
    indicator.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
    });
    reference.element.insertAdjacentElement('afterend', indicator);
    if (this.cardsEnabled) this.card.bind(indicator, summary);
  }
}
