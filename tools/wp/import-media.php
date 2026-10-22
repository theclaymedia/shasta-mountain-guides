<?php
/**
 * Import mockup assets into the WordPress Media Library, idempotently.
 *
 * Run with: wp eval-file import-media.php <import-dir> <manifest.json> <out-map.json>
 * manifest.json: [{ "path": "assets/images/x.jpg", "alt": "...", "title": "..." }, ...]
 * Each attachment is tagged with _smg_source = path, so re-runs reuse existing uploads.
 * Writes { path: { id, url } } to out-map.json.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

list( $import_dir, $manifest_file, $out_file ) = $args;
$manifest = json_decode( file_get_contents( $manifest_file ), true );
$map      = array();
$added    = 0;
$reused   = 0;

foreach ( $manifest as $item ) {
	$path = $item['path'];

	$existing = get_posts(
		array(
			'post_type'      => 'attachment',
			'post_status'    => 'any',
			'meta_key'       => '_smg_source',
			'meta_value'     => $path,
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);

	if ( $existing ) {
		$id = $existing[0];
		$reused++;
	} else {
		$src = trailingslashit( $import_dir ) . $path;
		if ( ! file_exists( $src ) ) {
			WP_CLI::warning( "Missing file: $src" );
			continue;
		}
		// Sideload from a temp copy so the import folder stays intact.
		$tmp = wp_tempnam( basename( $src ) );
		copy( $src, $tmp );
		$file = array(
			'name'     => basename( $src ),
			'tmp_name' => $tmp,
		);
		$id = media_handle_sideload( $file, 0, $item['title'] ?? null );
		if ( is_wp_error( $id ) ) {
			WP_CLI::warning( "Failed $path: " . $id->get_error_message() );
			@unlink( $tmp );
			continue;
		}
		update_post_meta( $id, '_smg_source', $path );
		$added++;
	}

	if ( ! empty( $item['alt'] ) ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $item['alt'] );
	}

	$map[ $path ] = array(
		'id'  => (int) $id,
		'url' => wp_get_attachment_url( $id ),
	);
}

file_put_contents( $out_file, wp_json_encode( $map, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
WP_CLI::success( "Media ready: $added added, $reused already there, " . count( $map ) . ' mapped.' );
