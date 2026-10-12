<?php
/**
 * WooCommerce attribute taxonomies in the REST API.
 *
 * Attribute taxonomies (pa_color, pa_size, …) are registered without
 * show_in_rest, so they get no wp/v2 terms route. Turning REST support on
 * after WooCommerce registers them lets the generic term providers
 * (core / ACF / Yoast) work on attribute archive pages too.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Enable REST for attribute taxonomies.
 */
final class WooCommerce {

	/**
	 * Hook in.
	 */
	public static function register() {
		add_action( 'init', array( __CLASS__, 'enable_rest' ), 100 );
	}

	/**
	 * Patch the registered taxonomy objects after WooCommerce created them
	 * (its per-taxonomy args filter is named after each attribute, so it
	 * can't be hooked generically before the attributes are known).
	 */
	public static function enable_rest() {
		if ( ! function_exists( 'wc_get_attribute_taxonomies' ) || ! function_exists( 'wc_attribute_taxonomy_name' ) ) {
			return;
		}
		foreach ( (array) wc_get_attribute_taxonomies() as $attribute ) {
			$tax = get_taxonomy( wc_attribute_taxonomy_name( $attribute->attribute_name ) );
			if ( $tax && empty( $tax->show_in_rest ) ) {
				$tax->show_in_rest          = true;
				$tax->rest_base             = $tax->name;
				$tax->rest_controller_class = 'WP_REST_Terms_Controller';
			}
		}
	}
}
