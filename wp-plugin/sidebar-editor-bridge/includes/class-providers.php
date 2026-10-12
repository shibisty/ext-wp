<?php
/**
 * Which integrations the panel should offer on this site.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * Plugin detection.
 */
final class Providers {

	/**
	 * Active integrations, by the ids the extension's providers use.
	 *
	 * @return string[]
	 */
	public static function detect() {
		$providers = array( 'core' );
		$checks    = array(
			'acf'         => class_exists( 'ACF' ),
			'woocommerce' => class_exists( 'WooCommerce' ),
			'yoast'       => defined( 'WPSEO_VERSION' ),
			'rankmath'    => class_exists( 'RankMath' ),
			'elementor'   => (bool) did_action( 'elementor/loaded' ),
			'wpml'        => class_exists( 'SitePress' ),
			'polylang'    => function_exists( 'pll_languages_list' ),
			'metabox'     => class_exists( 'RWMB_Loader' ),
			'pods'        => function_exists( 'pods' ),
		);
		foreach ( $checks as $id => $active ) {
			if ( $active ) {
				$providers[] = $id;
			}
		}

		/**
		 * Filters the integration ids reported to the browser extension.
		 *
		 * @param string[] $providers Provider ids.
		 */
		return (array) apply_filters( 'sidebar_editor_bridge_providers', $providers );
	}
}
