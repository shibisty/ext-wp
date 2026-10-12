// i18n + settings for the panel's own UI chrome. Provider field labels are
// NOT translated here — they come from WordPress / the plugins themselves.

import type { Settings } from '../types';
import { storageGet, storageSet } from './storage';

export const translations = {
  en: {
    appTitle: 'WP Sidebar Editor',
    detecting: 'Detecting WordPress site…',
    notLoggedIn: 'Not logged in as an editor/admin here — or the bridge plugin isn\u2019t active on this site.',
    noPost: 'No editable content detected at this URL.',
    openWpPage: 'Open a WordPress page in this tab.',
    loadingFields: 'Loading…',
    save: 'Save',
    saved: 'Saved — reloading page…',
    settings: 'Settings',
    language: 'Language',
    theme: 'Theme',
    auto: 'Auto (browser)',
    themeLight: 'Light',
    themeDark: 'Dark',
    back: 'Back',
    error: 'Error',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    dropImage: 'Drop image here or click to browse',
    uploading: 'Uploading…',
    notEditableYet: 'Not editable here yet',
    refresh: 'Refresh',
    noTranslation: 'No translation yet for this language',
    createTranslation: 'Click to create a draft translation',
    creating: 'Creating…',
    connections: 'Connections',
    addConnection: 'Add connection',
    noConnections: 'No saved connections yet',
    removeConnection: 'Remove',
    editConnection: 'Edit connection',
    reconnect: 'Reconnect',
    reenterPassword: 'Re-enter to reconnect',
    siteUrl: 'Site URL',
    username: 'Username',
    password: 'Password',
    connect: 'Connect',
    connecting: 'Connecting…',
    fillAllFields: 'Please fill in all fields',
    browseContent: 'Browse content',
    search: 'Search…',
    typeAny: 'Any type',
    createNew: 'New',
    contentType: 'Content type',
    title: 'Title',
    create: 'Create',
    noResults: 'No results',
    offlineBadge: 'Editing via saved connection (site tab not open)',
    startHint: 'Open a WordPress page in this browser, or pick a saved connection above.',
    newPageDetected: 'Another editable page was found in this tab',
    switchNow: 'Switch',
    checking: 'Checking this tab…',
    draftRestored: 'Unsaved changes restored',
    discardDraft: 'Discard',
    openInAdmin: 'Open in wp-admin',
    clearValue: 'Clear',
    today: 'Today',
    now: 'Now',
    unparsedDate: 'This value could not be read as a date — update the bridge plugin (0.7.0+) to edit it with a picker.',
    publishDate: 'Publish date',
  },
  ru: {
    appTitle: 'WP Sidebar Editor',
    detecting: 'Определяю сайт WordPress…',
    notLoggedIn: 'Вы не авторизованы как редактор/админ, либо bridge-плагин не активен на этом сайте.',
    noPost: 'На этой странице не найдено редактируемого контента.',
    openWpPage: 'Откройте страницу WordPress в этой вкладке.',
    loadingFields: 'Загружаю…',
    save: 'Сохранить',
    saved: 'Сохранено — перезагружаю страницу…',
    settings: 'Настройки',
    language: 'Язык',
    theme: 'Тема',
    auto: 'Авто (как в браузере)',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    back: 'Назад',
    error: 'Ошибка',
    expandAll: 'Развернуть всё',
    collapseAll: 'Свернуть всё',
    dropImage: 'Перетащите изображение сюда или нажмите, чтобы выбрать файл',
    uploading: 'Загружаю…',
    notEditableYet: 'Пока не редактируется здесь',
    refresh: 'Обновить',
    noTranslation: 'Для этого языка ещё нет перевода',
    createTranslation: 'Нажмите, чтобы создать черновик перевода',
    creating: 'Создаю…',
    connections: 'Соединения',
    addConnection: 'Добавить соединение',
    noConnections: 'Пока нет сохранённых соединений',
    removeConnection: 'Удалить',
    editConnection: 'Изменить соединение',
    reconnect: 'Переподключить',
    reenterPassword: 'Введите заново для переподключения',
    siteUrl: 'Адрес сайта',
    username: 'Логин',
    password: 'Пароль',
    connect: 'Подключить',
    connecting: 'Подключаюсь…',
    fillAllFields: 'Заполните все поля',
    browseContent: 'Список контента',
    search: 'Поиск…',
    typeAny: 'Любой тип',
    createNew: 'Новое',
    contentType: 'Тип контента',
    title: 'Заголовок',
    create: 'Создать',
    noResults: 'Ничего не найдено',
    offlineBadge: 'Редактирование через соединение (вкладка сайта не открыта)',
    startHint: 'Откройте страницу WordPress в браузере, либо выберите сохранённое соединение выше.',
    newPageDetected: 'В этой вкладке найдена другая редактируемая страница',
    switchNow: 'Переключиться',
    checking: 'Проверяю вкладку…',
    draftRestored: 'Восстановлены несохранённые изменения',
    discardDraft: 'Отменить',
    openInAdmin: 'Открыть в wp-admin',
    clearValue: 'Очистить',
    today: 'Сегодня',
    now: 'Сейчас',
    unparsedDate: 'Не удалось прочитать значение как дату — обновите bridge-плагин (0.7.0+), чтобы редактировать его через календарь.',
    publishDate: 'Дата публикации',
  },
} satisfies Record<string, Record<string, string>>;

export type Lang = keyof typeof translations;
export type MessageKey = keyof typeof translations.en;

const DEFAULTS: Settings = { lang: 'auto', theme: 'auto', sections: {} };
const STORAGE_KEY = 'seb_settings';

export async function loadSettings(): Promise<Settings> {
  const stored = (await storageGet<Partial<Settings>>(STORAGE_KEY)) || {};
  return { ...DEFAULTS, ...stored, sections: { ...(stored.sections || {}) } };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await storageSet(STORAGE_KEY, settings);
}

export function detectBrowserLang(): Lang {
  const uiLang = chrome.i18n?.getUILanguage?.() || navigator.language || 'en';
  return uiLang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function detectBrowserTheme(): 'light' | 'dark' {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// settings.lang/theme can be 'auto' — these resolve to a concrete value to render with.
export function resolveLang(settings: Settings): Lang {
  return settings.lang === 'auto' ? detectBrowserLang() : settings.lang;
}

export function resolveTheme(settings: Settings): 'light' | 'dark' {
  return settings.theme === 'auto' ? detectBrowserTheme() : settings.theme;
}

export function applyTheme(resolvedTheme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolvedTheme);
}

export function t(key: MessageKey, lang: Lang): string {
  return (translations[lang] as Record<string, string>)?.[key] || translations.en[key] || key;
}

/** Browser locale for Intl/date formatting in the given UI language. */
export function localeFor(lang: Lang): string {
  return lang === 'ru' ? 'ru-RU' : 'en-GB';
}
