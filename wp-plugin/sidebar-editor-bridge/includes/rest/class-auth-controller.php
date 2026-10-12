<?php
/**
 * /auth/login, /auth/refresh, /auth/session.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Rest;

use SidebarEditorBridge\Permissions;
use SidebarEditorBridge\Plugin;
use SidebarEditorBridge\Rate_Limiter;
use SidebarEditorBridge\Settings;
use SidebarEditorBridge\Tokens;
use WP_Error;
use WP_REST_Request;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Token endpoints for the extension's "connections".
 */
final class Auth_Controller {

	/**
	 * Register routes.
	 */
	public function register_routes() {
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/auth/login',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'login' ),
				'permission_callback' => '__return_true', // Checks the password itself.
				'args'                => array(
					'username' => array(
						'type'     => 'string',
						'required' => true,
					),
					'password' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/auth/refresh',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'refresh' ),
				'permission_callback' => '__return_true', // Checks the refresh token itself.
				'args'                => array(
					'refreshToken' => array(
						'type'     => 'string',
						'required' => true,
					),
				),
			)
		);
		// Cookie + nonce protected: lets the extension quietly mint/refresh a
		// connection's tokens while the editor is simply browsing the site.
		register_rest_route(
			Plugin::REST_NAMESPACE,
			'/auth/session',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'session' ),
				'permission_callback' => array( Permissions::class, 'can_use_panel' ),
			)
		);
	}

	/**
	 * Error when the site owner turned connections off.
	 */
	private function disabled() {
		return new WP_Error(
			'seb_connections_disabled',
			__( 'Connections (token login) are disabled on this site. Ask an administrator to enable them in Settings → Sidebar Editor Bridge.', 'sidebar-editor-bridge' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Deny users who can't edit content.
	 *
	 * @param WP_User $user User.
	 * @return array<string, mixed>|WP_Error
	 */
	private function issue_for( WP_User $user ) {
		if ( ! user_can( $user, 'edit_posts' ) ) {
			return new WP_Error( 'seb_forbidden', __( 'This user is not allowed to edit content.', 'sidebar-editor-bridge' ), array( 'status' => 403 ) );
		}
		return Tokens::issue( $user );
	}

	/**
	 * POST /auth/login.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>|WP_Error
	 */
	public function login( WP_REST_Request $request ) {
		if ( ! Settings::connections_enabled() ) {
			return $this->disabled();
		}
		$username = sanitize_user( (string) $request['username'] );
		$password = (string) $request['password'];
		if ( '' === $username || '' === $password ) {
			return new WP_Error( 'seb_bad_request', __( 'Username and password are required.', 'sidebar-editor-bridge' ), array( 'status' => 400 ) );
		}

		$ip = Rate_Limiter::client_ip();
		if ( Rate_Limiter::is_locked( $ip, $username ) ) {
			return new WP_Error( 'seb_too_many_attempts', __( 'Too many failed login attempts. Try again in 15 minutes.', 'sidebar-editor-bridge' ), array( 'status' => 429 ) );
		}

		$user = wp_authenticate( $username, $password );
		if ( is_wp_error( $user ) ) {
			Rate_Limiter::fail( $ip, $username );
			return new WP_Error( 'seb_auth_failed', __( 'Invalid credentials.', 'sidebar-editor-bridge' ), array( 'status' => 401 ) );
		}
		Rate_Limiter::reset( $ip, $username );
		return $this->issue_for( $user );
	}

	/**
	 * POST /auth/refresh — rotates both tokens.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array<string, mixed>|WP_Error
	 */
	public function refresh( WP_REST_Request $request ) {
		if ( ! Settings::connections_enabled() ) {
			return $this->disabled();
		}
		$user = Tokens::validate( (string) $request['refreshToken'], 'refresh' );
		if ( ! $user ) {
			return new WP_Error( 'seb_invalid_token', __( 'Session expired or revoked — log in again.', 'sidebar-editor-bridge' ), array( 'status' => 401 ) );
		}
		return $this->issue_for( $user );
	}

	/**
	 * GET /auth/session.
	 *
	 * @return array<string, mixed>|WP_Error
	 */
	public function session() {
		if ( ! Settings::connections_enabled() ) {
			return $this->disabled();
		}
		return $this->issue_for( wp_get_current_user() );
	}
}
