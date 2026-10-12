<?php
/**
 * "Sign out the browser extension" on the user profile screen.
 *
 * @package SidebarEditorBridge
 */

namespace SidebarEditorBridge\Admin;

use SidebarEditorBridge\Tokens;
use WP_User;

defined( 'ABSPATH' ) || exit;

/**
 * Per-user token revocation.
 */
final class User_Profile {

	const FIELD = 'sidebar_editor_bridge_revoke_tokens';

	/**
	 * Hook in.
	 */
	public static function register() {
		add_action( 'show_user_profile', array( __CLASS__, 'render' ) );
		add_action( 'edit_user_profile', array( __CLASS__, 'render' ) );
		add_action( 'personal_options_update', array( __CLASS__, 'save' ) );
		add_action( 'edit_user_profile_update', array( __CLASS__, 'save' ) );
	}

	/**
	 * Profile section (only for users who could use the extension).
	 *
	 * @param WP_User $user Profile owner.
	 */
	public static function render( $user ) {
		if ( ! user_can( $user, 'edit_posts' ) ) {
			return;
		}
		?>
		<h2><?php esc_html_e( 'WP Sidebar Editor', 'sidebar-editor-bridge' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Browser extension', 'sidebar-editor-bridge' ); ?></th>
				<td>
					<label>
						<input type="checkbox" name="<?php echo esc_attr( self::FIELD ); ?>" value="1" />
						<?php esc_html_e( 'Sign out the browser extension on all devices', 'sidebar-editor-bridge' ); ?>
					</label>
				</td>
			</tr>
		</table>
		<?php
	}

	/**
	 * Handle the checkbox. The profile form's own nonce (update-user_{id})
	 * is verified by core before these hooks fire.
	 *
	 * @param int $user_id Profile owner.
	 */
	public static function save( $user_id ) {
		if ( ! current_user_can( 'edit_user', $user_id ) ) {
			return;
		}
		check_admin_referer( 'update-user_' . $user_id );
		if ( ! empty( $_POST[ self::FIELD ] ) ) {
			Tokens::revoke_user( (int) $user_id );
		}
	}
}
