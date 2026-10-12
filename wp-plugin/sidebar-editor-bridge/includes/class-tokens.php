<?php
/**
 * Access + refresh token pair for the extension's "connections".
 *
 * A token is only accepted when ALL of these still hold:
 *  - signature valid (site secret keys unchanged);
 *  - not expired, right type (access vs refresh);
 *  - issued by this site (`iss`) — on multisite all sites share the salts
 *    and users, so this keeps a token from site A out of site B;
 *  - site-wide epoch unchanged ("revoke all" on the settings page);
 *  - the user's own epoch unchanged ("sign out everywhere" on the profile);
 *  - refresh only: password unchanged since issue (`pwh`).
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Issue and validate tokens.
 */
final class Tokens {

	const USER_EPOCH_META = 'sidebar_editor_bridge_token_epoch';

	/**
	 * Per-user epoch.
	 *
	 * @param int $user_id User ID.
	 */
	public static function user_epoch( $user_id ) {
		return (int) get_user_meta( $user_id, self::USER_EPOCH_META, true );
	}

	/**
	 * Revoke every token of one user.
	 *
	 * @param int $user_id User ID.
	 */
	public static function revoke_user( $user_id ) {
		update_user_meta( $user_id, self::USER_EPOCH_META, self::user_epoch( $user_id ) + 1 );
	}

	/**
	 * Combined epoch string baked into each token.
	 *
	 * @param int $user_id User ID.
	 */
	private static function epoch( $user_id ) {
		return Settings::token_epoch() . '.' . self::user_epoch( $user_id );
	}

	/**
	 * Fingerprint of the current password hash (keyed, so it reveals nothing about the hash).
	 *
	 * @param WP_User $user User.
	 */
	private static function password_fingerprint( WP_User $user ) {
		return substr( hash_hmac( 'sha256', $user->user_pass, wp_salt( 'auth' ) ), 0, 16 );
	}

	/**
	 * Token issuer — this site.
	 */
	private static function issuer() {
		return home_url( '/' );
	}

	/**
	 * Mint a fresh pair plus everything the extension stores about the connection.
	 *
	 * @param WP_User $user User.
	 * @return array<string, mixed>
	 */
	public static function issue( WP_User $user ) {
		$now        = time();
		$access_ttl = Settings::access_ttl();
		$common     = array(
			'uid' => $user->ID,
			'iss' => self::issuer(),
			'iat' => $now,
			'ep'  => self::epoch( $user->ID ),
		);
		return array(
			'accessToken'  => Jwt::encode(
				$common + array(
					'typ' => 'access',
					'exp' => $now + $access_ttl,
				)
			),
			'refreshToken' => Jwt::encode(
				$common + array(
					'typ' => 'refresh',
					'exp' => $now + Settings::refresh_ttl(),
					'pwh' => self::password_fingerprint( $user ),
				)
			),
			'expiresIn'    => $access_ttl,
			'user'         => array(
				'id'    => $user->ID,
				'name'  => $user->display_name,
				'login' => $user->user_login,
			),
			'site'         => array(
				'url'      => get_site_url(),
				'restRoot' => esc_url_raw( get_rest_url() ),
			),
			'providers'    => Providers::detect(),
		);
	}

	/**
	 * Validate a token of the given type and return its user, or null.
	 *
	 * @param mixed  $token Compact JWT.
	 * @param string $type  'access' or 'refresh'.
	 * @return WP_User|null
	 */
	public static function validate( $token, $type ) {
		$claims = Jwt::decode( $token );
		if ( ! $claims || ( $claims['typ'] ?? '' ) !== $type ) {
			return null;
		}
		if ( empty( $claims['exp'] ) || time() > (int) $claims['exp'] ) {
			return null;
		}
		if ( ( $claims['iss'] ?? '' ) !== self::issuer() ) {
			return null;
		}
		$user = get_user_by( 'id', (int) ( $claims['uid'] ?? 0 ) );
		if ( ! $user instanceof WP_User ) {
			return null;
		}
		if ( ( $claims['ep'] ?? '' ) !== self::epoch( $user->ID ) ) {
			return null;
		}
		if ( 'refresh' === $type && ! hash_equals( self::password_fingerprint( $user ), (string) ( $claims['pwh'] ?? '' ) ) ) {
			return null;
		}
		return $user;
	}
}
