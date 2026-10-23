<?php
/**
 * Apply a site bundle (kit, menus, theme templates, pages) built by build-site.js.
 *
 * Run with: wp eval-file deploy.php <bundle.json> --user=admin
 * Everything is idempotent: posts are found again by their _smg_key meta and updated in place,
 * so re-running after a mockup change updates the same pages instead of creating copies.
 * The string {{HOME}} anywhere in the bundle is replaced with the site's home URL (no trailing slash).
 */

use Elementor\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$raw    = file_get_contents( $args[0] );
$raw    = str_replace( '{{HOME}}', untrailingslashit( home_url() ), $raw );
$bundle = json_decode( $raw, true );
if ( ! $bundle ) {
	WP_CLI::error( 'Could not read bundle: ' . json_last_error_msg() );
}

$docs = Plugin::$instance->documents;

function smg_find( $key, $post_type ) {
	$ids = get_posts(
		array(
			'post_type'      => $post_type,
			'post_status'    => 'any',
			'meta_key'       => '_smg_key',
			'meta_value'     => $key,
			'posts_per_page' => 1,
			'fields'         => 'ids',
		)
	);
	return $ids ? (int) $ids[0] : 0;
}

// ---- 1. Global kit: colors, fonts, buttons, layout, custom CSS ----
if ( ! empty( $bundle['kit'] ) ) {
	$kit_id = (int) get_option( 'elementor_active_kit' );
	$kit    = $docs->get( $kit_id, false );
	$merged = array_merge( (array) $kit->get_settings(), $bundle['kit'] );
	$kit->save( array( 'settings' => $merged ) );
	WP_CLI::log( "Kit $kit_id updated" );
}

// ---- 2. Menus ----
foreach ( $bundle['menus'] ?? array() as $menu ) {
	$obj     = wp_get_nav_menu_object( $menu['name'] );
	$menu_id = $obj ? $obj->term_id : wp_create_nav_menu( $menu['name'] );
	foreach ( wp_get_nav_menu_items( $menu_id ) ?: array() as $old ) {
		wp_delete_post( $old->ID, true );
	}
	$add = function ( $items, $parent = 0 ) use ( &$add, $menu_id ) {
		foreach ( $items as $i => $item ) {
			$item_id = wp_update_nav_menu_item(
				$menu_id,
				0,
				array(
					'menu-item-title'     => $item['title'],
					'menu-item-url'       => $item['url'],
					'menu-item-type'      => 'custom',
					'menu-item-status'    => 'publish',
					'menu-item-parent-id' => $parent,
					'menu-item-position'  => $i + 1,
				)
			);
			if ( ! empty( $item['children'] ) ) {
				$add( $item['children'], $item_id );
			}
		}
	};
	$add( $menu['items'] );
	WP_CLI::log( "Menu '{$menu['name']}' rebuilt" );
}

// ---- 3. Theme Builder templates (header, footer) ----
foreach ( $bundle['templates'] ?? array() as $t ) {
	$id = smg_find( $t['key'], 'elementor_library' );
	if ( ! $id ) {
		$doc = $docs->create( $t['type'], array( 'post_title' => $t['title'], 'post_status' => 'publish' ), array( '_smg_key' => $t['key'] ) );
		if ( is_wp_error( $doc ) ) {
			WP_CLI::error( "Template {$t['key']}: " . $doc->get_error_message() );
		}
		$id = $doc->get_main_id();
	}
	$doc = $docs->get( $id, false );
	$doc->save( array( 'elements' => $t['elements'], 'settings' => $t['settings'] ?? array( 'post_status' => 'publish' ) ) );

	if ( ! empty( $t['conditions'] ) && class_exists( '\ElementorPro\Modules\ThemeBuilder\Module' ) ) {
		$conds = array_map(
			function ( $c ) {
				return array( 'type' => $c[0], 'name' => $c[1], 'sub_name' => $c[2] ?? '', 'sub_id' => $c[3] ?? '' );
			},
			$t['conditions']
		);
		\ElementorPro\Modules\ThemeBuilder\Module::instance()->get_conditions_manager()->save_conditions( $id, $conds );
	}
	WP_CLI::log( "Template {$t['key']} → #$id" );
}

