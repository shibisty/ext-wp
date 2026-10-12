<?php
/**
 * Minimal WordPress stand-ins so the bridge's classes can be unit-tested
 * with plain PHP (no WordPress install, no PHPUnit):
 *   php tests/php/run.php
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );
define( 'HOUR_IN_SECONDS', 3600 );
define( 'DAY_IN_SECONDS', 86400 );
define( 'SIDEBAR_EDITOR_BRIDGE_VERSION', 'test' );

class WP_User {
	public $ID;
	public $user_pass;
	public $user_login;
	public $display_name;
	public function __construct( $id, $pass = 'hash' ) {
		$this->ID           = $id;
		$this->user_pass    = $pass;
		$this->user_login   = "user$id";
		$this->display_name = "User $id";
	}
}
class WP_REST_Request implements ArrayAccess {
	private $params;
	public function __construct( array $params = array() ) { $this->params = $params; }
	public function offsetExists( $k ): bool { return isset( $this->params[ $k ] ); }
	#[\ReturnTypeWillChange]
	public function offsetGet( $k ) { return $this->params[ $k ] ?? null; }
	public function offsetSet( $k, $v ): void { $this->params[ $k ] = $v; }
	public function offsetUnset( $k ): void { unset( $this->params[ $k ] ); }
}

$GLOBALS['t_options'] = array();
$GLOBALS['t_meta']    = array();
$GLOBALS['t_trans']   = array();
$GLOBALS['t_users']   = array();
$GLOBALS['t_caps']    = array(); // [ "cap:id" => bool ]
$GLOBALS['t_home']    = 'https://example.test/';

function wp_salt( $scheme ) { return "salt-$scheme"; }
function wp_json_encode( $data, $flags = 0 ) { return json_encode( $data, $flags ); }
function get_option( $k, $d = false ) { return $GLOBALS['t_options'][ $k ] ?? $d; }
function update_option( $k, $v, $autoload = null ) { $GLOBALS['t_options'][ $k ] = $v; return true; }
function get_user_meta( $id, $k, $single ) { return $GLOBALS['t_meta'][ $id ][ $k ] ?? ''; }
function update_user_meta( $id, $k, $v ) { $GLOBALS['t_meta'][ $id ][ $k ] = $v; return true; }
function get_user_by( $f, $id ) { return $GLOBALS['t_users'][ $id ] ?? false; }
function home_url( $p = '' ) { return $GLOBALS['t_home']; }
function get_site_url() { return rtrim( $GLOBALS['t_home'], '/' ); }
function get_rest_url() { return $GLOBALS['t_home'] . 'wp-json/'; }
function esc_url_raw( $u ) { return $u; }
function absint( $v ) { return abs( (int) $v ); }
function apply_filters( $hook, $v ) { return $v; }
function did_action( $hook ) { return 0; }
function current_user_can( $cap, ...$args ) {
	$key = $cap . ( $args ? ':' . $args[0] : '' );
	$GLOBALS['t_cap_calls'][] = $key;
	return $GLOBALS['t_caps'][ $key ] ?? false;
}
function get_transient( $k ) { return $GLOBALS['t_trans'][ $k ] ?? false; }
function set_transient( $k, $v, $ttl ) { $GLOBALS['t_trans'][ $k ] = $v; return true; }
function delete_transient( $k ) { unset( $GLOBALS['t_trans'][ $k ] ); return true; }
function sanitize_text_field( $s ) { return trim( (string) $s ); }
function wp_unslash( $s ) { return $s; }
function get_term( $id, $tax ) { return ( 7 === $id && 'category' === $tax ) ? (object) array( 'term_id' => 7 ) : null; }
function is_wp_error( $x ) { return false; }

$root = dirname( __DIR__, 2 ) . '/wp-plugin/sidebar-editor-bridge/includes/';
foreach ( array( 'class-settings.php', 'class-jwt.php', 'class-providers.php', 'class-tokens.php', 'class-rate-limiter.php', 'class-permissions.php', 'class-acf-dates.php' ) as $f ) {
	require $root . $f;
}

// ---- tiny runner ----
$GLOBALS['t_failures'] = 0;
$GLOBALS['t_count']    = 0;
function check( $label, $actual, $expected ) {
	$GLOBALS['t_count']++;
	if ( $actual === $expected ) {
		echo "ok   $label\n";
		return;
	}
	$GLOBALS['t_failures']++;
	echo "FAIL $label: expected " . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) . "\n";
}
function reset_world() {
	$GLOBALS['t_options']   = array();
	$GLOBALS['t_meta']      = array();
	$GLOBALS['t_trans']     = array();
	$GLOBALS['t_caps']      = array();
	$GLOBALS['t_cap_calls'] = array();
	$GLOBALS['t_users']     = array( 1 => new WP_User( 1 ) );
	$GLOBALS['t_home']      = 'https://example.test/';
}
