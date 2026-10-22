<?php
/**
 * Plugin Name: SMG redirects
 * Description: 301 redirects that keep old shastaguides.com links working (duplicate trip pages, /s/ gear PDFs). The map is the smg_redirects option, written by tools/wp/deploy.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Priority 1: before WordPress's own redirect_canonical guesses a different page.
add_action(
	'template_redirect',
	function () {
		if ( ! is_404() ) {
			return;
		}
		$map = get_option( 'smg_redirects', array() );
		if ( ! $map ) {
			return;
		}
		$path = trim( rawurldecode( (string) wp_parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH ) ), '/' );
		$base = trim( (string) wp_parse_url( home_url(), PHP_URL_PATH ), '/' );
		if ( $base && 0 === strpos( $path, $base . '/' ) ) {
			$path = substr( $path, strlen( $base ) + 1 );
		}
		$to = $map[ $path ] ?? $map[ strtolower( $path ) ] ?? null;
		if ( $to ) {
			wp_redirect( 0 === strpos( $to, 'http' ) ? $to : home_url( $to ), 301, 'SMG redirects' );
			exit;
		}
	},
	1
);
