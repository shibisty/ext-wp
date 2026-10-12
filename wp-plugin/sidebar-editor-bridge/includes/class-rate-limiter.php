<?php
/**
 * Failed-login throttle for the token login route.
 *
 * The login route calls wp_authenticate(), which runs the regular
 * `authenticate` filters, so dedicated login-security plugins still apply;
 * this is a baseline for sites without one, keyed by IP + username (hashed,
 * nothing personal is stored in clear).
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * Transient-backed counter.
 */
final class Rate_Limiter {

	const MAX_FAILURES = 5;
	const WINDOW       = 15 * MINUTE_IN_SECONDS;

	/**
	 * Transient key for an IP + username pair.
	 *
	 * @param string $ip       Client IP.
	 * @param string $username Username.
	 */
	private static function key( $ip, $username ) {
		return 'sidebar_editor_bridge_login_' . substr( hash_hmac( 'sha256', $ip . '|' . strtolower( $username ), wp_salt( 'nonce' ) ), 0, 32 );
	}

	/**
	 * Client IP as seen by PHP (proxies' forwarded headers are deliberately not trusted).
	 */
	public static function client_ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		return (string) filter_var( $ip, FILTER_VALIDATE_IP );
	}

	/**
	 * Whether this pair is currently locked out.
	 *
	 * @param string $ip       Client IP.
	 * @param string $username Username.
	 */
	public static function is_locked( $ip, $username ) {
		return (int) get_transient( self::key( $ip, $username ) ) >= self::MAX_FAILURES;
	}

	/**
	 * Count a failure.
	 *
	 * @param string $ip       Client IP.
	 * @param string $username Username.
	 */
	public static function fail( $ip, $username ) {
		$key = self::key( $ip, $username );
		set_transient( $key, (int) get_transient( $key ) + 1, self::WINDOW );
	}

	/**
	 * Reset after a successful login.
	 *
	 * @param string $ip       Client IP.
	 * @param string $username Username.
	 */
	public static function reset( $ip, $username ) {
		delete_transient( self::key( $ip, $username ) );
	}
}
