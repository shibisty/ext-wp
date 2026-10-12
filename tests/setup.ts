// Minimal in-memory chrome.* for unit tests. Only what the code under test touches.
import { beforeEach, vi } from 'vitest';

export const memoryStorage = new Map<string, unknown>();

function pick(keys: string | string[] | null | undefined): Record<string, unknown> {
  const list = keys == null ? [...memoryStorage.keys()] : Array.isArray(keys) ? keys : [keys];
  const out: Record<string, unknown> = {};
  for (const k of list) if (memoryStorage.has(k)) out[k] = structuredClone(memoryStorage.get(k));
  return out;
}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (keys?: string | string[]) => pick(keys)),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) memoryStorage.set(k, structuredClone(v));
      }),
      remove: vi.fn(async (keys: string | string[]) => {
        for (const k of Array.isArray(keys) ? keys : [keys]) memoryStorage.delete(k);
      }),
    },
  },
  i18n: { getUILanguage: () => 'en-US' },
  scripting: { executeScript: vi.fn() },
  tabs: { create: vi.fn(), reload: vi.fn() },
};

(globalThis as any).chrome = chromeMock;

beforeEach(() => {
  memoryStorage.clear();
  vi.clearAllMocks();
});
