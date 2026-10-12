# WP Sidebar Editor

Расширение для браузера, которое позволяет редактировать страницы, записи, термины и кастомные поля WordPress
из боковой панели браузера, не заходя в wp-admin. Работает в паре с плагином-мостом **Sidebar Editor Bridge**
(`wp-plugin/sidebar-editor-bridge/`), подготовленным к публикации в каталоге WordPress.org.

- **Chrome**: нативная side panel (`chrome.sidePanel`).
- **Firefox**: `sidebar_action` (собирается из тех же исходников, проверено только сборкой — см. ARCHITECTURE.md).

## Установка

```bash
npm install
npm run build          # dist/chrome и dist/firefox
```

- Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → `dist/chrome`.
- Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `dist/firefox/manifest.json`.
  В Firefox MV3 доступ к сайтам (`<all_urls>`) по умолчанию не выдан: about:addons → расширение → Permissions → включить.
- На каждом сайте WordPress: `npm run zip:plugin` → загрузите `dist/sidebar-editor-bridge-<версия>.zip` через
  Плагины → Добавить новый → Загрузить (или скопируйте папку `wp-plugin/sidebar-editor-bridge/` в `wp-content/plugins/`)
  и активируйте. **Старый однофайловый `sidebar-editor-bridge.php` из `wp-content/plugins/` деактивируйте и удалите**:
  иначе на сайте будут два моста, которые регистрируют одни и те же REST-маршруты и дважды печатают данные для панели. Настройки: Настройки → Sidebar Editor Bridge.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | сборка Chrome в watch-режиме (после правок — «Обновить» на `chrome://extensions`) |
| `npm run dev:firefox` | то же для Firefox |
| `npm run build` | продакшен-сборка для обоих браузеров |
| `npm run zip` | сборка + zip-архивы для Chrome Web Store / AMO в `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit-тесты (Vitest + jsdom) |
| `npm run test:e2e` | e2e smoke в настоящем Chromium с собранным расширением и фейковым WP REST API (один раз нужно `npx playwright install chromium`, перед запуском `npm run build:chrome`) |
| `npm run test:php` | unit-проверки классов плагина-моста без WordPress (нужен `php` в PATH) |
| `npm run test:integration` | проверка моста на **настоящем** WordPress (см. ниже) |
| `npm run test:e2e:wp` | расширение + настоящий WordPress: форма подключения → календарь → Save → проверка в БД, плюс страница настроек плагина |
| `npm run zip:plugin` | zip плагина для загрузки в WordPress / отправки на WordPress.org |
| `composer install && composer lint` | WordPress Coding Standards + PHPCompatibility для плагина |
| `npm run check` | typecheck + тесты + сборка |

### Проверка на настоящем WordPress

Нужен локальный сайт (например, в OSPanel) с активными ACF и Sidebar Editor Bridge:

1. положите `tests/integration/test-fields.php` в `wp-content/mu-plugins/` — он создаёт тестовую группу полей ACF для страниц;
2. создайте страницу «Курс» и пользователя-контрибьютора;
3. `set WP_URL=http://ваш-сайт& set WP_ADMIN_PASS=…& set WP_CONTRIB_PASS=…& set WP_PAGE_ID=<id> & npm run test:integration`
   (переменные: `WP_URL`, `WP_ADMIN`, `WP_ADMIN_PASS`, `WP_CONTRIB`, `WP_CONTRIB_PASS`, `WP_PAGE_ID`, для e2e ещё `WP_PAGE_TITLE`).

## Поля дат

Поля ACF `date_picker`, `date_time_picker`, `time_picker`, дата публикации записи и даты распродажи WooCommerce
открываются нативным календарём браузера. Рядом с полем есть кнопки «Сегодня»/«Сейчас» и «✕» (очистить),
а под полем — дата полностью, с днём недели. Подробности — в ARCHITECTURE.md, раздел «Даты».

Структура проекта, принципы и предложения по развитию — в [ARCHITECTURE.md](ARCHITECTURE.md).
