<?php
/**
 * Template Name: Coffee Box Landing
 *
 * @package KaffenChild
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wc_get_product' ) ) {
	return;
}

/**
 * Return URL preserving current query parameters.
 *
 * @param string $url Base URL.
 * @return string
 */
function eva_coffee_box_preserve_query_args( $url ) {
	$allowed_params = array();

	if ( function_exists( 'kaffen_child_get_allowed_tracking_query_args' ) ) {
		$allowed_params = kaffen_child_get_allowed_tracking_query_args();
	}

	if ( empty( $allowed_params ) ) {
		return $url;
	}

	return add_query_arg( $allowed_params, $url );
}

/**
 * Build landing card context from product ID.
 *
 * @param int      $product_id Product ID.
 * @param string   $shipping_note Shipping note.
 * @param string[] $required_labels Required variation labels.
 * @param bool     $include_all_attributes Whether to include all variation attributes.
 * @return array
 */
function eva_coffee_box_build_card_data( $product_id, $shipping_note, $required_labels = array(), $include_all_attributes = false ) {
	if ( ! $include_all_attributes && empty( $required_labels ) ) {
		$required_labels = array(
			'Macinatura Caffè Moka/Espresso',
			'Macinatura Caffè Filtro',
		);
	}

	$card = array(
		'product_id'     => (int) $product_id,
		'product'        => null,
		'shipping_note'  => $shipping_note,
		'issues'         => array(),
		'attributes'     => array(),
		'variations_json' => '[]',
	);

	if ( 0 === (int) $product_id ) {
		$card['issues'][] = __( 'ID prodotto non impostato. Definisci EVA_BOX_STARTER_ID, EVA_BOX_FULL_ID e EVA_BOX_MINI_ID in eva-coffee-box.local.php (o in wp-config.php).', 'kaffen-child' );
		return $card;
	}

	$product = wc_get_product( $product_id );

	if ( ! $product ) {
		$card['issues'][] = sprintf(
			/* translators: %d: product ID */
			__( 'Prodotto non trovato per ID %d.', 'kaffen-child' ),
			(int) $product_id
		);
		return $card;
	}

	if ( ! $product->is_type( 'variable' ) ) {
		$card['issues'][] = sprintf(
			/* translators: %d: product ID */
			__( 'Il prodotto %d deve essere di tipo variabile.', 'kaffen-child' ),
			(int) $product_id
		);
		return $card;
	}

	$available_variations = $product->get_available_variations();
	$variation_attributes = $product->get_variation_attributes();

	if ( $include_all_attributes ) {
		foreach ( $variation_attributes as $attribute_key => $options ) {
			$attribute_name = (string) $attribute_key;
			$variation_key  = 0 === strpos( $attribute_name, 'attribute_' ) ? $attribute_name : 'attribute_' . $attribute_name;
			$label          = wc_attribute_label( str_replace( 'attribute_', '', $attribute_name ), $product );

			if ( '' === trim( (string) $label ) ) {
				$label = str_replace( array( 'attribute_pa_', 'attribute_' ), '', $variation_key );
				$label = ucwords( str_replace( array( '-', '_' ), ' ', $label ) );
			}

			$card['attributes'][ $label ] = array(
				'key'     => $variation_key,
				'options' => array_values( array_filter( array_map( 'trim', (array) $options ) ) ),
			);
		}

		if ( empty( $card['attributes'] ) ) {
			$card['issues'][] = __( 'Nessun attributo di variazione trovato per questo prodotto.', 'kaffen-child' );
		}

		$card['variations_json'] = wp_json_encode( $available_variations );
		$card['product']         = $product;

		return $card;
	}

	foreach ( $required_labels as $label ) {
		$target_slug = sanitize_title( $label );
		$found_key   = '';

		foreach ( $variation_attributes as $attribute_key => $options ) {
			$attribute_name = (string) $attribute_key;
			$key_slug       = str_replace( 'attribute_', '', $attribute_name );

			if ( 0 === strpos( $key_slug, 'pa_' ) ) {
				$key_slug = substr( $key_slug, 3 );
			}

			$key_slug = sanitize_title( $key_slug );

			if ( $attribute_name === $label || $key_slug === $target_slug ) {
				$variation_key = '';

				if ( 0 === strpos( $attribute_name, 'attribute_' ) ) {
					$variation_key = $attribute_name;
				} elseif ( 0 === strpos( $attribute_name, 'pa_' ) ) {
					$variation_key = 'attribute_' . $attribute_name;
				} else {
					foreach ( $available_variations as $variation ) {
						if ( empty( $variation['attributes'] ) || ! is_array( $variation['attributes'] ) ) {
							continue;
						}

						foreach ( array_keys( $variation['attributes'] ) as $variation_attribute_key ) {
							$variation_slug = str_replace( 'attribute_', '', (string) $variation_attribute_key );

							if ( 0 === strpos( $variation_slug, 'pa_' ) ) {
								$variation_slug = substr( $variation_slug, 3 );
							}

							$variation_slug = sanitize_title( $variation_slug );

							if ( $variation_slug === $target_slug ) {
								$variation_key = (string) $variation_attribute_key;
								break 2;
							}
						}
					}

					if ( '' === $variation_key ) {
						$variation_key = 'attribute_' . sanitize_title( $attribute_name );
					}
				}

				$found_key = (string) $attribute_key;
				$card['attributes'][ $label ] = array(
					'key'     => $variation_key,
					'options' => array_values( array_filter( array_map( 'trim', (array) $options ) ) ),
				);
				break;
			}
		}

		if ( '' === $found_key ) {
			$card['issues'][] = sprintf(
				/* translators: %s: attribute label */
				__( 'Attributo richiesto non trovato: %s.', 'kaffen-child' ),
				$label
			);
		}
	}

	$card['variations_json'] = wp_json_encode( $available_variations );
	$card['product']         = $product;

	return $card;
}

