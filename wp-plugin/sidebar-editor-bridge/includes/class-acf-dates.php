<?php
/**
 * ACF date/time values between storage and the panel.
 *
 * ACF's get_field_objects() formats values with each field's return_format
 * ("21 Травня, 2026"), which the panel can neither put into a date picker
 * nor safely save back — update_field() would store that string verbatim
 * and break the field. The panel therefore gets the stored value as ISO,
 * and incoming values are normalized back to ACF's storage format:
 *   date_picker       "Ymd"          ↔ "2026-05-21"
 *   date_time_picker  "Y-m-d H:i:s"  ↔ "2026-05-21 10:00:00"
 *   time_picker       "H:i:s"        ↔ "10:00:00"
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * Pure conversion helpers (no WordPress calls — unit-testable).
 */
final class Acf_Dates {

	const TYPES = array( 'date_picker', 'date_time_picker', 'time_picker' );

	/**
	 * Is this an ACF date/time field type?
	 *
	 * @param string $type ACF field type.
	 */
	public static function is_date_type( $type ) {
		return in_array( $type, self::TYPES, true );
	}

	/**
	 * Stored value → ISO-ish string. Unknown shapes pass through unchanged
	 * (the panel then shows them read-only instead of guessing).
	 *
	 * @param string $type  ACF field type.
	 * @param mixed  $value Stored value.
	 */
	public static function to_iso( $type, $value ) {
		if ( null === $value || false === $value || '' === $value ) {
			return '';
		}
		$value = (string) $value;
		if ( 'date_picker' === $type && preg_match( '/^(\d{4})(\d{2})(\d{2})$/', $value, $m ) ) {
			return "{$m[1]}-{$m[2]}-{$m[3]}";
		}
		return $value;
	}

	/**
	 * Incoming value → storage format. Accepts both storage and ISO forms;
	 * returns null for anything that isn't a real date/time ("don't write").
	 *
	 * @param string $type  ACF field type.
	 * @param mixed  $value Incoming value.
	 * @return string|null
	 */
	public static function from_input( $type, $value ) {
		if ( null === $value || '' === $value ) {
			return '';
		}
		if ( ! is_scalar( $value ) ) {
			return null;
		}
		$value = trim( (string) $value, " \t\n\r\0\x0B" );

		if ( 'time_picker' === $type ) {
			if ( ! preg_match( '/^(\d{2}):(\d{2})(?::(\d{2}))?$/', $value, $m ) ) {
				return null;
			}
			return self::time( (int) $m[1], (int) $m[2], (int) ( $m[3] ?? 0 ) );
		}

		if ( ! preg_match( '/^(\d{4})-?(\d{2})-?(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/', $value, $m ) ) {
			return null;
		}
		if ( ! checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ) {
			return null;
		}
		if ( 'date_picker' === $type ) {
			return $m[1] . $m[2] . $m[3];
		}
		$time = self::time( (int) ( $m[4] ?? 0 ), (int) ( $m[5] ?? 0 ), (int) ( $m[6] ?? 0 ) );
		return null === $time ? null : "{$m[1]}-{$m[2]}-{$m[3]} {$time}";
	}

	/**
	 * Validated "H:i:s".
	 *
	 * @param int $h Hours.
	 * @param int $i Minutes.
	 * @param int $s Seconds.
	 * @return string|null
	 */
	private static function time( $h, $i, $s ) {
		if ( $h > 23 || $i > 59 || $s > 59 ) {
			return null;
		}
		return sprintf( '%02d:%02d:%02d', $h, $i, $s );
	}
}
