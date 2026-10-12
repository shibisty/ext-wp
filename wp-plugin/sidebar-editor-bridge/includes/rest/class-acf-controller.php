<?php
/**
 * ACF fields via ACF's PHP API.
 *
 * ACF only exposes fields to wp/v2 when "Show in REST API" is enabled per
 * field group — an easy-to-miss manual step that results in a silently empty
 * `acf` key. get_field_objects() / update_field() work regardless, and give
 * each field's label and type so the panel can render proper controls.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Rest;

use SidebarEditorBridge\Acf_Dates;
use SidebarEditorBridge\Permissions;
use SidebarEditorBridge\Plugin;
use WP_Error;
use WP_REST_Request;

defined( 'ABSPATH' ) || exit;

/**
 * /acf/<ref> — ref is a numeric post ID or ACF's "term_<id>".
 */
final class Acf_Controller {

	/**
	 * Field types the panel may write. Everything else (repeater, group,
	 * flexible_content, gallery, relationship, …) is displayed read-only by
	 * the extension and refused here, so no arbitrary structures get written.
	 */
	const WRITABLE_TYPES = array(
		'text',
		'textarea',
		'wysiwyg',
		'number',
		'range',
		'email',
		'url',
		'password',
		'select',
		'radio',
		'button_group',
		'true_false',
		'image',
		'color_picker',
		'oembed',
		'link',
		'date_picker',
		'date_time_picker',
		'time_picker',
	);

	/** Types whose string values get wp_kses_post() for users without unfiltered_html. */
	const HTML_TYPES = array( 'text', 'textarea', 'wysiwyg' );

	/**
	 * Register routes.
	 */
	public function register_routes() {
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/acf/(?P<ref>[a-zA-Z0-9_]+)',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_items' ),
					'permission_callback' => array( Permissions::class, 'rest_can_edit_acf_ref' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'update_items' ),
					'permission_callback' => array( Permissions::class, 'rest_can_edit_acf_ref' ),
				),
			)
		);
	}

	/**
	 * ACF's own ID resolution is pickier than documented in some versions —
	 * a numeric ref works far more reliably as an int than as a string.
	 *
	 * @param string $ref Route param.
	 * @return int|string
	 */
	private static function object_id( $ref ) {
		return ctype_digit( (string) $ref ) ? (int) $ref : (string) $ref;
	}

	/**
	 * ACF must be active.
	 */
	private function no_acf() {
		return new WP_Error( 'seb_no_acf', __( 'ACF is not active.', 'sidebar-editor-bridge' ), array( 'status' => 404 ) );
	}

	/**
	 * GET — field list with labels, types and values.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<int, array<string, mixed>>|WP_Error
	 */
	public function get_items( WP_REST_Request $request ) {
		if ( ! function_exists( 'get_field_objects' ) ) {
			return $this->no_acf();
		}
		$object_id = self::object_id( $request['ref'] );
		$fields    = get_field_objects( $object_id, true, true, false );

		if ( ! $fields && function_exists( 'acf_get_field_groups' ) && function_exists( 'acf_get_fields' ) ) {
			// get_field_objects() can come back empty for reasons unrelated to
			// "no fields assigned" (value-loading edge cases in some ACF
			// builds) — go through the field groups directly instead.
			$fields = array();
			foreach ( (array) acf_get_field_groups( array( 'post_id' => $object_id ) ) as $group ) {
				foreach ( (array) acf_get_fields( $group ) as $f ) {
					$fields[ $f['name'] ] = array_merge( $f, array( 'value' => get_field( $f['name'], $object_id ) ) );
				}
			}
		}

		$out = array();
		foreach ( (array) $fields as $field ) {
			$item = array(
				'key'     => $field['key'],
				'name'    => $field['name'],
				'label'   => $field['label'],
				'type'    => $field['type'],
				'value'   => $field['value'],
				'choices' => $field['choices'] ?? null,
			);
			if ( Acf_Dates::is_date_type( $field['type'] ) ) {
				// Raw stored value as ISO — see Acf_Dates for why.
				$item['value']          = Acf_Dates::to_iso( $field['type'], get_field( $field['key'], $object_id, false ) );
				$item['raw']            = true;
				$item['display_format'] = $field['display_format'] ?? null;
			}
			$out[] = $item;
		}
		return $out;
	}

	/**
	 * POST — { fieldKey: value, … }. Unknown, non-writable or invalid values
	 * are skipped (and reported) instead of written.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>|WP_Error
	 */
	public function update_items( WP_REST_Request $request ) {
		if ( ! function_exists( 'update_field' ) || ! function_exists( 'acf_get_field' ) ) {
			return $this->no_acf();
		}
		$object_id = self::object_id( $request['ref'] );
		$body      = $request->get_json_params();
		$body      = is_array( $body ) ? $body : array();
		$skipped   = array();
		$updated   = array();

		foreach ( $body as $key => $value ) {
			$key   = sanitize_text_field( (string) $key );
			$field = acf_get_field( $key );
			if ( ! $field || ! in_array( $field['type'], self::WRITABLE_TYPES, true ) ) {
				$skipped[] = $key;
				continue;
			}
			$value = $this->prepare_value( $field, $value );
			if ( null === $value ) {
				$skipped[] = $key;
				continue;
			}
			update_field( $field['key'], $value, $object_id );
			$updated[] = $key;
		}

		return array(
			'ok'      => true,
			'updated' => $updated,
			'skipped' => $skipped,
		);
	}

	/**
	 * Validate/sanitize one incoming value. null = don't write.
	 *
	 * @param array<string, mixed> $field ACF field.
	 * @param mixed                $value Incoming value.
	 * @return mixed
	 */
	private function prepare_value( array $field, $value ) {
		$type = $field['type'];

		if ( Acf_Dates::is_date_type( $type ) ) {
			return Acf_Dates::from_input( $type, $value );
		}
		if ( 'link' === $type ) {
			// Only the "URL" return format is edited as a plain string.
			return is_string( $value ) ? esc_url_raw( $value ) : null;
		}
		if ( ! is_scalar( $value ) && null !== $value ) {
			return null; // Only scalar values are produced by the panel.
		}
		$value = (string) $value;

		if ( in_array( $type, array( 'select', 'radio', 'button_group' ), true ) ) {
			$choices      = is_array( $field['choices'] ?? null ) ? array_map( 'strval', array_keys( $field['choices'] ) ) : array();
			$allows_empty = ! empty( $field['allow_null'] ) || 'radio' !== $type;
			if ( '' === $value ) {
				return $allows_empty ? '' : null;
			}
			return in_array( $value, $choices, true ) ? $value : null;
		}
		if ( 'true_false' === $type ) {
			return '' === $value || '0' === $value ? 0 : 1;
		}
		if ( 'image' === $type ) {
			return '' === $value ? '' : absint( $value );
		}
		if ( 'email' === $type ) {
			return sanitize_email( $value );
		}
		if ( in_array( $type, array( 'url', 'oembed' ), true ) ) {
			return esc_url_raw( $value );
		}
		if ( in_array( $type, array( 'number', 'range' ), true ) ) {
			return '' === $value || is_numeric( $value ) ? $value : null;
		}
		if ( in_array( $type, self::HTML_TYPES, true ) && ! current_user_can( 'unfiltered_html' ) ) {
			return wp_kses_post( $value );
		}
		return $value;
	}
}
