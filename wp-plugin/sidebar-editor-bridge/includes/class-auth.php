<?php
/**
 * Bearer-token authentication for REST requests from the extension.
 *
 * Cookie + nonce auth only works while the site is open in a browser tab.
 * "Connections" let the extension keep editing without one: a short-lived
 * access token for requests, a longer-lived refresh token to mint new ones.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * `determine_current_user` integration.
 */
final class Auth {

	/**
	 * Hook in.
	 */
	public static function register() {
		add_filter( 'determine_current_user', array( __CLASS__, 'determine_current_user' ), 20 );
	}

	/**
	 * Resolve the user from `Authorization: Bearer …` on REST requests.
	 * Anything else (no header, other schemes, non-REST requests, invalid or
	 * revoked tokens) leaves whatever earlier auth decided untouched.
	 *
	 * @param int|false $user_id User ID determined so far.
	 * @return int|false
	 */
	public static function determine_current_user( $user_id ) {
		if ( ! Settings::connections_enabled() || ! self::is_rest_request() ) {
			return $user_id;
		}
		$token = self::bearer_token();
		if ( null === $token ) {
			return $user_id;
		}
		$user = Tokens::validate( $token, 'access' );
		return $user ? $user->ID : $user_id;
	}

	/**
	 * Whether the current request targets the REST API.
	 * `REST_REQUEST` isn't defined yet when determine_current_user first runs.
	 */
	public static function is_rest_request() {
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return true;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- only checks which endpoint is requested.
		if ( isset( $_GET['rest_route'] ) ) {
			return true;
		}
		$uri = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		return false !== strpos( $uri, '/' . rest_get_url_prefix() . '/' );
	}

	/**
	 * The bearer token from the Authorization header, if any.
	 */
	public static function bearer_token() {
		$header = self::authorization_header();
		if ( ! $header || 0 !== stripos( $header, 'Bearer ' ) ) {
			return null;
		}
		$token = trim( substr( $header, 7 ), " \t\n\r\0\x0B" );
		return '' === $token ? null : $token;
	}

	/**
	 * Apache (mod_php and several FastCGI setups) commonly does NOT pass the
	 * Authorization header to PHP unless the server config says so
	 * (CGIPassAuth, a rewrite rule, …). apache_request_headers() /
	 * getallheaders() read the actual incoming headers when the $_SERVER
	 * keys come up empty.
	 */
	private static function authorization_header() {
		foreach ( array( 'HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION' ) as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- opaque credential, verified cryptographically.
				return (string) wp_unslash( $_SERVER[ $key ] );
			}
		}
		$headers = array();
		if ( function_exists( 'apache_request_headers' ) ) {
			$headers = apache_request_headers();
		} elseif ( function_exists( 'getallheaders' ) ) {
			$headers = getallheaders();
		}
		foreach ( (array) $headers as $key => $value ) {
			if ( 'authorization' === strtolower( (string) $key ) ) {
				return (string) $value;
			}
		}
		return null;
	}
}