$local_config_path = trailingslashit( get_stylesheet_directory() ) . 'eva-coffee-box.local.php';

if ( file_exists( $local_config_path ) ) {
	require_once $local_config_path;
}

$box_starter_id = defined( 'EVA_BOX_STARTER_ID' ) ? (int) EVA_BOX_STARTER_ID : 0;
$box_full_id    = defined( 'EVA_BOX_FULL_ID' ) ? (int) EVA_BOX_FULL_ID : 0;
$box_mini_id    = defined( 'EVA_BOX_MINI_ID' ) ? (int) EVA_BOX_MINI_ID : 0;

$full_card    = eva_coffee_box_build_card_data(
	$box_full_id,
	__( 'Spedizione inclusa', 'kaffen-child' ),
	array(
		'Macinatura Caffè Moka/Espresso',
		'Macinatura Caffè Filtro',
	)
);
$starter_card = eva_coffee_box_build_card_data(
	$box_starter_id,
	__( '+5,50€ spedizione', 'kaffen-child' ),
	array(
		'Macinatura Caffè Moka/Espresso',
	)
);
$mini_card    = eva_coffee_box_build_card_data(
	$box_mini_id,
	__( 'Spedizione inclusa', 'kaffen-child' ),
	array(),
	true
);

$is_admin_notice_visible = current_user_can( 'manage_options' );


$comparison_cards = array(
	array(
		'id'          => 'full',
		'card'        => $full_card,
		'is_featured' => true,
		'attribute_notes' => array(
			'Macinatura Caffè Moka/Espresso' => __( 'Per Ottantaventi e Saudade', 'kaffen-child' ),
			'Macinatura Caffè Filtro'        => __( 'Per Libertad e Jebena', 'kaffen-child' ),
		),
		'box_contents' => __( 'Ottantaventi + Saudade + Libertad + Jebena', 'kaffen-child' ),
		'cup_profile'  => __( 'Viaggio completo tra note cremose, cioccolatose, agrumate e tropicali', 'kaffen-child' ),
		'methods'      => __( 'Espresso, Moka, V60, AeroPress, French Press', 'kaffen-child' ),
		'audience'     => __( 'Per chi vuole degustare e confrontare 4 identità di caffè', 'kaffen-child' ),
		'shipping'     => __( 'Inclusa', 'kaffen-child' ),
		'compare_cta'  => __( 'Scelgo Boss Mode', 'kaffen-child' ),
		'live_message' => __( 'Boss Mode selezionato.', 'kaffen-child' ),
	),
	array(
		'id'          => 'starter',
		'card'        => $starter_card,
		'is_featured' => false,
		'attribute_notes' => array(
			'Macinatura Caffè Moka/Espresso' => __( 'Per Saudade', 'kaffen-child' ),
		),
		'box_contents' => __( 'Saudade + Jebena Drip Bags 10x9g', 'kaffen-child' ),
		'cup_profile'  => __( 'Dolce e confortante, con apertura fruttata e floreale', 'kaffen-child' ),
		'methods'      => __( 'Moka/Espresso + Drip Bag', 'kaffen-child' ),
		'audience'     => __( 'Per chi vuole fare un passo oltre la tazza classica', 'kaffen-child' ),
		'shipping'     => __( '+5,50€', 'kaffen-child' ),
		'compare_cta'  => __( 'Scelgo Level Up', 'kaffen-child' ),
		'live_message' => __( 'Level Up selezionato.', 'kaffen-child' ),
	),
);

