<?php
/**
 * Plugin Name: SMG head tags
 * Description: Favicon and link-preview (Open Graph) tags, matching the mockup. The image URLs are the smg_head option, written by tools/wp/deploy.php; the description is the page excerpt, as the theme uses for its meta description.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action(
	'wp_head',
	function () {
		$head = get_option( 'smg_head', array() );
		if ( ! $head ) {
			return;
		}
		echo '<link rel="icon" type="image/png" sizes="32x32" href="' . esc_url( $head['icon'] ) . '">' . "\n";
		echo '<link rel="apple-touch-icon" href="' . esc_url( $head['touch'] ) . '">' . "\n";

		$title = wp_get_document_title();
		$desc  = is_singular() ? wp_strip_all_tags( get_the_excerpt() ) : get_bloginfo( 'description' );
		$url   = is_singular() ? get_permalink() : home_url( add_query_arg( array() ) );
		// Articles use their featured photo; everything else the summit image
		$image = ( is_singular( 'post' ) && has_post_thumbnail() ) ? get_the_post_thumbnail_url( null, 'large' ) : $head['share'];

		$tags = array(
			'og:type'        => is_singular( 'post' ) ? 'article' : 'website',
			'og:site_name'   => get_bloginfo( 'name' ),
			'og:title'       => $title,
			'og:description' => $desc,
			'og:url'         => $url,
			'og:image'       => $image,
		);
		foreach ( $tags as $property => $content ) {
			if ( $content ) {
				echo '<meta property="' . esc_attr( $property ) . '" content="' . esc_attr( $content ) . '">' . "\n";
			}
		}
		echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
	},
	5
);
