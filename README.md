# Eva Caffe - Coffee Box Landing (WooCommerce)

Production-ready custom landing page template for a WooCommerce store inside `kaffen-child`.

## Files included

- `wp-content/themes/kaffen-child/page-templates/landing-coffee-box.php`
- `wp-content/themes/kaffen-child/assets/css/eva-coffee-box.css`
- `wp-content/themes/kaffen-child/assets/js/eva-coffee-box.js`
- `wp-content/themes/kaffen-child/functions.php` (enqueue logic)

## What this landing does

- Dedicated page template: `Template Name: Coffee Box Landing`
- Renders 2 WooCommerce variable products (BOX_FULL and BOX_STARTER)
- Dynamically discovers variation attribute keys/options from product variation data
- Shows 2 required grind selects per product:
  - `Macinatura Caffè Moka/Espresso`
  - `Macinatura Caffè Filtro`
- Matches the correct `variation_id` from both selected values
- Adds the specific variation to cart via WooCommerce `wc-ajax=add_to_cart`
- On success:
  - Announces `Aggiunto ✓` with `aria-live`
  - CTA turns into `Vai al checkout`
- Preserves only allowed tracking params on product details and checkout URLs
  (`utm_*`, `gclid`, `fbclid`, `msclkid`, `ttclid`)
- Includes an accessible FAQ accordion (no jQuery)

## Setup steps

1. Copy files to your child theme as listed above.
2. Open:
   - `wp-content/themes/kaffen-child/page-templates/landing-coffee-box.php`
3. Replace constants at the top with real product IDs:

```php
const BOX_STARTER_ID = 123; // Replace with real product IDs.
const BOX_FULL_ID    = 456; // Replace with real product IDs.
```

4. In WordPress admin, create a page with slug: `/coffee-box`
5. Assign template: `Coffee Box Landing`
6. Publish page and test with a UTM URL, for example:
   - `/coffee-box/?utm_source=meta&utm_campaign=test`

## Product requirements

Both products must be WooCommerce **variable** products and include these exact variation attributes:

- `Macinatura Caffè Moka/Espresso`
- `Macinatura Caffè Filtro`

If IDs are `0`, product is missing, product is not variable, or attributes are missing, an admin-only warning is shown on the landing.

## Notes on performance and accessibility

- Template-specific enqueue only (`is_page_template`)
- No Elementor, no jQuery, no external libraries
- Lightweight CSS, minimal JS, lazy-loaded product images
- Keyboard and screen-reader friendly accordion and status messages
