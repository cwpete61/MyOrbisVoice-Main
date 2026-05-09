<?php
/**
 * Plugin Name:       OrbisVoice Widget
 * Plugin URI:        https://myorbisvoice.com
 * Description:       Adds the OrbisVoice AI voice receptionist mic button to your WordPress site. Paste your widget public key in Settings → OrbisVoice Widget and the floating mic button appears site-wide.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            MyOrbisVoice
 * Author URI:        https://myorbisvoice.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       orbisvoice-widget
 */

// No direct access — WP loads this file through the plugin loader.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

const ORBISVOICE_WIDGET_OPTION_KEY = 'orbisvoice_widget_public_key';
const ORBISVOICE_WIDGET_OPTION_GATEWAY = 'orbisvoice_widget_gateway_url';
const ORBISVOICE_WIDGET_DEFAULT_GATEWAY = 'https://gateway.myorbisvoice.com';

// ── Activation: nothing to do, options are added on first save. ────────────

register_activation_hook( __FILE__, 'orbisvoice_widget_activate' );
function orbisvoice_widget_activate() {
    // Seed the gateway URL on first activation so admins don't have to know
    // it exists. They can override later if we ever spin up a self-hosted
    // gateway for them.
    if ( get_option( ORBISVOICE_WIDGET_OPTION_GATEWAY, '' ) === '' ) {
        update_option( ORBISVOICE_WIDGET_OPTION_GATEWAY, ORBISVOICE_WIDGET_DEFAULT_GATEWAY );
    }
}

// ── Settings page (Settings → OrbisVoice Widget) ───────────────────────────

add_action( 'admin_menu', 'orbisvoice_widget_admin_menu' );
function orbisvoice_widget_admin_menu() {
    add_options_page(
        'OrbisVoice Widget',
        'OrbisVoice Widget',
        'manage_options',
        'orbisvoice-widget',
        'orbisvoice_widget_render_settings'
    );
}

add_action( 'admin_init', 'orbisvoice_widget_register_settings' );
function orbisvoice_widget_register_settings() {
    register_setting( 'orbisvoice_widget_group', ORBISVOICE_WIDGET_OPTION_KEY, [
        'type'              => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ] );
    register_setting( 'orbisvoice_widget_group', ORBISVOICE_WIDGET_OPTION_GATEWAY, [
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default'           => ORBISVOICE_WIDGET_DEFAULT_GATEWAY,
    ] );
}

function orbisvoice_widget_render_settings() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $public_key  = get_option( ORBISVOICE_WIDGET_OPTION_KEY, '' );
    $gateway_url = get_option( ORBISVOICE_WIDGET_OPTION_GATEWAY, ORBISVOICE_WIDGET_DEFAULT_GATEWAY );

    ?>
    <div class="wrap">
        <h1>OrbisVoice Widget</h1>
        <p style="max-width: 720px; line-height: 1.5;">
            Paste your widget <strong>public key</strong> below — find it in your MyOrbisVoice
            dashboard under <em>Channels → Widget Test → Public key</em>. Save and the
            floating mic button will appear on every page of your site within a minute.
        </p>
        <form method="post" action="options.php">
            <?php settings_fields( 'orbisvoice_widget_group' ); ?>
            <table class="form-table" role="presentation">
                <tbody>
                <tr>
                    <th scope="row">
                        <label for="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_KEY ); ?>">Public key</label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_KEY ); ?>"
                            name="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_KEY ); ?>"
                            value="<?php echo esc_attr( $public_key ); ?>"
                            class="regular-text"
                            placeholder="pk_xxxxxxxxxxxx"
                            autocomplete="off"
                        />
                        <p class="description">Required. Without this key the widget will not load.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label for="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_GATEWAY ); ?>">Gateway URL</label>
                    </th>
                    <td>
                        <input
                            type="url"
                            id="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_GATEWAY ); ?>"
                            name="<?php echo esc_attr( ORBISVOICE_WIDGET_OPTION_GATEWAY ); ?>"
                            value="<?php echo esc_attr( $gateway_url ); ?>"
                            class="regular-text"
                        />
                        <p class="description">Leave the default unless OrbisVoice support has given you a different URL.</p>
                    </td>
                </tr>
                </tbody>
            </table>
            <?php submit_button( 'Save changes' ); ?>
        </form>
        <?php if ( $public_key !== '' ) : ?>
            <hr />
            <p style="max-width: 720px;">
                ✅ Widget configured. Visit your site front-end and look for the mic button
                in the bottom-right corner. If you don't see it, hard-refresh the page
                (Ctrl+Shift+R / Cmd+Shift+R) to clear the cached HTML.
            </p>
        <?php endif; ?>
    </div>
    <?php
}

// ── Front-end: inject the widget loader into wp_footer. ────────────────────
//
// We use wp_footer + a priority of 99 so the script lands near the closing
// </body> tag — same recommendation OrbisVoice gives for hand-pasted embeds.
// We use wp_print_inline_script_tag so the init call is properly emitted,
// and wp_enqueue_script so the loader script gets cached + scoped to scripts.

add_action( 'wp_enqueue_scripts', 'orbisvoice_widget_enqueue' );
function orbisvoice_widget_enqueue() {
    $public_key  = trim( (string) get_option( ORBISVOICE_WIDGET_OPTION_KEY, '' ) );
    $gateway_url = rtrim( (string) get_option( ORBISVOICE_WIDGET_OPTION_GATEWAY, ORBISVOICE_WIDGET_DEFAULT_GATEWAY ), '/' );

    if ( $public_key === '' || $gateway_url === '' ) {
        return; // Not configured — silent no-op rather than logging an error.
    }

    wp_enqueue_script(
        'orbisvoice-widget',
        $gateway_url . '/widget/orbisvoice-widget.js',
        [],     // No dependencies
        null,   // No version query — let the gateway control caching
        true    // Load in footer
    );
}

// Output the OrbisVoice.init() call after the loader has registered the
// global. wp_print_footer_scripts runs at priority 20; we hook at 99 so we
// emit AFTER the enqueued loader script tag is printed.
add_action( 'wp_footer', 'orbisvoice_widget_print_init', 99 );
function orbisvoice_widget_print_init() {
    $public_key = trim( (string) get_option( ORBISVOICE_WIDGET_OPTION_KEY, '' ) );
    if ( $public_key === '' ) {
        return;
    }

    // Inline the init call. The loader script registers `window.OrbisVoice`
    // synchronously at parse time so this runs immediately after.
    $payload = wp_json_encode( [ 'publicKey' => $public_key ] );
    if ( $payload === false ) {
        return;
    }

    echo "\n<script>if(typeof OrbisVoice!=='undefined'){OrbisVoice.init(" . $payload . ");}</script>\n";
}

// ── Settings link in the plugin list (small UX win). ───────────────────────

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'orbisvoice_widget_action_links' );
function orbisvoice_widget_action_links( $links ) {
    $settings_link = '<a href="' . esc_url( admin_url( 'options-general.php?page=orbisvoice-widget' ) ) . '">Settings</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
