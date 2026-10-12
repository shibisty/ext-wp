<?php
/**
 * Plugin options with defaults and bounds.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * Read/sanitize the plugin settings option.
 */
final class Settings {

	const OPTION = 'sidebar_editor_bridge_settings';

	/** Bumping this option revokes every token issued so far (site-wide "sign out everywhere"). */
	const EPOCH_OPTION = 'sidebar_editor_bridge_token_epoch';

	/**
	 * Defaults.
	 *
	 * @return array{allow_connections: bool, access_ttl_minutes: int, refresh_ttl_days: int}
	 */
	public static function defaults() {
		return array(
			'allow_connections'  => true,
			'access_ttl_minutes' => 60,
			'refresh_ttl_days'   => 30,
		);
	}

	/**
	 * Current settings merged over defaults.
	 *
	 * @return array{allow_connections: bool, access_ttl_minutes: int, refresh_ttl_days: int}
	 */
	public static function all() {
		$stored = get_option( self::OPTION, array() );
		return self::sanitize( is_array( $stored ) ? $stored : array() );
	}

	/**
	 * Sanitize callback for register_setting() — also used on read.
	 *
	 * @param mixed $input Raw value.
	 * @return array{allow_connections: bool, access_ttl_minutes: int, refresh_ttl_days: int}
	 */
	public static function sanitize( $input ) {
		$input    = is_array( $input ) ? $input : array();
		$defaults = self::defaults();
		return array(
			'allow_connections'  => isset( $input['allow_connections'] ) ? (bool) $input['allow_connections'] : $defaults['allow_connections'],
			'access_ttl_minutes' => self::clamp( $input['access_ttl_minutes'] ?? $defaults['access_ttl_minutes'], 5, 1440 ),
			'refresh_ttl_days'   => self::clamp( $input['refresh_ttl_days'] ?? $defaults['refresh_ttl_days'], 1, 365 ),
		);
	}

	/**
	 * Whether bearer-token "connections" (login from the extension without an open tab) are enabled.
	 */
	public static function connections_enabled() {
		return (bool) self::all()['allow_connections'];
	}

	/**
	 * Access token lifetime in seconds.
	 */
	public static function access_ttl() {
		return self::all()['access_ttl_minutes'] * MINUTE_IN_SECONDS;
	}

	/**
	 * Refresh token lifetime in seconds.
	 */
	public static function refresh_ttl() {
		return self::all()['refresh_ttl_days'] * DAY_IN_SECONDS;
	}

	/**
	 * Site-wide token epoch.
	 */
	public static function token_epoch() {
		return (int) get_option( self::EPOCH_OPTION, 0 );
	}

	/**
	 * Invalidate every token issued so far.
	 */
	public static function bump_token_epoch() {
		update_option( self::EPOCH_OPTION, self::token_epoch() + 1, false );
	}

	/**
	 * Clamp a numeric value into [min, max].
	 *
	 * @param mixed $value Value.
	 * @param int   $min   Lower bound.
	 * @param int   $max   Upper bound.
	 */
	private static function clamp( $value, $min, $max ) {
		return max( $min, min( $max, absint( $value ) ) );
	}
}
