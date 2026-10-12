<?php
/**
 * Wires every component to WordPress hooks.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

use SidebarEditorBridge\Admin\Settings_Page;
use SidebarEditorBridge\Admin\User_Profile;
use SidebarEditorBridge\Integrations\WooCommerce;
use SidebarEditorBridge\Integrations\Yoast;
use SidebarEditorBridge\Rest\Acf_Controller;
use SidebarEditorBridge\Rest\Auth_Controller;
use SidebarEditorBridge\Rest\Term_Seo_Controller;
use SidebarEditorBridge\Rest\Translation_Controller;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin bootstrap.
 */
final class Plugin {

	/** REST namespace shared with the browser extension. */
	const REST_NAMESPACE = 'sidebar-editor/v1';

	/**
	 * Register all hooks. Called once from the main plugin file.
	 */
	public static function boot() {
		Auth::register();
		Bridge_Data::register();
		Yoast::register();
		WooCommerce::register();

		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );

		if ( is_admin() ) {
			Settings_Page::register();
			User_Profile::register();
			add_filter( 'plugin_action_links_' . plugin_basename( SIDEBAR_EDITOR_BRIDGE_FILE ), array( __CLASS__, 'action_links' ) );
		}
	}

	/**
	 * REST routes.
	 */
	public static function register_routes() {
		( new Auth_Controller() )->register_routes();
		( new Acf_Controller() )->register_routes();
		( new Term_Seo_Controller() )->register_routes();
		( new Translation_Controller() )->register_routes();

		// Manual sanity check: a 200 here only proves the plugin is active,
		// NOT that a given request is authenticated.
		register_rest_route(
			self::REST_NAMESPACE,
			'/ping',
			array(
				'methods'             => 'GET',
				'callback'            => static function () {
					return array(
						'ok'      => true,
						'version' => SIDEBAR_EDITOR_BRIDGE_VERSION,
					);
				},
				'permission_callback' => '__return_true',
			)
		);
	}

	/**
	 * "Settings" link on the Plugins screen.
	 *
	 * @param string[] $links Existing links.
	 * @return string[]
	 */
	public static function action_links( $links ) {
		$url = admin_url( 'options-general.php?page=' . Settings_Page::SLUG );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'sidebar-editor-bridge' ) . '</a>' );
		return $links;
	}
}
