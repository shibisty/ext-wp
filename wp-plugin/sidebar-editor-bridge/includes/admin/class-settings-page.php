<?php
/**
 * Settings → Sidebar Editor Bridge.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Admin;

use SidebarEditorBridge\Settings;

defined( 'ABSPATH' ) || exit;

/**
 * Options page + "revoke all tokens" action.
 */
final class Settings_Page {

	const SLUG          = 'sidebar-editor-bridge';
	const REVOKE_ACTION = 'sidebar_editor_bridge_revoke_all';

	/**
	 * Hook in.
	 */
	public static function register() {
		add_action( 'admin_menu', array( __CLASS__, 'add_page' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_setting' ) );
		add_action( 'admin_post_' . self::REVOKE_ACTION, array( __CLASS__, 'handle_revoke_all' ) );
	}

	/**
	 * Menu entry.
	 */
	public static function add_page() {
		add_options_page(
			__( 'Sidebar Editor Bridge', 'sidebar-editor-bridge' ),
			__( 'Sidebar Editor Bridge', 'sidebar-editor-bridge' ),
			'manage_options',
			self::SLUG,
			array( __CLASS__, 'render' )
		);
	}

	/**
	 * Settings API registration.
	 */
	public static function register_setting() {
		register_setting(
			self::SLUG,
			Settings::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( Settings::class, 'sanitize' ),
				'default'           => Settings::defaults(),
			)
		);
	}

	/**
	 * Handle the admin-post "Sign out all devices" action.
	 */
	public static function handle_revoke_all() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to do that.', 'sidebar-editor-bridge' ), 403 );
		}
		check_admin_referer( self::REVOKE_ACTION );
		Settings::bump_token_epoch();
		wp_safe_redirect( add_query_arg( 'seb-revoked', '1', admin_url( 'options-general.php?page=' . self::SLUG ) ) );
		exit;
	}

	/**
	 * Page markup.
	 */
	public static function render() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$s    = Settings::all();
		$name = Settings::OPTION;
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Sidebar Editor Bridge', 'sidebar-editor-bridge' ); ?></h1>
			<?php
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- display-only flag set by our own redirect.
			if ( isset( $_GET['seb-revoked'] ) ) :
				?>
				<div class="notice notice-success is-dismissible"><p><?php esc_html_e( 'All browser extension sessions have been signed out.', 'sidebar-editor-bridge' ); ?></p></div>
			<?php endif; ?>

			<p>
				<?php esc_html_e( 'This plugin lets editors use the WP Sidebar Editor browser extension. While an editor views the site, the extension reads the editing context printed into the page; with connections enabled it can also keep working when the site is not open in a tab, using its own short-lived tokens instead of the password.', 'sidebar-editor-bridge' ); ?>
			</p>

			<form method="post" action="options.php">
				<?php settings_fields( self::SLUG ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Connections', 'sidebar-editor-bridge' ); ?></th>
						<td>
							<input type="hidden" name="<?php echo esc_attr( $name ); ?>[allow_connections]" value="0" />
							<label>
								<input type="checkbox" name="<?php echo esc_attr( $name ); ?>[allow_connections]" value="1" <?php checked( $s['allow_connections'] ); ?> />
								<?php esc_html_e( 'Allow editors to log in from the extension and edit without the site open in a tab', 'sidebar-editor-bridge' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'When disabled, the extension only works on pages of this site that are open in the browser, using the normal login cookie.', 'sidebar-editor-bridge' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="seb-access-ttl"><?php esc_html_e( 'Access token lifetime', 'sidebar-editor-bridge' ); ?></label></th>
						<td>
							<input id="seb-access-ttl" type="number" min="5" max="1440" class="small-text" name="<?php echo esc_attr( $name ); ?>[access_ttl_minutes]" value="<?php echo esc_attr( (string) $s['access_ttl_minutes'] ); ?>" />
							<?php esc_html_e( 'minutes', 'sidebar-editor-bridge' ); ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="seb-refresh-ttl"><?php esc_html_e( 'Stay signed in for', 'sidebar-editor-bridge' ); ?></label></th>
						<td>
							<input id="seb-refresh-ttl" type="number" min="1" max="365" class="small-text" name="<?php echo esc_attr( $name ); ?>[refresh_ttl_days]" value="<?php echo esc_attr( (string) $s['refresh_ttl_days'] ); ?>" />
							<?php esc_html_e( 'days', 'sidebar-editor-bridge' ); ?>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>

			<h2><?php esc_html_e( 'Sign out everywhere', 'sidebar-editor-bridge' ); ?></h2>
			<p><?php esc_html_e( 'Immediately invalidates every token issued to the extension, for all users. Editors will have to log in again. Users can do the same for their own account on their profile page.', 'sidebar-editor-bridge' ); ?></p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="<?php echo esc_attr( self::REVOKE_ACTION ); ?>" />
				<?php wp_nonce_field( self::REVOKE_ACTION ); ?>
				<?php submit_button( __( 'Sign out all extension sessions', 'sidebar-editor-bridge' ), 'secondary' ); ?>
			</form>
		</div>
		<?php
	}
}
