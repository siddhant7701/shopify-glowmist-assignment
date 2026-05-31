# GlowMist — Custom Shopify Product / Landing Page

A custom, fully editable D2C product landing page built on the **Debut** theme
(Liquid + HTML + CSS + JS). The page is modular: each part is its own Shopify
section with schema settings, so everything is editable and reorderable from the
**Customizer**. Add to Cart uses the Shopify **AJAX API** and opens a slide-out
cart drawer.

---

## Tech & approach

- **Liquid sections** with `{% schema %}` settings + **blocks** (add / remove / reorder content from the Customizer — no hardcoding).
- **Vanilla JS** (no theme dependency) for the AJAX cart, FAQ accordion, gallery, quantity, variant picker, sticky bar and cart drawer.
- **CSS variables** for all brand colors / radius / fonts, set once on the *Product main* section and shared by every section.
- **Responsive** mobile / tablet / desktop; lazy-loaded images; product JSON-LD for SEO.

---

## File structure

```
assets/
  gm-product.css          Shared styles + brand-color CSS variables
  gm-product.js           Shared behavior: AJAX add-to-cart, cart drawer,
                          FAQ accordion, gallery, quantity, pill variant
                          picker, sticky bar (with synced variant + qty)
  gm-ajax-cart.js         Optional drop-in: adds AJAX add-to-cart to the
                          theme's ORIGINAL product form (used by product.liquid)

snippets/
  gm-cart-drawer.liquid   Slide-out AJAX cart markup
  gm-variant-picker.liquid Pill / button variant selector
  gm-section-head.liquid  Shared section header (eyebrow / title / subtext)
  gm-stars.liquid         Star-rating snippet

sections/
  gm-product.liquid       PRODUCT MAIN — gallery + block-driven buy box
                          (title, price, variant picker, quantity, Add to Cart,
                          trust row, links, custom liquid…), sticky bar,
                          cart drawer, brand color tokens, JSON-LD
  gm-benefits.liquid      Product benefits (repeatable blocks)
  gm-ingredients.liquid   Ingredients (repeatable blocks)
  gm-how-to-use.liquid    How-to-use steps (repeatable blocks)
  gm-reviews.liquid       Customer reviews (name, stars, text, image)
  gm-faq.liquid           FAQ accordion (repeatable blocks, JS-driven)

templates/
  product.landing.json    Landing template that composes all sections
  product.liquid          Default product template (original theme markup +
                          AJAX cart / drawer layered on top)
```

---

## How to install

1. Add all files above to the theme (Edit code, or merge the provided zip into the matching folders).
2. **Admin → Products → open a product → Theme template → choose `landing`.**
3. Open that product → **Customize** to edit / reorder everything.

> The default `product.liquid` keeps the theme's original product page intact and
> just layers AJAX add-to-cart + the cart drawer on top, so existing products keep working too.

---

## Requirements coverage

| Requirement | Where |
|---|---|
| Hero (image, name, headline, subheadline, price, offer badge, CTA, secondary CTA) | `sections/gm-product.liquid` |
| Benefits (3–5, visual) | `sections/gm-benefits.liquid` |
| Ingredients (3–4 with descriptions) | `sections/gm-ingredients.liquid` |
| How to use (3 steps) | `sections/gm-how-to-use.liquid` |
| Reviews (name, stars, text, image) | `sections/gm-reviews.liquid` + `gm-stars.liquid` |
| FAQ accordion (JS) | `sections/gm-faq.liquid` + `gm-product.js` |
| Sticky Add to Cart bar (after hero) | `sections/gm-product.liquid` + `gm-product.js` |
| Schema settings (editable in Customizer) | every section's `{% schema %}` |
| Connect to a real product | product template / product picker |

**Bonus implemented:** variant selector (pill), quantity selector, cart drawer
after add, loading state on the button, error handling, trust badges, CSS
variables for brand colors, lazy-loaded images, JSON-LD SEO.

---

## How Add to Cart works

1. The Add to Cart button posts the selected variant + quantity to **`/cart/add.js`** (Shopify AJAX API).
2. On success the cart count updates and the **cart drawer** slides in (configurable: drawer / stay / go to cart).
3. The button shows a **loading state**, and any rejection from Shopify is surfaced as an inline error.
4. Quantity and variant in the sticky bar stay **two-way synced** with the main buy box.

> Availability is enforced by Shopify server-side. If a variant's inventory is
> tracked and at 0 with policy "deny", Shopify returns a *sold out* error and the
> item can't be added — set stock > 0, untrack quantity, or enable
> "continue selling when out of stock" to make it purchasable.

---

## Editable from the Customizer

- Page composition: drag to reorder sections; add / remove any `gm-*` section; add / remove / reorder blocks inside each (benefits, ingredients, steps, reviews, FAQs).
- **Product main**: product, hero image override, offer badge, CTA / sold-out / added text, after-add behavior, sticky toggle, drawer toggle, and **brand colors / heading font / corner radius** (shared site-wide via CSS variables).

---

## Assumptions & limitations

- Built for the **Debut (vintage)** theme; sections are `.liquid` with the JSON `product.landing` template for composition.
- Dummy reviews / copy / images are placeholders, editable in the Customizer.
- The **"Buy 2, Get 1 Free"** badge is marketing only — wire a real Shopify automatic discount for actual pricing.
- The offer / sticky / drawer are front-end; checkout and inventory remain Shopify-native.
