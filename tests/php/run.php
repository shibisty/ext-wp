<?php
/**
 * Unit checks for the bridge plugin's pure logic: php tests/php/run.php
 */

require __DIR__ . '/bootstrap.php';

use SidebarEditorBridge\Acf_Dates;
use SidebarEditorBridge\Jwt;
use SidebarEditorBridge\Permissions;
use SidebarEditorBridge\Rate_Limiter;
use SidebarEditorBridge\Settings;
use SidebarEditorBridge\Tokens;

reset_world();

// ---- JWT ----
$t = Jwt::encode( array( 'a' => 1 ) );
check( 'jwt round trip', Jwt::decode( $t ), array( 'a' => 1 ) );
list( $h, $p, $s ) = explode( '.', $t );
check( 'jwt tampered payload rejected', Jwt::decode( $h . '.' . Jwt::base64url_encode( '{"a":2}' ) . '.' . $s ), false );
$none = Jwt::base64url_encode( '{"alg":"none","typ":"JWT"}' );
check( 'jwt alg=none rejected', Jwt::decode( $none . '.' . $p . '.' ), false );
check( 'jwt garbage rejected', Jwt::decode( 'abc' ), false );
check( 'jwt non-string rejected', Jwt::decode( array() ), false );

// ---- Tokens ----
$user  = $GLOBALS['t_users'][1];
$pair  = Tokens::issue( $user );
check( 'access token validates', Tokens::validate( $pair['accessToken'], 'access' ), $user );
check( 'refresh token validates', Tokens::validate( $pair['refreshToken'], 'refresh' ), $user );
check( 'access token is not a refresh token', Tokens::validate( $pair['accessToken'], 'refresh' ), null );
check( 'expiresIn from settings', $pair['expiresIn'], 3600 );

$GLOBALS['t_home'] = 'https://other.test/';
check( 'token from another site rejected (iss)', Tokens::validate( $pair['accessToken'], 'access' ), null );
$GLOBALS['t_home'] = 'https://example.test/';

Tokens::revoke_user( 1 );
check( 'user revoke kills access token', Tokens::validate( $pair['accessToken'], 'access' ), null );
$pair = Tokens::issue( $user );
Settings::bump_token_epoch();
check( 'site-wide revoke kills access token', Tokens::validate( $pair['accessToken'], 'access' ), null );
$pair = Tokens::issue( $user );
$user->user_pass = 'new-hash';
check( 'password change kills refresh token', Tokens::validate( $pair['refreshToken'], 'refresh' ), null );
check( 'password change keeps access token until expiry', Tokens::validate( $pair['accessToken'], 'access' ), $user );
unset( $GLOBALS['t_users'][1] );
check( 'deleted user rejected', Tokens::validate( $pair['accessToken'], 'access' ), null );
reset_world();

// ---- Settings ----
check( 'settings defaults', Settings::all(), array( 'allow_connections' => true, 'access_ttl_minutes' => 60, 'refresh_ttl_days' => 30 ) );
check( 'unchecked checkbox (hidden 0) disables', Settings::sanitize( array( 'allow_connections' => '0' ) )['allow_connections'], false );
check( 'ttl clamped low', Settings::sanitize( array( 'access_ttl_minutes' => 1 ) )['access_ttl_minutes'], 5 );
check( 'ttl clamped high', Settings::sanitize( array( 'refresh_ttl_days' => 9999 ) )['refresh_ttl_days'], 365 );
check( 'garbage settings fall back to defaults', Settings::sanitize( 'x' ), Settings::defaults() );

// ---- Permissions ----
$GLOBALS['t_caps'] = array( 'edit_post:42' => true, 'edit_term:7' => true );
check( 'acf ref post allowed', Permissions::can_edit_acf_ref( '42' ), true );
check( 'acf ref other post denied', Permissions::can_edit_acf_ref( '43' ), false );
check( 'acf ref term allowed', Permissions::can_edit_acf_ref( 'term_7' ), true );
check( 'acf ref option refused', Permissions::can_edit_acf_ref( 'option' ), false );
check( 'acf ref user refused', Permissions::can_edit_acf_ref( 'user_1' ), false );
check( 'acf ref negative/odd refused', Permissions::can_edit_acf_ref( '-1' ), false );
check( 'term route allowed', Permissions::rest_can_edit_term( new WP_REST_Request( array( 'term_id' => '7', 'taxonomy' => 'category' ) ) ), true );
check( 'term route unknown term denied', Permissions::rest_can_edit_term( new WP_REST_Request( array( 'term_id' => '8', 'taxonomy' => 'category' ) ) ), false );
reset_world();

// ---- Rate limiter ----
for ( $i = 0; $i < 5; $i++ ) {
	Rate_Limiter::fail( '1.2.3.4', 'Admin' );
}
check( 'locked after 5 failures', Rate_Limiter::is_locked( '1.2.3.4', 'admin' ), true );
check( 'transient key is prefixed and hashed', (bool) preg_match( '/^sidebar_editor_bridge_login_[0-9a-f]{32}$/', (string) array_key_first( $GLOBALS['t_trans'] ) ), true );
check( 'other IP not locked', Rate_Limiter::is_locked( '1.2.3.5', 'admin' ), false );
Rate_Limiter::reset( '1.2.3.4', 'admin' );
check( 'reset unlocks', Rate_Limiter::is_locked( '1.2.3.4', 'admin' ), false );

// ---- ACF dates ----
check( 'to_iso Ymd', Acf_Dates::to_iso( 'date_picker', '20260521' ), '2026-05-21' );
check( 'to_iso empty', Acf_Dates::to_iso( 'date_picker', null ), '' );
check( 'to_iso datetime passthrough', Acf_Dates::to_iso( 'date_time_picker', '2026-05-21 10:30:00' ), '2026-05-21 10:30:00' );
check( 'to_iso formatted passthrough', Acf_Dates::to_iso( 'date_picker', '21 Травня, 2026' ), '21 Травня, 2026' );
check( 'from_input date iso', Acf_Dates::from_input( 'date_picker', '2026-05-21' ), '20260521' );
check( 'from_input date Ymd', Acf_Dates::from_input( 'date_picker', '20260521' ), '20260521' );
check( 'from_input empty clears', Acf_Dates::from_input( 'date_picker', '' ), '' );
check( 'from_input invalid day', Acf_Dates::from_input( 'date_picker', '2026-02-30' ), null );
check( 'from_input formatted', Acf_Dates::from_input( 'date_picker', '21 Травня, 2026' ), null );
check( 'from_input array', Acf_Dates::from_input( 'date_picker', array( 1 ) ), null );
check( 'from_input datetime T', Acf_Dates::from_input( 'date_time_picker', '2026-05-21T10:30' ), '2026-05-21 10:30:00' );
check( 'from_input datetime date only', Acf_Dates::from_input( 'date_time_picker', '2026-05-21' ), '2026-05-21 00:00:00' );
check( 'from_input datetime bad hour', Acf_Dates::from_input( 'date_time_picker', '2026-05-21T25:00' ), null );
check( 'from_input time', Acf_Dates::from_input( 'time_picker', '09:05' ), '09:05:00' );
check( 'from_input time bad', Acf_Dates::from_input( 'time_picker', '9am' ), null );

echo "\n{$GLOBALS['t_count']} checks, {$GLOBALS['t_failures']} failure(s)\n";
exit( $GLOBALS['t_failures'] ? 1 : 0 );
