<?php
/**
 * Kaffen Child theme functions.
 *
 * @package KaffenChild
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Return allowed tracking query args from current request.
 *
 * @return array<string, string>
 */
function kaffen_child_get_allowed_tracking_query_args() {
	$allowed_keys = array(
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_content',
		'utm_term',
		'gclid',
		'fbclid',
		'msclkid',
		'ttclid',
	);

	if ( empty( $_GET ) ) {
		return array();
	}

	$query_args = wp_unslash( $_GET );
	$filtered   = array();

	foreach ( $allowed_keys as $key ) {
		if ( ! isset( $query_args[ $key ] ) || ! is_scalar( $query_args[ $key ] ) ) {
			continue;
		}

		$filtered[ $key ] = sanitize_text_field( (string) $query_args[ $key ] );
	}

	return $filtered;
}

/**
 * Enqueue Coffee Box landing assets only on its page template.
 */
function kaffen_child_enqueue_coffee_box_assets() {
	if ( ! is_page_template( 'page-templates/landing-coffee-box.php' ) ) {
		return;
	}

	$theme_uri  = get_stylesheet_directory_uri();
	$theme_path = get_stylesheet_directory();

	$css_rel_path = '/assets/css/eva-coffee-box.css';
	$js_rel_path  = '/assets/js/eva-coffee-box.js';

	$css_abs_path = $theme_path . $css_rel_path;
	$js_abs_path  = $theme_path . $js_rel_path;

	wp_enqueue_style(
		'eva-coffee-box',
		$theme_uri . $css_rel_path,
		array(),
		file_exists( $css_abs_path ) ? (string) filemtime( $css_abs_path ) : null
	);

	wp_enqueue_script(
		'eva-coffee-box',
		$theme_uri . $js_rel_path,
		array(),
		file_exists( $js_abs_path ) ? (string) filemtime( $js_abs_path ) : null,
		true
	);

	$query_params = kaffen_child_get_allowed_tracking_query_args();

	$checkout_url = wc_get_checkout_url();
	if ( ! empty( $query_params ) ) {
		$checkout_url = add_query_arg( $query_params, $checkout_url );
	}

	wp_localize_script(
		'eva-coffee-box',
		'EvaCoffeeBoxConfig',
		array(
			'ajaxUrl'      => WC_AJAX::get_endpoint( 'add_to_cart' ),
			'checkoutUrl'  => $checkout_url,
			'requestTimeout' => 12000,
			'i18n'         => array(
				'selectPrompt' => __( 'Seleziona entrambe le macinature', 'kaffen-child' ),
				'addToCart'    => __( 'Aggiungi al carrello', 'kaffen-child' ),
				'adding'       => __( 'Aggiunta in corso...', 'kaffen-child' ),
				'goCheckout'   => __( 'Vai al checkout', 'kaffen-child' ),
				'added'        => __( 'Aggiunto ✓', 'kaffen-child' ),
				'offline'      => __( 'Sei offline. Controlla la connessione e riprova.', 'kaffen-child' ),
				'timeout'      => __( 'La richiesta sta impiegando troppo tempo. Riprova.', 'kaffen-child' ),
				'unauthorized' => __( 'Sessione scaduta. Aggiorna la pagina e riprova.', 'kaffen-child' ),
				'forbidden'    => __( 'Non hai i permessi per completare questa azione.', 'kaffen-child' ),
				'notFound'     => __( 'Prodotto non trovato. Aggiorna la pagina.', 'kaffen-child' ),
				'rateLimited'  => __( 'Hai fatto troppi tentativi. Attendi qualche secondo.', 'kaffen-child' ),
				'serverError'  => __( 'Errore temporaneo del server. Riprova tra poco.', 'kaffen-child' ),
				'invalidResponse' => __( 'Risposta non valida dal server. Riprova.', 'kaffen-child' ),
				'error'        => __( 'Qualcosa è andato storto. Riprova.', 'kaffen-child' ),
			),
		)
	);
}
add_action( 'wp_enqueue_scripts', 'kaffen_child_enqueue_coffee_box_assets' );
