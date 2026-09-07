import type { WatchDragonStatus } from '@/types/watchdragon';

interface StatusPresentation {
  label: string;
  marker: string;
}

const PRESENTATIONS: Record<WatchDragonStatus, StatusPresentation> = {
  known: { label: 'known', marker: 'K' },
  watch: { label: 'watch', marker: 'W' },
  flagged: { label: 'flagged', marker: '!' },
  reviewed: { label: 'reviewed', marker: 'R' },
  linked: { label: 'linked', marker: 'L' },
};

export function statusPresentation(status: WatchDragonStatus): StatusPresentation {
  return PRESENTATIONS[status];
}
