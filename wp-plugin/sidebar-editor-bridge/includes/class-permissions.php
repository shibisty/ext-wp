<?php
/**
 * Per-object capability checks — the same ones wp-admin performs.
 *
 * A blanket current_user_can( 'edit_posts' ) would let any contributor read
 * and write ACF fields / term SEO of content they can't edit in wp-admin
 * (other authors' posts, published posts, option pages, user profiles).
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

use WP_REST_Request;

defined( 'ABSPATH' ) || exit;

/**
 * Capability helpers and REST permission callbacks.
 */
final class Permissions {

	/**
	 * Logged-in user who may edit content at all.
	 */
	public static function can_use_panel() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * ACF object reference: numeric post ID or ACF's "term_<id>" convention.
	 * Anything else ("option", "user_1", "comment_2", …) is refused —
	 * the panel doesn't edit those.
	 *
	 * @param mixed $ref Reference.
	 */
	public static function can_edit_acf_ref( $ref ) {
		$ref = (string) $ref;
		if ( ctype_digit( $ref ) ) {
			return current_user_can( 'edit_post', (int) $ref );
		}
		if ( preg_match( '/^term_(\d+)$/', $ref, $m ) ) {
			return current_user_can( 'edit_term', (int) $m[1] );
		}
		return false;
	}

	/**
	 * REST: ACF route.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function rest_can_edit_acf_ref( WP_REST_Request $request ) {
		return self::can_edit_acf_ref( $request['ref'] );
	}

	/**
	 * REST: term SEO route.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function rest_can_edit_term( WP_REST_Request $request ) {
		$term = get_term( (int) $request['term_id'], (string) $request['taxonomy'] );
		if ( ! $term || is_wp_error( $term ) ) {
			return false;
		}
		return current_user_can( 'edit_term', $term->term_id );
	}
}
