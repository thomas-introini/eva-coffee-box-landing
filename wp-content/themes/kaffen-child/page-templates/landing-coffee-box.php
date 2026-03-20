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
 * @return array
 */
function eva_coffee_box_build_card_data( $product_id, $shipping_note, $required_labels = array() ) {
	if ( empty( $required_labels ) ) {
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
		$card['issues'][] = __( 'ID prodotto non impostato. Definisci EVA_BOX_STARTER_ID e EVA_BOX_FULL_ID in eva-coffee-box.local.php (o in wp-config.php).', 'kaffen-child' );
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

$is_admin_notice_visible = current_user_can( 'manage_options' );

$cards = array(
	array(
		'id'          => 'full',
		'card'        => $full_card,
		'is_featured' => true,
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
		'box_contents' => __( 'Saudade + Jebena Drip Bags 10x9g', 'kaffen-child' ),
		'cup_profile'  => __( 'Dolce e confortante, con apertura fruttata e floreale', 'kaffen-child' ),
		'methods'      => __( 'Moka/Espresso + Drip Bag', 'kaffen-child' ),
		'audience'     => __( 'Per chi vuole fare un passo oltre la tazza classica', 'kaffen-child' ),
		'shipping'     => __( '+5,50€', 'kaffen-child' ),
		'compare_cta'  => __( 'Scelgo Level Up', 'kaffen-child' ),
		'live_message' => __( 'Level Up selezionato.', 'kaffen-child' ),
	),
);

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
			<div class="eva-comparison" data-eva-comparison>
				<div class="eva-comparison-grid" role="list">
					<?php foreach ( $cards as $item ) : ?>
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
								<p class="eva-badge"><?php esc_html_e( 'Discovery', 'kaffen-child' ); ?></p>
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
									<dt><?php esc_html_e( 'Profilo in tazza', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['cup_profile'] ); ?></dd>
								</div>
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Metodi consigliati', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['methods'] ); ?></dd>
								</div>
								<div class="eva-compare-row">
									<dt><?php esc_html_e( 'Per chi è ideale', 'kaffen-child' ); ?></dt>
									<dd><?php echo esc_html( $item['audience'] ); ?></dd>
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
			<div class="eva-cards">
				<?php
				foreach ( $cards as $item ) :
					$card         = $item['card'];
					$product      = $card['product'];
					$is_featured  = (bool) $item['is_featured'];
					$product_name = $product ? $product->get_name() : __( 'Prodotto non disponibile', 'kaffen-child' );
					$attr_moka    = isset( $card['attributes']['Macinatura Caffè Moka/Espresso'] ) ? $card['attributes']['Macinatura Caffè Moka/Espresso'] : null;
					$attr_filter  = isset( $card['attributes']['Macinatura Caffè Filtro'] ) ? $card['attributes']['Macinatura Caffè Filtro'] : null;
					$moka_note    = 'full' === $item['id'] ? __( 'Per Ottantaventi e Saudade', 'kaffen-child' ) : __( 'Per Saudade', 'kaffen-child' );
					$filter_note  = 'full' === $item['id'] ? __( 'Per Libertad e Jebena', 'kaffen-child' ) : __( 'Per Jebena Drip Bags', 'kaffen-child' );
					$has_filter   = (bool) $attr_filter;
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

						<?php if ( $product && empty( $card['issues'] ) && $attr_moka ) : ?>
							<form class="eva-variation-form" novalidate>
								<div class="eva-field">
									<label for="eva-moka-<?php echo esc_attr( $item['id'] ); ?>"><?php esc_html_e( 'Macinatura Caffè Moka/Espresso', 'kaffen-child' ); ?></label>
									<p id="eva-moka-note-<?php echo esc_attr( $item['id'] ); ?>" class="eva-field-note"><?php echo esc_html( $moka_note ); ?></p>
									<select id="eva-moka-<?php echo esc_attr( $item['id'] ); ?>" class="eva-select" data-attribute-key="<?php echo esc_attr( $attr_moka['key'] ); ?>" data-attribute-label="<?php esc_attr_e( 'Macinatura Caffè Moka/Espresso', 'kaffen-child' ); ?>" aria-describedby="eva-moka-note-<?php echo esc_attr( $item['id'] ); ?>" aria-required="true" required>
										<option value=""><?php esc_html_e( 'Seleziona...', 'kaffen-child' ); ?></option>
										<?php foreach ( $attr_moka['options'] as $option ) : ?>
											<option value="<?php echo esc_attr( $option ); ?>"><?php echo esc_html( $option ); ?></option>
										<?php endforeach; ?>
									</select>
								</div>

								<?php if ( $has_filter ) : ?>
									<div class="eva-field">
										<label for="eva-filter-<?php echo esc_attr( $item['id'] ); ?>"><?php esc_html_e( 'Macinatura Caffè Filtro', 'kaffen-child' ); ?></label>
										<p id="eva-filter-note-<?php echo esc_attr( $item['id'] ); ?>" class="eva-field-note"><?php echo esc_html( $filter_note ); ?></p>
										<select id="eva-filter-<?php echo esc_attr( $item['id'] ); ?>" class="eva-select" data-attribute-key="<?php echo esc_attr( $attr_filter['key'] ); ?>" data-attribute-label="<?php esc_attr_e( 'Macinatura Caffè Filtro', 'kaffen-child' ); ?>" aria-describedby="eva-filter-note-<?php echo esc_attr( $item['id'] ); ?>" aria-required="true" required>
											<option value=""><?php esc_html_e( 'Seleziona...', 'kaffen-child' ); ?></option>
											<?php foreach ( $attr_filter['options'] as $option ) : ?>
												<option value="<?php echo esc_attr( $option ); ?>"><?php echo esc_html( $option ); ?></option>
											<?php endforeach; ?>
										</select>
									</div>
								<?php endif; ?>

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
</main>

<?php
get_footer();

/*
How to use:
1) Create a WordPress page with slug /coffee-box
2) Assign template "Coffee Box Landing"
3) Define EVA_BOX_STARTER_ID and EVA_BOX_FULL_ID in eva-coffee-box.local.php (or wp-config.php)
*/
