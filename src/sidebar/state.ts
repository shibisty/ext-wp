// Shared mutable state of the side panel. One module-level object instead of
// a dozen `let`s scattered through a 1400-line file: every view reads and
// writes the same instance, and tests can reset it.

import type { Connection, EditorContext, EntityRef, Field, Provider, Settings } from '../types';
import type { Lang } from '../lib/i18n';

export type Mode = 'live' | 'connection';

export interface SectionState {
  provider: Provider;
  schema: Field[];
}

export interface PanelState {
  ctx: EditorContext | null;
  /** 'live' = cookie+nonce through the open tab; 'connection' = bearer token, no tab needed. */
  mode: Mode;
  activeConnection: Connection | null;
  /** Snapshot of the last live entity, for the offline fallback when its tab goes away. */
  lastLiveCtx: EntityRef | null;
  sections: Record<string, SectionState>;
  currentTabId: number | null;
  /** Polylang: which language's post ctx currently points at. */
  activeLangSlug: string | null;
  settings: Settings;
  /** Resolved (never 'auto'). */
  lang: Lang;
  /** Re-renders whatever main screen is showing (after settings change, Back, ...). */
  lastMainRender: () => void;
}

export function initialState(): PanelState {
  return {
    ctx: null,
    mode: 'live',
    activeConnection: null,
    lastLiveCtx: null,
    sections: {},
    currentTabId: null,
    activeLangSlug: null,
    settings: { lang: 'auto', theme: 'auto', sections: {} },
    lang: 'en',
    lastMainRender: () => {},
  };
}

export const state: PanelState = initialState();

export function resetState(): void {
  Object.assign(state, initialState());
}
