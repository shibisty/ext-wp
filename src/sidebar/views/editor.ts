// Editor screen: collapsible, lazily-loaded provider sections, Polylang
// language tabs, save, autosave-to-draft and Ctrl/Cmd+S.

import type { Field, FieldValues, Provider } from '../../types';
import { getCachedSchema, setCachedSchema } from '../../lib/cache';
import { clearDraft, getDraft, setDraft } from '../../lib/drafts';
import { saveSettings, t } from '../../lib/i18n';
import { buildRestUrl, expectOk, jsonPost } from '../../lib/wp-client';
import { getProvidersFor } from '../../providers/registry';
import { button, h } from '../dom';
import { collectValues } from '../fields/collect';
import { buildFieldsEl } from '../fields/render';
import { appRoot, render, renderChrome } from '../layout';
import { state } from '../state';

export interface SectionsOptions {
  offlineBadge?: boolean;
}

export function renderSections(opts: SectionsOptions = {}): void {
  const ctx = state.ctx;
  if (!ctx) return;
  state.lastMainRender = () => renderSections(opts);
  const { lang } = state;

  const container = h('div');
  if (opts.offlineBadge) container.append(h('div', { className: 'seb-offline-badge', textContent: t('offlineBadge', lang) }));

  // Top-level language tabs (Polylang) — switching just repoints ctx.postId
  // at that language's translation and re-renders.
  if (ctx.languages && ctx.languages.length > 1) container.append(buildLanguageTabs());

  const toolbar = h('div', { className: 'seb-toolbar seb-toolbar-main' });
  if (ctx.editUrl) {
    const editUrl = ctx.editUrl;
    toolbar.append(button({
      className: 'seb-link-btn', textContent: '↗ ' + t('openInAdmin', lang),
      onclick: () => chrome.tabs.create({ url: editUrl }),
    }));
  }
  const toggleAllBtn = button({ className: 'seb-link-btn' });
  toolbar.append(toggleAllBtn);
  container.append(toolbar);

  const form = h('form');
  form.addEventListener('submit', (e) => e.preventDefault()); // Enter in a text input must not navigate
  const detailsEls: HTMLDetailsElement[] = [];

  for (const provider of getProvidersFor(ctx)) {
    const stored = state.settings.sections[provider.id];
    const isOpen = stored !== undefined ? stored : provider.id === 'core';

    const fieldsContainer = h('div', { textContent: t('loadingFields', lang) });
    // force: bypass the server-data cache; keepDraft: still show unsaved
    // edits on top — "Refresh" means "get the real current baseline", not
    // "throw away what I was typing" (that's what Discard is for).
    const refreshBtn = button({
      className: 'seb-link-btn', textContent: t('refresh', lang),
      onclick: () => loadSectionInto(provider, fieldsContainer, { force: true, keepDraft: true }),
    });

    const details = h('details', { open: isOpen },
      h('summary', { textContent: provider.id }),
      h('div', { className: 'seb-section-body' },
        h('div', { className: 'seb-toolbar seb-section-toolbar' }, refreshBtn),
        fieldsContainer,
      ),
    );
    // Lazy: a section is fetched the first time it is open. Chromium also
    // fires 'toggle' for a <details> created already open, so without this
    // flag an open section loaded twice — and on a slow site the second
    // response re-rendered the fields over whatever the user had typed.
    let started = false;
    const ensureLoaded = () => {
      if (started || !details.open) return;
      started = true;
      loadSectionInto(provider, fieldsContainer);
    };
    details.addEventListener('toggle', () => {
      if (state.settings.sections[provider.id] !== details.open) {
        state.settings.sections[provider.id] = details.open;
        saveSettings(state.settings); // persisted globally across posts, fire-and-forget
      }
      ensureLoaded();
    });
    detailsEls.push(details);
    form.append(details);

    ensureLoaded();
  }

  const updateToggleAllLabel = () => {
    toggleAllBtn.textContent = detailsEls.some((d) => !d.open) ? t('expandAll', lang) : t('collapseAll', lang);
  };
  updateToggleAllLabel();
  detailsEls.forEach((d) => d.addEventListener('toggle', updateToggleAllLabel));
  toggleAllBtn.onclick = () => {
    const anyClosed = detailsEls.some((d) => !d.open);
    detailsEls.forEach((d) => { d.open = anyClosed; }); // setting .open fires 'toggle' natively
  };

  form.append(button({ id: 'seb-save', textContent: t('save', lang), onclick: () => runSave() }));
  container.append(form);
  renderChrome(container);
}

