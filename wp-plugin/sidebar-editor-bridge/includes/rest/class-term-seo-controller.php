<?php
/**
 * Yoast SEO for taxonomy terms.
 *
 * Term SEO isn't term meta: Yoast keeps it in one option,
 * wpseo_taxonomy_meta[ taxonomy ][ term_id ], so register_term_meta() can't
 * expose it — hence this small dedicated route.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Rest;

use SidebarEditorBridge\Permissions;
use SidebarEditorBridge\Plugin;
use WP_Error;
use WP_REST_Request;

defined( 'ABSPATH' ) || exit;

/**
 * /term-seo/<taxonomy>/<term_id>.
 */
final class Term_Seo_Controller {

	const OPTION = 'wpseo_taxonomy_meta';

	/**
	 * Field → sanitizer.
	 *
	 * @return array<string, callable>
	 */
	private static function fields() {
		return array(
			'wpseo_title'     => 'sanitize_text_field',
			'wpseo_desc'      => 'sanitize_textarea_field',
			'wpseo_focuskw'   => 'sanitize_text_field',
			'wpseo_canonical' => 'esc_url_raw',
		);
	}

	/**
	 * Register routes.
	 */
	public function register_routes() {
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/term-seo/(?P<taxonomy>[a-zA-Z0-9_-]+)/(?P<term_id>\d+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_item' ),
					'permission_callback' => array( Permissions::class, 'rest_can_edit_term' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'update_item' ),
					'permission_callback' => array( Permissions::class, 'rest_can_edit_term' ),
				),
			)
		);
	}

	/**
	 * Yoast must be active.
	 */
	private function no_yoast() {
		return new WP_Error( 'seb_no_yoast', __( 'Yoast SEO is not active.', 'sidebar-editor-bridge' ), array( 'status' => 404 ) );
	}

	/**
	 * GET.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, string>|WP_Error
	 */
	public function get_item( WP_REST_Request $request ) {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return $this->no_yoast();
		}
		$all    = get_option( self::OPTION, array() );
		$values = $all[ $request['taxonomy'] ][ (int) $request['term_id'] ] ?? array();
		$out    = array();
		foreach ( array_keys( self::fields() ) as $key ) {
			$out[ $key ] = isset( $values[ $key ] ) ? (string) $values[ $key ] : '';
		}
		return $out;
	}

	/**
	 * POST.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, bool>|WP_Error
	 */
	public function update_item( WP_REST_Request $request ) {
		if ( ! defined( 'WPSEO_VERSION' ) ) {
			return $this->no_yoast();
		}
		$taxonomy = (string) $request['taxonomy'];
		$term_id  = (int) $request['term_id'];
		$body     = (array) $request->get_json_params();
		$all      = get_option( self::OPTION, array() );
		$all      = is_array( $all ) ? $all : array();

		foreach ( self::fields() as $key => $sanitize ) {
			if ( isset( $body[ $key ] ) && is_scalar( $body[ $key ] ) ) {
				$all[ $taxonomy ][ $term_id ][ $key ] = call_user_func( $sanitize, (string) $body[ $key ] );
			}
		}
		update_option( self::OPTION, $all );
		return array( 'ok' => true );
	}
}
