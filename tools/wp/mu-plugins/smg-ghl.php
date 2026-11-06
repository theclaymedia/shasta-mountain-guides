<?php
/**
 * Plugin Name: SMG GoHighLevel leads
 * Description: Sends Elementor form submissions to Chris's GoHighLevel sub-account: upserts the contact, tags it by form and trip, and adds the details as a note. Inactive until SMG_GHL_TOKEN is defined in wp-config.php. The forms' own email and "save to database" actions are unaffected.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Shasta Mountain Guides sub-account. Override in wp-config.php if it ever moves.
if ( ! defined( 'SMG_GHL_LOCATION' ) ) {
	define( 'SMG_GHL_LOCATION', 'x8PxwEhUUtWlXe1D4kvV' );
}
// API version header; the v2 contact endpoint pages list "v3". Override in wp-config.php if HighLevel rejects it.
if ( ! defined( 'SMG_GHL_API_VERSION' ) ) {
	define( 'SMG_GHL_API_VERSION', 'v3' );
}

// Fires after Elementor Pro has run the form's own actions (email, save to database).
add_action(
	'elementor_pro/forms/new_record',
	function ( $record ) {
		if ( ! defined( 'SMG_GHL_TOKEN' ) || ! SMG_GHL_TOKEN ) {
			return;
		}
		$form   = (string) $record->get_form_settings( 'form_name' );
		$fields = array();
		foreach ( (array) $record->get( 'fields' ) as $id => $f ) {
			$fields[ $id ] = trim( (string) ( $f['value'] ?? '' ) );
		}
		// phpcs:disable WordPress.Security.NonceVerification -- Elementor has already validated the submission
		$page = sanitize_text_field( wp_unslash( $_POST['referer_title'] ?? '' ) );
		if ( ! $page && ! empty( $_POST['queried_id'] ) ) { // referer_title is empty on the homepage
			$page = get_the_title( (int) $_POST['queried_id'] );
		}
		// phpcs:enable
		smg_ghl_send( $form, $fields, $page );
	}
);

/**
 * Turn one form submission into a GoHighLevel contact, tags and note.
 * Never throws: a GoHighLevel outage must not break the form, which has already emailed and saved the entry.
 */
function smg_ghl_send( $form, array $fields, $page = '' ) {
	$email = sanitize_email( $fields['email'] ?? '' );
	if ( ! $email ) {
		return smg_ghl_log( $form, 'skipped: no email' );
	}

	// Which form → which tags. "website-inquiry" starts the Website Inquiry workflow.
	$tags   = array();
	$retrig = array();
	if ( 'Plan my climb' === $form ) {
		$tags[]   = 'website-inquiry';
		$retrig[] = 'website-inquiry'; // tag triggers only fire when the tag is newly added
		if ( ! empty( $fields['trip'] ) ) {
			$tags[] = 'trip: ' . strtolower( $fields['trip'] );
		}
	} elseif ( 'Training guide download' === $form ) {
		$tags[] = 'resource: training guide';
	} elseif ( 'Gear checklist download' === $form ) {
		$tags[] = 'resource: gear list';
		if ( ! empty( $fields['gear_list'] ) ) {
			// The select's value is the PDF URL (…/smg-summit-climb-gear-list.pdf → "gear: summit climb")
			$file   = pathinfo( (string) wp_parse_url( $fields['gear_list'], PHP_URL_PATH ), PATHINFO_FILENAME );
			$tags[] = 'gear: ' . str_replace( '-', ' ', preg_replace( '/^smg-|-gear-list$/', '', strtolower( $file ) ) );
		}
	} else {
		$tags[] = 'website-form';
	}

	$name  = sanitize_text_field( $fields['name'] ?? '' );
	$parts = preg_split( '/\s+/', $name, 2 );
	$res   = smg_ghl_request(
		'POST',
		'/contacts/upsert',
		array(
			'locationId' => SMG_GHL_LOCATION,
			'email'      => $email,
			'name'       => $name,
			'firstName'  => $parts[0] ?? '',
			'lastName'   => $parts[1] ?? '',
			'source'     => 'Website: ' . $form,
		)
	);
	$id = $res['contact']['id'] ?? '';
	if ( ! $id ) {
		return smg_ghl_log( $form, 'upsert failed: ' . ( $res['_error'] ?? 'no contact id' ) );
	}

	// Details as a note, so the team sees exactly what was asked
	$labels = array(
		'trip'       => 'Interested in',
		'dates'      => 'Ideal dates',
		'experience' => 'Experience',
		'group'      => 'Group size',
		'message'    => 'Message',
		'gear_list'  => 'Gear list',
	);
	$lines = array( 'Website form: ' . $form . ( $page ? ' (' . $page . ')' : '' ) );
	foreach ( $labels as $key => $label ) {
		if ( ! empty( $fields[ $key ] ) ) {
			$lines[] = $label . ': ' . sanitize_textarea_field( $fields[ $key ] );
		}
	}
	smg_ghl_request( 'POST', "/contacts/$id/notes", array( 'body' => implode( "\n", $lines ) ) );

	if ( $retrig ) {
		smg_ghl_request( 'DELETE', "/contacts/$id/tags", array( 'tags' => $retrig ) );
	}
	$res = smg_ghl_request( 'POST', "/contacts/$id/tags", array( 'tags' => $tags ) );

	return smg_ghl_log( $form, isset( $res['_error'] ) ? 'tags failed: ' . $res['_error'] : 'ok ' . $id );
}

function smg_ghl_request( $method, $path, array $body ) {
	$r = wp_remote_request(
		'https://services.leadconnectorhq.com' . $path,
		array(
			'method'  => $method,
			'timeout' => 8,
			'headers' => array(
				'Authorization' => 'Bearer ' . SMG_GHL_TOKEN,
				'Version'       => SMG_GHL_API_VERSION,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
			'body'    => wp_json_encode( $body ),
		)
	);
	if ( is_wp_error( $r ) ) {
		return array( '_error' => $r->get_error_message() );
	}
	$code = wp_remote_retrieve_response_code( $r );
	$json = json_decode( wp_remote_retrieve_body( $r ), true );
	if ( $code < 200 || $code >= 300 ) {
		return array( '_error' => "HTTP $code " . substr( wp_remote_retrieve_body( $r ), 0, 200 ) );
	}
	return is_array( $json ) ? $json : array();
}

// Last 20 results in the smg_ghl_log option (form name, outcome, contact id; no personal details).
// Read with: wp option get smg_ghl_log --format=json
function smg_ghl_log( $form, $outcome ) {
	$log   = (array) get_option( 'smg_ghl_log', array() );
	$log[] = gmdate( 'Y-m-d H:i:s' ) . ' | ' . $form . ' | ' . $outcome;
	update_option( 'smg_ghl_log', array_slice( $log, -20 ), false );
	if ( 0 !== strpos( $outcome, 'ok' ) ) {
		error_log( 'SMG GoHighLevel: ' . $form . ' | ' . $outcome ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions
	}
	return $outcome;
}
