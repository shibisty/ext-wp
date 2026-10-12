=== Sidebar Editor Bridge ===
Contributors: shibisty
Tags: editor, sidebar, acf, woocommerce, rest-api
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Companion plugin for the WP Sidebar Editor browser extension: edit posts, terms, ACF, WooCommerce and Yoast fields from the browser side panel.

== Description ==

Sidebar Editor Bridge connects your site to the **WP Sidebar Editor** browser extension (Chrome side panel / Firefox sidebar). With both installed, editors can change the page they are looking at straight from the browser's side panel, without opening wp-admin:

* Title, excerpt, content, status, publish date and featured image of posts, pages and custom post types
* Name, slug and description of categories, tags and custom taxonomy terms (including WooCommerce product attributes)
* Advanced Custom Fields: text, number, select, true/false, image, date, date-time and time pickers (complex fields are shown read-only)
* WooCommerce: SKU, prices, sale schedule, stock and weight
* Yoast SEO: SEO title, meta description, focus keyword and canonical URL — for posts and for terms
* Polylang: switch between translations and create a missing translation as a draft
* Settings → Reading: which page is the front page / posts page

**What the plugin does on your site**

* For logged-in users who can edit content, it prints a small JSON block (`<script type="application/json" id="seb-bridge-data">`) into the page footer: which object is being viewed, the REST API root, a REST nonce and which supported plugins are active. Visitors and users without editing rights never get it.
* It adds a few REST API routes under `sidebar-editor/v1` for ACF fields, Yoast term SEO, Polylang translations and the extension's login.
* Every change goes through the same capability checks as wp-admin (`edit_post`, `edit_term`, `manage_options`, …). The plugin never grants anyone more rights than they already have.

**Connections (optional)**

Editors can also connect the extension to a site that is not open in any tab. The extension then exchanges the username and password once for a pair of signed tokens (a short-lived access token and a refresh token) and never stores the password. Administrators can disable this, change token lifetimes and sign out every extension session under **Settings → Sidebar Editor Bridge**. Each user can sign their own extension sessions out on their profile page. Changing a user's password, or regenerating the site's secret keys, also invalidates their tokens.

== Installation ==

1. Install and activate the plugin (Plugins → Add New, or upload the `sidebar-editor-bridge` folder to `/wp-content/plugins/`).
2. Install the WP Sidebar Editor extension in Chrome or Firefox.
3. Open any page of your site while logged in as an editor and click the extension's toolbar icon.

If the extension can't log in from a saved connection on Apache, make sure the server passes the `Authorization` header to PHP (for example `CGIPassAuth On`, or `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` in `.htaccess`).

== Frequently Asked Questions ==

= Does the plugin send data anywhere? =

No. The plugin makes no outgoing requests. It only answers requests that the extension, running in your own browser, sends to your site.

= Who can use the extension? =

Any logged-in user with the `edit_posts` capability, and only for the objects that user could edit in wp-admin anyway.

= Are passwords stored? =

No. A login from the extension is exchanged for signed tokens. Failed logins from the same IP and username are throttled to 5 per 15 minutes. Login-security plugins that hook into `authenticate` keep working.

= Which ACF fields can be edited? =

Text, text area, WYSIWYG (as plain text), number, range, email, URL, password, select, radio, button group, true/false, image, color picker, oEmbed, link (URL format), date picker, date-time picker and time picker. Repeaters, groups, flexible content, galleries and relationship fields are shown read-only.

= How do I sign a lost device out? =

Edit your profile and check "Sign out the browser extension on all devices". Administrators can sign out every session under Settings → Sidebar Editor Bridge.

== Screenshots ==

1. Editing a page and its ACF fields from the Chrome side panel.
2. Date picker for an ACF date field.
3. Settings → Sidebar Editor Bridge.

== Changelog ==

= 1.0.0 =
* Split into classes and prepared for the plugin directory: translations, settings page, uninstall cleanup, WordPress Coding Standards.
* Security: per-object capability checks on the ACF and term SEO routes (previously `edit_posts` only); ACF writes are limited to editable field types and sanitized; Yoast meta and term SEO values are sanitized.
* Connections: tokens bound to the issuing site, revocable per user and site-wide, configurable lifetimes, login throttling, bearer tokens accepted only on REST requests.
* ACF date, date-time and time fields are returned as stored values (ISO) and validated on save, so the extension can show a date picker and a formatted date can no longer overwrite the stored value.
* The editor's capability list is no longer printed into the page.

= 0.7.0 =
* Raw ACF date values for the extension's date pickers.

== Upgrade Notice ==

= 1.0.0 =
Security hardening. Saved extension connections need to log in once more after the update.