// ---- 4. Pages ----
foreach ( $bundle['pages'] ?? array() as $p ) {
	$id = smg_find( $p['key'], 'page' );
	if ( ! $id ) {
		$doc = $docs->create(
			'wp-page',
			array( 'post_title' => $p['title'], 'post_status' => 'publish', 'post_type' => 'page', 'post_name' => $p['slug'] ),
			array( '_smg_key' => $p['key'] )
		);
		if ( is_wp_error( $doc ) ) {
			WP_CLI::error( "Page {$p['key']}: " . $doc->get_error_message() );
		}
		$id = $doc->get_main_id();
	}
	wp_update_post( array( 'ID' => $id, 'post_title' => $p['title'], 'post_name' => $p['slug'], 'post_status' => 'publish', 'menu_order' => $p['order'] ?? 0 ) );
	if ( ! empty( $p['excerpt'] ) ) {
		wp_update_post( array( 'ID' => $id, 'post_excerpt' => $p['excerpt'] ) );
	}

	$doc      = $docs->get( $id, false );
	$settings = array_merge( array( 'template' => 'elementor_header_footer', 'hide_title' => 'yes', 'post_status' => 'publish' ), $p['settings'] ?? array() );
	$doc->save( array( 'elements' => $p['elements'], 'settings' => $settings ) );

	if ( ! empty( $p['front'] ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $id );
	}
	WP_CLI::log( "Page {$p['slug']} → #$id " . get_permalink( $id ) );
}

// ---- 4b. Posts (articles): plain HTML content so they stay editable in the normal post editor ----
if ( ! empty( $bundle['posts'] ) ) {
	// Posts without a category land in "Mt. Shasta" rather than "Uncategorized".
	$default_cat = (int) get_option( 'default_category' );
	$default     = get_term( $default_cat, 'category' );
	if ( $default && 'uncategorized' === $default->slug ) {
		wp_update_term( $default_cat, 'category', array( 'name' => 'Mt. Shasta', 'slug' => 'mt-shasta' ) );
	}
}
foreach ( $bundle['posts'] ?? array() as $p ) {
	$cats = array();
	foreach ( $p['categories'] as $name ) {
		$term   = term_exists( $name, 'category' );
		$term   = $term ? $term : wp_insert_term( $name, 'category' );
		$cats[] = (int) ( is_array( $term ) ? $term['term_id'] : $term );
	}
	$data = array(
		'post_type'     => 'post',
		'post_status'   => 'publish',
		'post_title'    => $p['title'],
		'post_name'     => $p['slug'],
		'post_content'  => $p['content'],
		'post_excerpt'  => $p['excerpt'],
		'post_date'     => $p['date'],
		'post_category' => $cats,
		'tags_input'    => $p['tags'],
	);
	$id = smg_find( $p['key'], 'post' );
	if ( $id ) {
		$data['ID'] = $id;
		wp_update_post( wp_slash( $data ) );
	} else {
		$id = wp_insert_post( wp_slash( $data ), true );
		if ( is_wp_error( $id ) ) {
			WP_CLI::error( "Post {$p['key']}: " . $id->get_error_message() );
		}
		update_post_meta( $id, '_smg_key', $p['key'] );
	}
	if ( ! empty( $p['featured'] ) ) {
		set_post_thumbnail( $id, (int) $p['featured'] );
	}
	update_post_meta( $id, 'smg_author', $p['author'] ?? '' );
	WP_CLI::log( "Post {$p['slug']} → #$id " . get_permalink( $id ) );
}

// ---- 5. URLs: live-site permalinks and redirects ----
// '/articles/%postname%' gives pages Squarespace's slash-less URLs (/climbmtshasta) and posts /articles/<slug>.
if ( ! empty( $bundle['permalinks'] ) && get_option( 'permalink_structure' ) !== $bundle['permalinks'] ) {
	global $wp_rewrite;
	$wp_rewrite->set_permalink_structure( $bundle['permalinks'] );
	WP_CLI::log( "Permalinks → {$bundle['permalinks']}" );
}
flush_rewrite_rules( false );
// Read by the smg-redirects mu-plugin
if ( isset( $bundle['redirects'] ) ) {
	update_option( 'smg_redirects', $bundle['redirects'], false );
	WP_CLI::log( count( $bundle['redirects'] ) . ' redirects saved' );
}

// ---- 6. Regenerate Elementor CSS ----
Plugin::$instance->files_manager->clear_cache();
WP_CLI::success( 'Deploy complete. Elementor CSS cache cleared.' );
