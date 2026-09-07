import type { SiteAdapter, UserReference } from '@/content/site-adapter';

export type ReferenceHandler = (references: UserReference[]) => void;

export class IncrementalScanner {
  private readonly observer: MutationObserver;
  private timer: number | undefined;

  constructor(
    private readonly adapter: SiteAdapter,
    private readonly onReferences: ReferenceHandler,
  ) {
    this.observer = new MutationObserver((mutations) => {
      const nodes = mutations.flatMap((mutation) => Array.from(mutation.addedNodes));
      if (nodes.length === 0) return;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        const references = nodes.flatMap((node) =>
          node instanceof Element || node instanceof DocumentFragment
            ? this.adapter.findUserReferences(node)
            : [],
        );
        this.onReferences(references);
      }, 180);
    });
  }

  start(): void {
    this.onReferences(this.adapter.findUserReferences(document));
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    window.clearTimeout(this.timer);
    this.observer.disconnect();
  }
}
