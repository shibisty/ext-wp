<?php
/**
 * Plugin Name:       Sidebar Editor Bridge
 * Plugin URI:        https://github.com/shibisty/ext-wp
 * Description:       Companion plugin for the "WP Sidebar Editor" browser extension: edit posts, pages, terms, ACF, WooCommerce and Yoast fields from the browser side panel without opening wp-admin.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            shibisty
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       sidebar-editor-bridge
 * Domain Path:       /languages
 *
 * @package SidebarEditorBridge
 */

defined( 'ABSPATH' ) || exit;

define( 'SIDEBAR_EDITOR_BRIDGE_VERSION', '1.0.0' );
define( 'SIDEBAR_EDITOR_BRIDGE_FILE', __FILE__ );
define( 'SIDEBAR_EDITOR_BRIDGE_DIR', plugin_dir_path( __FILE__ ) );

require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-settings.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-jwt.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-tokens.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-rate-limiter.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-permissions.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-providers.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-acf-dates.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-auth.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-bridge-data.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/rest/class-auth-controller.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/rest/class-acf-controller.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/rest/class-term-seo-controller.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/rest/class-translation-controller.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/integrations/class-yoast.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/integrations/class-woocommerce.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/admin/class-settings-page.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/admin/class-user-profile.php';
require_once SIDEBAR_EDITOR_BRIDGE_DIR . 'includes/class-plugin.php';

SidebarEditorBridge\Plugin::boot();