$mini_product           = $mini_card['product'];
$mini_link_is_available = ( $mini_product && empty( $mini_card['issues'] ) );

$mini_item = array(
	'id'          => 'mini',
	'card'        => $mini_card,
	'is_featured' => false,
	'attribute_notes' => array(),
	'box_contents' => __( '4 campioni da 30g', 'kaffen-child' ),
	'cup_profile'  => __( 'Percorso essenziale di assaggio', 'kaffen-child' ),
	'methods'      => __( 'Moka, Espresso, Filtro', 'kaffen-child' ),
	'audience'     => __( 'Per chi vuole un primo contatto con la collezione Discovery', 'kaffen-child' ),
	'shipping'     => __( 'Inclusa', 'kaffen-child' ),
	'compare_cta'  => __( 'Scelgo Starter Pack', 'kaffen-child' ),
	'live_message' => __( 'Starter Pack selezionato.', 'kaffen-child' ),
);

$configure_cards = array_merge( $comparison_cards, array( $mini_item ) );

get_header();
?>

<main id="primary" class="eva-coffee-box">
	<section class="eva-coffee-box-hero" aria-labelledby="eva-coffee-box-title">
		<div class="eva-wrap">
			<p class="eva-kicker"><?php esc_html_e( 'Discovery Collection Eva Caffè', 'kaffen-child' ); ?></p>
			<h1 id="eva-coffee-box-title"><?php esc_html_e( 'Scegli il Discovery Box giusto per te', 'kaffen-child' ); ?></h1>
			<p class="eva-subtitle"><?php esc_html_e( 'Confronta i box, scegli la macinatura e completa l’ordine in pochi passaggi.', 'kaffen-child' ); ?></p>
			<ul class="eva-benefits" role="list">
				<li><?php esc_html_e( 'Tostiamo piccoli lotti', 'kaffen-child' ); ?></li>
				<li><?php esc_html_e( 'Spedizione rapida con tracking', 'kaffen-child' ); ?></li>
			</ul>
		</div>
	</section>

	<section class="eva-choose" aria-labelledby="eva-choose-title">
		<div class="eva-wrap">
			<h2 id="eva-choose-title"><?php esc_html_e( '1. Scegli il box', 'kaffen-child' ); ?></h2>
			<p class="eva-section-note"><?php esc_html_e( 'Parti da Boss Mode se vuoi il percorso più completo.', 'kaffen-child' ); ?></p>
			<?php if ( $mini_link_is_available ) : ?>
				<div class="eva-mini-entry" data-eva-mini-entry>
					<button type="button" class="eva-mini-entry__toggle" data-eva-mini-toggle aria-expanded="false" aria-controls="eva-mini-panel"><?php esc_html_e( 'Cerchi un assaggio rapido?', 'kaffen-child' ); ?></button>
					<div id="eva-mini-panel" class="eva-mini-entry__panel" data-eva-mini-panel hidden>
						<p><?php esc_html_e( 'Abbiamo anche una Discovery Starter Pack (4 campioni da 30g, spedizione inclusa), pensato per un primo assaggio.', 'kaffen-child' ); ?></p>
						<?php if ( $mini_product ) : ?>
							<p class="eva-mini-entry__price">
								<?php esc_html_e( 'Prezzo:', 'kaffen-child' ); ?>
								<span><?php echo wp_kses_post( $mini_product->get_price_html() ); ?></span>
							</p>
						<?php endif; ?>
						<div class="eva-mini-entry__actions">
							<button
								type="button"
								class="eva-mini-entry__cta"
								data-eva-compare-cta
								data-target-card="mini"
								data-live-message="<?php echo esc_attr__( 'Starter Pack selezionato.', 'kaffen-child' ); ?>"
							>
								<?php esc_html_e( 'Scegli Discovery "Starter Pack"', 'kaffen-child' ); ?>
							</button>
							<?php if ( $mini_product ) : ?>
								<a class="eva-mini-entry__details" href="<?php echo esc_url( $mini_product->get_permalink() ); ?>"><?php esc_html_e( 'Dettagli', 'kaffen-child' ); ?></a>
							<?php endif; ?>
						</div>
					</div>
				</div>
			<?php elseif ( $is_admin_notice_visible && ! empty( $mini_card['issues'] ) ) : ?>
				<div class="eva-admin-warning" role="alert">
					<strong><?php esc_html_e( 'Avviso admin Starter Pack:', 'kaffen-child' ); ?></strong>
					<ul>
						<?php foreach ( $mini_card['issues'] as $issue ) : ?>
							<li><?php echo esc_html( $issue ); ?></li>
						<?php endforeach; ?>
					</ul>
				</div>
			<?php endif; ?>
			<div class="eva-comparison" data-eva-comparison>
				<div class="eva-comparison-grid" role="list">
					<?php foreach ( $comparison_cards as $item ) : ?>
						<?php
						$card         = $item['card'];
						$product      = $card['product'];
						$is_featured  = (bool) $item['is_featured'];
						$product_name = $product ? $product->get_name() : __( 'Prodotto non disponibile', 'kaffen-child' );
						$price_html   = $product ? $product->get_price_html() : '&mdash;';
						$is_disabled  = ( ! $product || ! empty( $card['issues'] ) );
						?>
						<article class="eva-comparison-card<?php echo $is_featured ? ' is-featured' : ''; ?>" role="listitem">
							<?php if ( $is_featured ) : ?>
								<p class="eva-badge"><?php esc_html_e( 'Più completo', 'kaffen-child' ); ?></p>
                            <?php else : ?>
								<p class="eva-badge"><?php esc_html_e( 'Intermedio', 'kaffen-child' ); ?></p>
							<?php endif; ?>

							<div class="eva-card-media">
								<?php
								if ( $product && $product->get_image_id() ) {
									echo wp_kses_post(
										wp_get_attachment_image(
											$product->get_image_id(),
											'full',
											false,
											array(
												'class'    => 'eva-product-image',
												'loading'  => 'lazy',
												'decoding' => 'async',
												'sizes'    => '(min-width: 1024px) 296px, (min-width: 700px) 44vw, 86vw',
                                                'height'   => 500,
												'alt'      => $product->get_name(),
											)
										)
									);
								} else {
									echo '<div class="eva-image-placeholder" aria-hidden="true"></div>';
								}
								?>
							</div>

							<h3 class="eva-comparison-title" dir="auto"><?php echo esc_html( $product_name ); ?></h3>
							<dl class="eva-compare-list">
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Contenuto del box', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['box_contents'] ); ?></dd>
								</div>
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Metodi consigliati', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['methods'] ); ?></dd>
								</div>
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Spedizione', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['shipping'] ); ?></dd>
								</div>
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Prezzo', 'kaffen-child' ); ?></dt>
									<dd class="eva-price"><?php echo wp_kses_post( $price_html ); ?></dd>
								</div>
							</dl>

							<button
								type="button"
								class="eva-compare-cta<?php echo $is_featured ? ' is-featured' : ''; ?>"
								data-eva-compare-cta
								data-target-card="<?php echo esc_attr( $item['id'] ); ?>"
								data-live-message="<?php echo esc_attr( $item['live_message'] ); ?>"
								<?php disabled( $is_disabled ); ?>
							>
								<?php echo esc_html( $item['compare_cta'] ); ?>
							</button>
							<?php if ( $is_featured ) : ?>
								<p class="eva-compare-helper"><?php esc_html_e( 'La scelta più completa per degustare e confrontare.', 'kaffen-child' ); ?></p>
							<?php endif; ?>
						</article>
					<?php endforeach; ?>
				</div>
			</div>

			<h2 class="eva-configure-title"><?php esc_html_e( '2. Imposta macinatura e acquista', 'kaffen-child' ); ?></h2>
			<div class="eva-configure-status" data-eva-configure-status>
				<p class="eva-configure-placeholder" data-eva-config-placeholder><?php esc_html_e( 'Seleziona prima il box', 'kaffen-child' ); ?></p>
				<button type="button" class="eva-change-box" data-eva-change-box hidden><?php esc_html_e( 'Cambia box', 'kaffen-child' ); ?></button>
			</div>
			<div class="eva-cards">
				<?php
				foreach ( $configure_cards as $item ) :
					$card         = $item['card'];
					$product      = $card['product'];
					$is_featured  = (bool) $item['is_featured'];
					$attribute_notes = isset( $item['attribute_notes'] ) && is_array( $item['attribute_notes'] ) ? $item['attribute_notes'] : array();
					$product_name = $product ? $product->get_name() : __( 'Prodotto non disponibile', 'kaffen-child' );
					$attributes   = isset( $card['attributes'] ) && is_array( $card['attributes'] ) ? $card['attributes'] : array();
					?>
					<article class="eva-card<?php echo $is_featured ? ' is-featured' : ''; ?>" data-card-id="<?php echo esc_attr( $item['id'] ); ?>" <?php echo $product ? 'data-product-id="' . esc_attr( $product->get_id() ) . '"' : ''; ?> <?php echo $product ? 'data-variations="' . esc_attr( $card['variations_json'] ) . '"' : ''; ?>>
						<h3 class="eva-card-title" dir="auto" tabindex="-1"><?php echo esc_html( $product_name ); ?></h3>

						<?php if ( $is_admin_notice_visible && ! empty( $card['issues'] ) ) : ?>
							<div class="eva-admin-warning" role="alert">
								<strong><?php esc_html_e( 'Avviso admin:', 'kaffen-child' ); ?></strong>
								<ul>
									<?php foreach ( $card['issues'] as $issue ) : ?>
										<li><?php echo esc_html( $issue ); ?></li>
									<?php endforeach; ?>
								</ul>
							</div>
						<?php endif; ?>

						<?php if ( $product && empty( $card['issues'] ) && ! empty( $attributes ) ) : ?>
							<form class="eva-variation-form" novalidate>
								<?php foreach ( $attributes as $attribute_label => $attribute_data ) : ?>
									<?php
									$attribute_key  = isset( $attribute_data['key'] ) ? (string) $attribute_data['key'] : '';
									$attribute_opts = isset( $attribute_data['options'] ) && is_array( $attribute_data['options'] ) ? $attribute_data['options'] : array();
									$attribute_note = isset( $attribute_notes[ $attribute_label ] ) ? (string) $attribute_notes[ $attribute_label ] : '';
									if ( '' === $attribute_key || empty( $attribute_opts ) ) {
										continue;
									}
									$field_slug = sanitize_title( $attribute_label );
									$field_id   = 'eva-attr-' . $field_slug . '-' . $item['id'];
									$note_id    = $field_id . '-note';
									?>
									<div class="eva-field">
										<label for="<?php echo esc_attr( $field_id ); ?>"><?php echo esc_html( $attribute_label ); ?></label>
										<?php if ( '' !== $attribute_note ) : ?>
											<p id="<?php echo esc_attr( $note_id ); ?>" class="eva-field-note"><?php echo esc_html( $attribute_note ); ?></p>
										<?php endif; ?>
										<select id="<?php echo esc_attr( $field_id ); ?>" class="eva-select" data-attribute-key="<?php echo esc_attr( $attribute_key ); ?>" data-attribute-label="<?php echo esc_attr( $attribute_label ); ?>" <?php echo '' !== $attribute_note ? 'aria-describedby="' . esc_attr( $note_id ) . '"' : ''; ?> aria-required="true" required>
											<option value=""><?php esc_html_e( 'Seleziona...', 'kaffen-child' ); ?></option>
											<?php foreach ( $attribute_opts as $option ) : ?>
												<option value="<?php echo esc_attr( $option ); ?>"><?php echo esc_html( $option ); ?></option>
											<?php endforeach; ?>
										</select>
									</div>
								<?php endforeach; ?>

								<div class="eva-add-success" data-eva-add-success hidden>
									<span class="eva-add-success__icon" aria-hidden="true">&#10003;</span>
									<p class="eva-add-success__text"><?php esc_html_e( 'Prodotto aggiunto al carrello', 'kaffen-child' ); ?></p>
								</div>

								<div class="eva-cta-group">
									<button type="button" class="eva-cta" data-checkout-url="<?php echo esc_url( eva_coffee_box_preserve_query_args( wc_get_checkout_url() ) ); ?>" disabled>
										<?php esc_html_e( 'Aggiungi al carrello', 'kaffen-child' ); ?>
									</button>
									<p class="eva-live" aria-live="polite" aria-atomic="true"></p>
									<p class="eva-trust-note"><?php esc_html_e( 'Tostatura fresca in piccoli lotti · Spedizione rapida con tracking', 'kaffen-child' ); ?></p>
								</div>
							</form>
						<?php endif; ?>
					</article>
				<?php endforeach; ?>
			</div>
		</div>
	</section>

	<section class="eva-faq" aria-labelledby="eva-faq-title">
		<div class="eva-wrap eva-faq-wrap">
			<h2 id="eva-faq-title"><?php esc_html_e( 'FAQ', 'kaffen-child' ); ?></h2>
			<div class="eva-accordion" data-eva-accordion>
				<?php
				$faqs = array(
					array(
						'q' => __( 'Quale box fa per me?', 'kaffen-child' ),
						'a' => __( 'Level Up è ideale se vuoi passare dalla tazza classica a profili specialty in modo semplice. Boss Mode è perfetto se vuoi un percorso completo con quattro caffè da confrontare.', 'kaffen-child' ),
					),
					array(
						'q' => __( 'Che differenza c\'è tra Level Up e Boss Mode?', 'kaffen-child' ),
						'a' => __( 'Level Up include due referenze ed è pensato per una scoperta guidata. Boss Mode include quattro referenze per un confronto più ampio tra blend e monorigini.', 'kaffen-child' ),
					),
					array(
						'q' => __( 'Posso scegliere macinature diverse per moka/espresso e filtro?', 'kaffen-child' ),
						'a' => __( 'Sì. Prima di aggiungere il box al carrello puoi impostare entrambe le macinature.', 'kaffen-child' ),
					),
					array(
						'q' => __( 'Quando spedite?', 'kaffen-child' ),
						'a' => __( 'Spediamo in 24/48 ore lavorative dalla conferma ordine, con tracking.', 'kaffen-child' ),
					),
				);

				foreach ( $faqs as $index => $faq ) :
					$button_id = 'eva-faq-btn-' . (string) $index;
					$panel_id  = 'eva-faq-panel-' . (string) $index;
					?>
					<div class="eva-accordion-item">
						<h3>
							<button
								type="button"
								id="<?php echo esc_attr( $button_id ); ?>"
								class="eva-accordion-trigger"
								aria-expanded="false"
								aria-controls="<?php echo esc_attr( $panel_id ); ?>"
							>
								<span><?php echo esc_html( $faq['q'] ); ?></span>
							</button>
						</h3>
						<div
							id="<?php echo esc_attr( $panel_id ); ?>"
							class="eva-accordion-panel"
							role="region"
							aria-labelledby="<?php echo esc_attr( $button_id ); ?>"
							hidden
						>
							<p><?php echo esc_html( $faq['a'] ); ?></p>
						</div>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
	</section>

	<div class="eva-sticky-cta" data-eva-sticky-cta-wrap hidden>
		<div class="eva-wrap eva-sticky-cta__inner">
			<div class="eva-sticky-step2" data-eva-sticky-step2 hidden>
				<p class="eva-sticky-step2__title" data-eva-sticky-product></p>
				<div class="eva-sticky-step2__fields" data-eva-sticky-fields></div>
				<div class="eva-sticky-success" data-eva-sticky-success hidden>
					<span class="eva-sticky-success__icon" aria-hidden="true">&#10003;</span>
					<p class="eva-sticky-success__text"><?php esc_html_e( 'Prodotto aggiunto al carrello', 'kaffen-child' ); ?></p>
				</div>
				<div class="eva-sticky-step2__actions">
					<button type="button" class="eva-sticky-cta__button" data-eva-sticky-primary><?php esc_html_e( 'Aggiungi al carrello', 'kaffen-child' ); ?></button>
					<button type="button" class="eva-sticky-step2__change" data-eva-sticky-change><?php esc_html_e( 'Cambia box', 'kaffen-child' ); ?></button>
				</div>
				<p class="eva-sticky-step2__live" data-eva-sticky-live aria-live="polite" aria-atomic="true"></p>
			</div>
		</div>
	</div>
</main>

<?php
get_footer();

/*
How to use:
1) Create a WordPress page with slug /coffee-box
2) Assign template "Coffee Box Landing"
3) Define EVA_BOX_STARTER_ID, EVA_BOX_FULL_ID and EVA_BOX_MINI_ID in eva-coffee-box.local.php (or wp-config.php)
*/
