<?php
/**
 * Yoast SEO post meta in the REST API.
 *
 * Yoast doesn't consistently expose its SEO meta as writable REST fields
 * across versions. Registering the keys ourselves guarantees they appear in
 * the standard wp/v2 `meta` object (readable and writable) for every
 * REST-enabled post type.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Yoast post meta keys.
 */
final class Yoast {

	/**
	 * Meta key → sanitizer.
	 *
	 * @return array<string, callable>
	 */
	public static function fields() {
		return array(
			'_yoast_wpseo_title'     => 'sanitize_text_field',
			'_yoast_wpseo_metadesc'  => 'sanitize_textarea_field',
			'_yoast_wpseo_focuskw'   => 'sanitize_text_field',
			'_yoast_wpseo_canonical' => 'esc_url_raw',
		);
	}

	/**
	 * Hook in.
	 */
	public static function register() {
		add_action( 'init', array( __CLASS__, 'register_meta' ), 20 );
	}

	/**
	 * Register the meta keys.
	 */
	public static function register_meta() {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return;
		}
		foreach ( get_post_types( array( 'show_in_rest' => true ), 'names' ) as $post_type ) {
			foreach ( self::fields() as $key => $sanitize ) {
				register_post_meta(
					$post_type,
					$key,
					array(
						'show_in_rest'      => true,
						'single'            => true,
						'type'              => 'string',
						'sanitize_callback' => $sanitize,
						'auth_callback'     => static function ( $allowed, $meta_key, $object_id ) {
							return current_user_can( 'edit_post', (int) $object_id );
						},
					)
				);
			}
		}
	}
}
