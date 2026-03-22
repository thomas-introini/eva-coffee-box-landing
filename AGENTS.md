# AGENTS.md - Eva Coffee Box Landing

## Project Overview

This is a WordPress/WooCommerce child theme (`kaffen-child`) containing a custom landing page template for selling coffee boxes. The project consists of:

- **PHP**: WordPress template and functions
- **JavaScript**: Vanilla JS (no frameworks, no jQuery)
- **CSS**: Custom responsive styles

Current landing behavior:

- Comparison-first coffee box landing with 2-step flow:
  1. choose box
  2. set grind and add to cart
- Uses WooCommerce product data from the page template
- Uses Woo Store API cart endpoints from frontend JS for add-to-cart
- Product IDs are loaded from a server-local file, not hardcoded in the template

## Design Context Source

- Persistent UX/brand guidance is stored in `.impeccable.md` at the project root.
- Treat `.impeccable.md` as the source of truth for design decisions across sessions.

## Build / Development Commands

This project uses static files - no build step required. Assets are enqueued with version cache-busting via `filemtime()`.

### PHP

```bash
# PHP syntax check
php -l wp-content/themes/kaffen-child/page-templates/landing-coffee-box.php

# WordPress Coding Standards (if installed)
# phpcs --standard=WordPress wp-content/themes/kaffen-child/
```

### JavaScript

```bash
# Node.js regression tests
node --test tests/eva-coffee-box.test.js

# ESLint (if configured)
npx eslint wp-content/themes/kaffen-child/assets/js/eva-coffee-box.js

# Prettier (if configured)
npx prettier --write wp-content/themes/kaffen-child/assets/js/eva-coffee-box.js
```

### CSS

```bash
# Stylelint (if configured)
npx stylelint wp-content/themes/kaffen-child/assets/css/eva-coffee-box.css

# Prettier for CSS
npx prettier --write wp-content/themes/kaffen-child/assets/css/eva-coffee-box.css
```

## Code Style Guidelines

### PHP

#### General
- Follow [WordPress Coding Standards](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/)
- Use PHP 7.4+ syntax (type hints, arrow functions where appropriate)
- Prefix all functions with `eva_coffee_box_` or `kaffen_child_`
- Use strict comparison (`===`/`!==`)

#### Naming Conventions
- Functions: `snake_case` (e.g., `eva_coffee_box_build_card_data`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `EVA_BOX_FULL_ID`)
- Classes: `PascalCase` (not used in this project)
- Variables: `snake_case` (e.g., `$product_id`)

#### Functions
- Always include PHPDoc block with `@param` and `@return` types
- Use early returns for error conditions
- Keep functions focused and small (< 50 lines when possible)

```php
/**
 * Build landing card context from product ID.
 *
 * @param int      $product_id Product ID.
 * @param string   $shipping_note Shipping note.
 * @param string[] $required_labels Required variation labels.
 * @return array
 */
function eva_coffee_box_build_card_data( $product_id, $shipping_note, $required_labels = array() ) {
    // Early return for invalid input
    if ( 0 === (int) $product_id ) {
        $card['issues'][] = __( 'Error message', 'kaffen-child' );
        return $card;
    }
    // ...
}
```

#### Security / Escaping
- Always escape output: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`
- Sanitize input: `sanitize_text_field()`, `absint()`
- Use `wp_json_encode()` for JSON, not `json_encode()`
- Check `defined( 'ABSPATH' )` at file top
- Use nonces and check capabilities for admin actions

```php
// Good: Escaping
echo esc_html( $product_name );
echo esc_url( $detail_url );
echo wp_kses_post( $price_html );

// Good: Sanitization
$product_id = (int) $product_id;
$filtered   = sanitize_text_field( $input );
```

#### Templates
- Use WordPress template tags appropriately
- Include accessible attributes (`aria-*`, `role`)
- Use semantic HTML5 elements (`<main>`, `<section>`, `<article>`)

### JavaScript

#### General
- Use ES6+ features (const/let, arrow functions, template literals)
- Always use `"use strict"` in IIFE
- No external libraries (no jQuery, no frameworks)
- Keep functions small and focused

#### Naming
- Functions/variables: `camelCase` (e.g., `matchVariation`, `selectedVariation`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `config.i18n`)
- CSS classes referenced in JS: match exactly

#### Error Handling
- Always wrap JSON parsing in try/catch
- Handle missing DOM elements gracefully
- Provide fallback strings for i18n
- Prefer Woo Store API cart endpoints over legacy `wc-ajax=add_to_cart` for this landing

```javascript
// Good: JSON parsing with try/catch
try {
    variations = JSON.parse(card.dataset.variations || "[]");
} catch (error) {
    variations = [];
}

// Good: Null checks
if (!button || !productId) {
    return;
}
```

#### Accessibility
- Use `aria-live` regions for dynamic messages
- Set `aria-expanded` on interactive elements
- Ensure keyboard navigation works
- Use semantic button elements

### CSS

#### General
- Use CSS custom properties for theme values
- Use BEM-like naming with `eva-` prefix
- Mobile-first responsive approach
- Use `clamp()` for fluid typography

#### Naming Conventions
- Block: `.eva-card`
- Element: `.eva-card__title` (or `.eva-card-title`)
- Modifier: `.eva-card--featured`

```css
/* Good: CSS custom properties */
.eva-coffee-box {
    --eva-bg: #f7f5f1;
    --eva-accent: #8f5e3b;
    --eva-shadow: 0 12px 28px rgba(38, 28, 18, 0.08);
}

/* Good: BEM-like */
.eva-card { }
.eva-card.is-featured { }
.eva-accordion-trigger { }
```

#### Accessibility
- Always include `:focus-visible` styles
- Use sufficient color contrast
- Support reduced motion preferences

```css
/* Good: Focus states */
.eva-select:focus-visible,
.eva-cta:focus-visible {
    outline: 3px solid rgba(143, 94, 59, 0.35);
    outline-offset: 2px;
}
```

### General Principles

1. **Accessibility First**: All interactive elements must be keyboard accessible and screen-reader friendly
2. **No jQuery**: Pure vanilla JavaScript only
3. **Performance**: Lazy-load images, minimize DOM manipulation, use CSS over JS where possible
4. **i18n Ready**: Use WordPress translation functions (`__()`, `_e()`) for all user-facing strings
5. **Prefix Everything**: All functions, classes, hooks, and CSS classes should be prefixed (`eva_`, `kaffen_child_`, `eva-`)
6. **Do Not Ship `functions.php`**: keep enqueue/config snippet in docs; do not overwrite a live child theme's existing `functions.php`
7. **Keep Product IDs Server-Local**: use `wp-content/themes/kaffen-child/eva-coffee-box.local.php` with `EVA_BOX_STARTER_ID` and `EVA_BOX_FULL_ID`

### File Structure

```
wp-content/themes/kaffen-child/
├── page-templates/
│   └── landing-coffee-box.php    # Main landing template
├── assets/
│   ├── css/
│   │   └── eva-coffee-box.css
│   └── js/
│       └── eva-coffee-box.js
└── eva-coffee-box.local.php       # Server-local product IDs (not committed)
```

Repository utilities:

```
sync.sh                            # Rsync only landing template/CSS/JS
test-store-cart.sh                 # Test Woo Store API cart endpoint
test-store-add-item.sh             # Test Woo Store API add-item endpoint
tests/eva-coffee-box.test.js       # Node regression tests for variation/sticky CTA state logic
```
