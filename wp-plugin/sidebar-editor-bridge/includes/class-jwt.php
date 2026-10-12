<?php
/**
 * Minimal HS256 JWT.
 *
 * Hand-rolled on purpose: a single-purpose plugin shouldn't ship a vendor
 * directory. Signed with a key derived from the site's own
 * wp_salt( 'auth' ), so it is unique per install and rotates (revoking every
 * token) whenever the site's secret keys are regenerated.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge;

defined( 'ABSPATH' ) || exit;

/**
 * Encode / verify compact JWS tokens.
 */
final class Jwt {

	/**
	 * Signing key.
	 */
	private static function secret() {
		return hash_hmac( 'sha256', 'sidebar-editor-bridge-jwt', wp_salt( 'auth' ) );
	}

	/**
	 * Base64url encode.
	 *
	 * @param string $data Raw bytes.
	 */
	public static function base64url_encode( $data ) {
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- JWT encoding, not obfuscation.
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}

	/**
	 * Base64url decode.
	 *
	 * @param string $data Encoded string.
	 * @return string|false
	 */
	public static function base64url_decode( $data ) {
		$pad = strlen( $data ) % 4;
		if ( $pad ) {
			$data .= str_repeat( '=', 4 - $pad );
		}
		// phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- JWT decoding, not obfuscation.
		return base64_decode( strtr( $data, '-_', '+/' ), true );
	}

	/**
	 * Sign a payload.
	 *
	 * @param array<string, mixed> $payload Claims.
	 */
	public static function encode( array $payload ) {
		$segments      = array(
			self::base64url_encode(
				(string) wp_json_encode(
					array(
						'alg' => 'HS256',
						'typ' => 'JWT',
					)
				)
			),
			self::base64url_encode( (string) wp_json_encode( $payload ) ),
		);
		$signing_input = implode( '.', $segments );
		$segments[]    = self::base64url_encode( hash_hmac( 'sha256', $signing_input, self::secret(), true ) );
		return implode( '.', $segments );
	}

	/**
	 * Verify the signature and return the claims, or false.
	 * Expiry and claim checks are the caller's job (see Tokens).
	 *
	 * @param mixed $token Compact token.
	 * @return array<string, mixed>|false
	 */
	public static function decode( $token ) {
		if ( ! is_string( $token ) || substr_count( $token, '.' ) !== 2 ) {
			return false;
		}
		list( $header_b64, $payload_b64, $sig_b64 ) = explode( '.', $token );

		$header = json_decode( (string) self::base64url_decode( $header_b64 ), true );
		if ( ! is_array( $header ) || ( $header['alg'] ?? '' ) !== 'HS256' ) {
			return false; // Never accept "none" or another algorithm.
		}

		$expected = hash_hmac( 'sha256', $header_b64 . '.' . $payload_b64, self::secret(), true );
		$actual   = self::base64url_decode( $sig_b64 );
		if ( false === $actual || ! hash_equals( $expected, $actual ) ) {
			return false;
		}

		$payload = json_decode( (string) self::base64url_decode( $payload_b64 ), true );
		return is_array( $payload ) ? $payload : false;
	}
}
