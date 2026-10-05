export const VISITS_HISTORY_STATE_KEY = 'komorebiVisits';

export type VisitsHistoryLayer = 'outings' | 'garden-visit';

export interface VisitsHistoryMarker {
  layer: VisitsHistoryLayer;
  visitId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readVisitsMarker(state: unknown): VisitsHistoryMarker | null {
  if (!isRecord(state)) return null;
  const raw = state[VISITS_HISTORY_STATE_KEY];
  if (!isRecord(raw)) return null;
  if (raw.layer === 'outings') return { layer: 'outings' };
  if (raw.layer === 'garden-visit') {
    return {
      layer: 'garden-visit',
      visitId: typeof raw.visitId === 'string' ? raw.visitId : undefined,
    };
  }
  return null;
}

export function mergeHistoryState(marker: VisitsHistoryMarker | null): Record<string, unknown> {
  const previous = isRecord(history.state) ? { ...history.state } : {};
  if (marker === null) {
    const { [VISITS_HISTORY_STATE_KEY]: _removed, ...rest } = previous;
    return rest;
  }
  return {
    ...previous,
    [VISITS_HISTORY_STATE_KEY]: marker,
  };
}

export function pushVisitsHistory(marker: VisitsHistoryMarker): void {
  history.pushState(mergeHistoryState(marker), '');
}

export function replaceVisitsHistory(marker: VisitsHistoryMarker | null): void {
  history.replaceState(mergeHistoryState(marker), '');
}

export function clearVisitsHistoryMarker(): void {
  replaceVisitsHistory(null);
}

/** @returns true when history.back() was invoked to consume an owned entry */
export function consumeVisitsHistoryBack(expectedLayer: VisitsHistoryLayer): boolean {
  const marker = readVisitsMarker(history.state);
  if (marker?.layer === expectedLayer) {
    history.back();
    return true;
  }
  return false;
}

/** @returns true when history.go was invoked to reach own garden */
export function consumeVisitsHistoryToGarden(): boolean {
  const marker = readVisitsMarker(history.state);
  if (!marker) return false;
  if (marker.layer === 'garden-visit') {
    history.go(-2);
    return true;
  }
  if (marker.layer === 'outings') {
    history.back();
    return true;
  }
  return false;
}