/** Overlay autosaved-but-unsaved values on top of a schema. */
export function applyDraft(schema: Field[], draft: FieldValues | null): { schema: Field[]; hasDraft: boolean } {
  if (!draft) return { schema, hasDraft: false };
  let hasDraft = false;
  const merged = schema.map((f) => {
    if (Object.prototype.hasOwnProperty.call(draft, f.id) && draft[f.id] !== f.value) {
      hasDraft = true;
      return { ...f, value: draft[f.id] };
    }
    return f;
  });
  return { schema: merged, hasDraft };
}

interface LoadOptions {
  force?: boolean;
  keepDraft?: boolean;
}

async function loadSectionInto(provider: Provider, containerEl: HTMLElement, opts: LoadOptions = {}): Promise<void> {
  const ctx = state.ctx;
  if (!ctx) return;
  try {
    let schema = opts.force ? null : await getCachedSchema(ctx, provider.id);
    if (!schema) {
      containerEl.textContent = t('loadingFields', state.lang);
      schema = provider.getSchema(await provider.load(ctx));
      setCachedSchema(ctx, provider.id, schema); // fire-and-forget
    }

    // Autosaved edits take priority over server/cached values — that's the whole point of the safety net.
    const draft = !opts.force || opts.keepDraft ? await getDraft(ctx, provider.id) : null;
    // The section's baseline is the un-drafted schema: providers compare
    // against it to tell "changed" from "untouched" on save.
    state.sections[provider.id] = { provider, schema };
    const shown = applyDraft(schema, draft);

    containerEl.replaceChildren();
    if (shown.hasDraft) containerEl.append(buildDraftNotice(provider, containerEl));
    containerEl.append(buildFieldsEl(provider.id, shown.schema, { lang: state.lang, uploadImage: ctx.uploadImage }));
  } catch (err) {
    containerEl.textContent = t('error', state.lang) + ': ' + (err as Error).message;
  }
}

function buildDraftNotice(provider: Provider, containerEl: HTMLElement): HTMLElement {
  return h('div', { className: 'seb-draft-notice' },
    h('span', { textContent: t('draftRestored', state.lang) }),
    button({
      className: 'seb-link-btn', textContent: t('discardDraft', state.lang),
      onclick: async () => {
        if (state.ctx) await clearDraft(state.ctx, provider.id);
        loadSectionInto(provider, containerEl, { force: true }); // re-fetch, ignoring the dropped draft
      },
    }),
  );
}

// ---- Language tabs (Polylang) ----

function buildLanguageTabs(): HTMLElement {
  const ctx = state.ctx!;
  const bar = h('div', { className: 'seb-lang-tabs' });
  for (const l of ctx.languages || []) {
    const untranslated = !l.postId;
    const name = l.name || l.slug.toUpperCase();
    const tab = button({
      className: 'seb-lang-tab'
        + (l.slug === state.activeLangSlug ? ' seb-lang-tab-active' : '')
        + (untranslated ? ' seb-lang-tab-untranslated' : ''),
      textContent: untranslated ? `+ ${name}` : name,
      title: untranslated ? t('createTranslation', state.lang) : '',
    });
    tab.onclick = () => (untranslated ? createTranslation(l, tab) : switchLanguage(l));
    bar.append(tab);
  }
  return bar;
}

