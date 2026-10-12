<?php
/**
 * Create a linked Polylang translation draft.
 *
 * Polylang's REST support doesn't expose "create a linked translation", so
 * this wires pll_set_post_language() + pll_save_post_translations() together.
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
 * POST /create-translation.
 */
final class Translation_Controller {

	/**
	 * Register routes.
	 */
	public function register_routes() {
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/create-translation',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'create_item' ),
				'permission_callback' => array( Permissions::class, 'can_use_panel' ),
				'args'                => array(
					'sourcePostId' => array(
						'type'     => 'integer',
						'required' => true,
					),
					'lang'         => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
	}

	/**
	 * Create the draft and link it into the translation group.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>|WP_Error
	 */
	public function create_item( WP_REST_Request $request ) {
		foreach ( array( 'pll_set_post_language', 'pll_save_post_translations', 'pll_get_post_translations', 'pll_get_post_language', 'pll_languages_list' ) as $fn ) {
			if ( ! function_exists( $fn ) ) {
				return new WP_Error( 'seb_no_polylang', __( 'Polylang is not active.', 'sidebar-editor-bridge' ), array( 'status' => 404 ) );
			}
		}

		$source_id   = (int) $request['sourcePostId'];
		$target_lang = sanitize_key( (string) $request['lang'] );
		$source      = get_post( $source_id );
		if ( ! $source ) {
			return new WP_Error( 'seb_not_found', __( 'Source post not found.', 'sidebar-editor-bridge' ), array( 'status' => 404 ) );
		}
		if ( ! in_array( $target_lang, (array) pll_languages_list(), true ) ) {
			return new WP_Error( 'seb_bad_language', __( 'Unknown language.', 'sidebar-editor-bridge' ), array( 'status' => 400 ) );
		}
		$pt_obj = get_post_type_object( $source->post_type );
		if ( ! $pt_obj || ! current_user_can( 'edit_post', $source_id ) || ! current_user_can( $pt_obj->cap->create_posts ) ) {
			return new WP_Error( 'seb_forbidden', __( 'You are not allowed to translate this item.', 'sidebar-editor-bridge' ), array( 'status' => 403 ) );
		}

		$translations = (array) pll_get_post_translations( $source_id );
		if ( ! empty( $translations[ $target_lang ] ) ) {
			return new WP_Error( 'seb_exists', __( 'A translation for this language already exists.', 'sidebar-editor-bridge' ), array( 'status' => 409 ) );
		}

		$new_id = wp_insert_post(
			array(
				'post_type'   => $source->post_type,
				'post_status' => 'draft',
				'post_title'  => $source->post_title, // Starting point — translate it in the panel.
			),
			true
		);
		if ( is_wp_error( $new_id ) ) {
			return $new_id;
		}

		pll_set_post_language( $new_id, $target_lang );

		// pll_save_post_translations() expects the complete lang => post_id map.
		$source_lang = pll_get_post_language( $source_id );
		if ( $source_lang && empty( $translations[ $source_lang ] ) ) {
			$translations[ $source_lang ] = $source_id;
		}
		$translations[ $target_lang ] = $new_id;
		pll_save_post_translations( $translations );

		return array(
			'id'       => $new_id,
			'restBase' => ! empty( $pt_obj->show_in_rest ) ? ( $pt_obj->rest_base ? $pt_obj->rest_base : $pt_obj->name ) : null,
		);
	}
}
