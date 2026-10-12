<?php
/**
 * Prints the editing context for the extension into pages viewed by editors.
 *
 * WordPress' REST cookie auth (rest_cookie_check_errors) silently treats a
 * cookie-authenticated REST request WITHOUT a valid X-WP-Nonce as anonymous,
 * so "ask REST for a nonce" is circular. PHP already knows the logged-in
 * user while rendering the page, so the context + nonce are printed into the
 * page as JSON and the extension reads them from the DOM.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

use WP_Term;

defined( 'ABSPATH' ) || exit;

/**
 * `<script id="seb-bridge-data" type="application/json">`.
 */
final class Bridge_Data {

	/**
	 * Hook in.
	 */
	public static function register() {
		add_action( 'wp_footer', array( __CLASS__, 'print_data' ), 1 );
		add_action( 'admin_footer', array( __CLASS__, 'print_data' ), 1 );
	}

	/**
	 * Output the JSON tag (only for users who can edit content).
	 */
	public static function print_data() {
		if ( ! is_user_logged_in() || ! Permissions::can_use_panel() ) {
			return; // The extension sees no tag → "not logged in".
		}
		$json = wp_json_encode( self::collect(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES );
		if ( false === $json ) {
			return;
		}
		wp_print_inline_script_tag(
			$json,
			array(
				'id'   => 'seb-bridge-data',
				'type' => 'application/json',
			)
		);
	}

	/**
	 * Everything the panel needs to know about the current view.
	 *
	 * @return array<string, mixed>
	 */
	public static function collect() {
		$user    = wp_get_current_user();
		$post    = null;
		$term    = null;
		$edit    = null;
		$queried = get_queried_object();

		if ( ( is_category() || is_tag() || is_tax() ) && $queried instanceof WP_Term ) {
			$tax_obj = get_taxonomy( $queried->taxonomy );
			if ( $tax_obj && ! empty( $tax_obj->show_in_rest ) && current_user_can( 'edit_term', $queried->term_id ) ) {
				$term = array(
					'id'       => $queried->term_id,
					'taxonomy' => $queried->taxonomy,
					'restBase' => ! empty( $tax_obj->rest_base ) ? $tax_obj->rest_base : $tax_obj->name,
				);
				$link = get_edit_term_link( $queried->term_id, $queried->taxonomy );
				$edit = is_string( $link ) ? $link : null;
			}
		} elseif ( is_singular() ) {
			// Also covers a static front page (is_front_page() is true too — both are editable together).
			$post_id   = get_queried_object_id();
			$post_type = $post_id ? get_post_type( $post_id ) : null;
			$pt_obj    = $post_type ? get_post_type_object( $post_type ) : null;
			if ( $pt_obj && ! empty( $pt_obj->show_in_rest ) && current_user_can( 'edit_post', $post_id ) ) {
				$post = array(
					'id'       => $post_id,
					'type'     => $post_type,
					'restBase' => ! empty( $pt_obj->rest_base ) ? $pt_obj->rest_base : $pt_obj->name,
				);
				$edit = get_edit_post_link( $post_id, 'raw' );
			}
		}

		$is_front = (bool) is_front_page();
		if ( ! $edit && $is_front && current_user_can( 'manage_options' ) ) {
			$edit = admin_url( 'options-reading.php' );
		}

		return array(
			'authenticated' => true,
			'version'       => SIDEBAR_EDITOR_BRIDGE_VERSION,
			'user'          => array(
				'id'   => $user->ID,
				'name' => $user->display_name,
			),
			'restRoot'      => esc_url_raw( get_rest_url() ),
			'nonce'         => wp_create_nonce( 'wp_rest' ),
			'isFrontPage'   => $is_front,
			'post'          => $post,
			'term'          => $term,
			'languages'     => $post ? self::polylang_languages( (int) $post['id'] ) : null,
			'providers'     => Providers::detect(),
			'editUrl'       => $edit,
		);
	}

	/**
	 * Polylang translations of a post (only with 2+ languages).
	 *
	 * @param int $post_id Post ID.
	 * @return array<int, array<string, mixed>>|null
	 */
	private static function polylang_languages( $post_id ) {
		if ( ! function_exists( 'pll_languages_list' ) ) {
			return null;
		}
		$slugs = pll_languages_list();
		if ( ! is_array( $slugs ) || count( $slugs ) < 2 ) {
			return null;
		}
		$current      = function_exists( 'pll_get_post_language' ) ? pll_get_post_language( $post_id ) : null;
		$translations = function_exists( 'pll_get_post_translations' ) ? pll_get_post_translations( $post_id ) : array();
		$languages    = array();
		foreach ( $slugs as $slug ) {
			$languages[] = array(
				'slug'    => $slug,
				'name'    => function_exists( 'pll_get_language' ) ? pll_get_language( $slug, 'name' ) : $slug,
				'postId'  => isset( $translations[ $slug ] ) ? (int) $translations[ $slug ] : null,
				'current' => $slug === $current,
			);
		}
		return $languages;
	}
}
