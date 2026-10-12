<?php
/**
 * Removes the plugin's options and user meta.
 * Transients (login throttling) expire on their own.
 *
 * @package SidebarEditorBridge
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'sidebar_editor_bridge_settings' );
delete_option( 'sidebar_editor_bridge_token_epoch' );
delete_metadata( 'user', 0, 'sidebar_editor_bridge_token_epoch', '', true );