function switchLanguage(l: { slug: string; postId: number | null }): void {
  if (!state.ctx || !l.postId || l.slug === state.activeLangSlug) return;
  state.activeLangSlug = l.slug;
  state.ctx.postId = l.postId;
  state.sections = {};
  renderSections({ offlineBadge: state.mode === 'connection' });
}

async function createTranslation(l: { slug: string; postId: number | null }, tabEl: HTMLButtonElement): Promise<void> {
  const ctx = state.ctx!;
  const originalText = tabEl.textContent;
  tabEl.disabled = true;
  tabEl.textContent = t('creating', state.lang);
  try {
    const url = buildRestUrl(ctx.restRoot, '/sidebar-editor/v1/create-translation');
    const json = expectOk<{ id: number; restBase?: string }>(
      await ctx.request(url, jsonPost({ sourcePostId: ctx.postId, lang: l.slug })),
      'Failed to create translation',
    );
    l.postId = json.id;
    if (json.restBase) ctx.restBase = json.restBase;
    switchLanguage(l);
  } catch (err) {
    tabEl.disabled = false;
    tabEl.textContent = originalText;
    render(t('error', state.lang) + ': ' + (err as Error).message);
  }
}

// ---- Save ----

function runSave(): void {
  save().catch((err) => render(t('error', state.lang) + ': ' + (err as Error).message));
}

export async function save(): Promise<void> {
  const ctx = state.ctx;
  if (!ctx) return;
  const { bySection, firstInvalid, jsonErrors } = collectValues(appRoot());

  if (firstInvalid) {
    firstInvalid.reportValidity();
    firstInvalid.focus();
    return;
  }
  if (jsonErrors.length) {
    const e = jsonErrors[0];
    throw new Error(`${e.section} / ${e.field}: ${e.message}`);
  }
  // Ctrl+S on a screen with no editor form (e.g. the add-connection popup,
  // whose button shares the #seb-save style) must not "save" and reload.
  if (!Object.keys(bySection).length) return;

  for (const [sectionId, values] of Object.entries(bySection)) {
    const section = state.sections[sectionId];
    if (!section) continue;
    await section.provider.save(ctx, values, section.schema);

    const updated = section.schema.map((f) => (f.id in values ? { ...f, value: values[f.id] } : f));
    section.schema = updated;
    setCachedSchema(ctx, sectionId, updated); // fire-and-forget
    clearDraft(ctx, sectionId); // no longer "unsaved" — fire-and-forget
  }

  render(t('saved', state.lang));
  if (ctx.tabId !== undefined) {
    // Live mode — reload the WP page itself; the panel's field data is
    // already cached, so this won't force a re-fetch.
    chrome.tabs.reload(ctx.tabId);
  } else {
    // Connection mode: no tab to reload. The cache already reflects the save.
    setTimeout(() => renderSections({ offlineBadge: state.mode === 'connection' }), 600);
  }
}

// ---- Autosave (draft safety net) + Ctrl/Cmd+S ----

let autosaveHandle: ReturnType<typeof setTimeout> | undefined;

// Delegated on #app (attached once in main.ts) so it keeps working across
// every renderChrome() DOM rebuild.
export function scheduleAutosave(e: Event): void {
  const target = e.target as HTMLElement | null;
  if (!state.ctx || !target?.dataset?.section) return;
  clearTimeout(autosaveHandle);
  autosaveHandle = setTimeout(persistDraftsNow, 800);
}

export function persistDraftsNow(): void {
  const ctx = state.ctx;
  if (!ctx) return;
  const { bySection } = collectValues(appRoot());
  Object.entries(bySection).forEach(([sectionId, values]) => setDraft(ctx, sectionId, values));
}

export function onGlobalKeydown(e: KeyboardEvent): void {
  const isSaveCombo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
  if (!isSaveCombo) return;
  e.preventDefault(); // otherwise the browser tries to "Save Page As..."
  if (!state.ctx || !appRoot().querySelector('#seb-save')) return; // nothing editable shown
  clearTimeout(autosaveHandle);
  persistDraftsNow(); // capture the very latest keystrokes too
  runSave();
}
