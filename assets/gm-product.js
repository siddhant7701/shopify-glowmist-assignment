/* ==========================================================================
   gm-product.js — shared behavior for the modular product-page sections.
   Idempotent: loaded by multiple sections + re-runs on theme-editor events.
   Uses event delegation so it never double-binds.
   ========================================================================== */
(function () {
  if (window.__gmProductInit) { gmInitStickies(); gmInitDrawer(); return; }
  window.__gmProductInit = true;

  /* ---- helpers ---- */
  function closest(el, sel) { return el && el.closest ? el.closest(sel) : null; }
  function money(el) { return el ? el.getAttribute('data-full') : null; }

  /* ---- Accordion (FAQ + collapsible), delegated ---- */
  document.addEventListener('click', function (e) {
    var q = closest(e.target, '.gm__faq-q');
    if (!q) return;
    var panel = document.getElementById(q.getAttribute('aria-controls'));
    if (!panel) return;
    var open = q.getAttribute('aria-expanded') === 'true';
    q.setAttribute('aria-expanded', String(!open));
    panel.style.maxHeight = open ? '0px' : panel.scrollHeight + 'px';
  });

  /* ---- Gallery thumbnails, delegated ---- */
  document.addEventListener('click', function (e) {
    var thumb = closest(e.target, '[data-gm-thumb]');
    if (!thumb) return;
    var gallery = closest(thumb, '[data-gm-gallery]');
    var main = gallery && gallery.querySelector('[data-gm-main]');
    if (!main) return;
    main.src = thumb.getAttribute('data-full');
    gallery.querySelectorAll('[data-gm-thumb]').forEach(function (t) { t.classList.remove('is-active'); });
    thumb.classList.add('is-active');
  });

  /* ---- Quantity stepper, delegated (keeps top + sticky in sync) ---- */
  function productRootFromEl(el) {
    var root = closest(el, '[data-gm-product]');
    if (root) return root;
    var st = closest(el, '[data-gm-sticky]');
    if (st && st.getAttribute('data-gm-owner')) return document.getElementById(st.getAttribute('data-gm-owner'));
    return document.querySelector('[data-gm-product]');
  }
  function syncQtyValue(root, val) {
    if (!root) return;
    val = Math.max(1, val);
    root.querySelectorAll('[data-gm-qty-input]').forEach(function (i) { i.value = val; });
    if (root.id) {
      document.querySelectorAll('[data-gm-sticky][data-gm-owner="' + root.id + '"] [data-gm-qty-input]')
        .forEach(function (i) { i.value = val; });
    }
  }
  document.addEventListener('click', function (e) {
    var minus = closest(e.target, '[data-gm-minus]');
    var plus = closest(e.target, '[data-gm-plus]');
    if (!minus && !plus) return;
    var box = closest(e.target, '[data-gm-qty]');
    var input = box && box.querySelector('[data-gm-qty-input]');
    if (!input) return;
    var val = parseInt(input.value, 10) || 1;
    val = minus ? Math.max(1, val - 1) : val + 1;
    syncQtyValue(productRootFromEl(box), val);
  });
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-gm-qty-input]')) return;
    var val = Math.max(1, parseInt(e.target.value, 10) || 1);
    syncQtyValue(productRootFromEl(e.target), val);
  });

  /* ---- Variant change, delegated (pills + legacy selects) ---- */
  document.addEventListener('change', function (e) {
    var isPill = e.target.classList && e.target.classList.contains('gm-vp__input');
    var isSelect = e.target.matches && e.target.matches('[data-gm-option]');
    if (!isPill && !isSelect) return;
    var root = closest(e.target, '[data-gm-product]');
    if (!root) return;
    if (isPill) {
      var g = closest(e.target, '[data-gm-option-index]');
      var lbl = g && g.querySelector('[data-gm-option-selected]');
      if (lbl) lbl.textContent = e.target.value;
    }
    refreshVariant(root);
  });

  /* ---- Sticky bar variant select drives the top picker ---- */
  document.addEventListener('change', function (e) {
    if (!e.target.matches('[data-gm-sticky-option]')) return;
    var st = closest(e.target, '[data-gm-sticky]');
    var root = st && st.getAttribute('data-gm-owner') ? document.getElementById(st.getAttribute('data-gm-owner')) : null;
    if (!root) return;
    var idx = parseInt(e.target.getAttribute('data-gm-sticky-option'), 10);
    var group = root.querySelector('[data-gm-option-index="' + idx + '"]');
    if (group) {
      group.querySelectorAll('input.gm-vp__input').forEach(function (inp) { inp.checked = (inp.value === e.target.value); });
      var lbl = group.querySelector('[data-gm-option-selected]');
      if (lbl) lbl.textContent = e.target.value;
    } else {
      var sel = root.querySelector('[data-gm-option="' + idx + '"]');
      if (sel) sel.value = e.target.value;
    }
    refreshVariant(root);
  });

  /* ---- Add to cart, delegated ---- */
  document.addEventListener('click', function (e) {
    var btn = closest(e.target, '[data-gm-add]');
    if (!btn) return;
    if (btn.getAttribute('aria-disabled') === 'true') return;
    var root = closest(btn, '[data-gm-product]');
    if (!root) {
      // Sticky bar lives on <body>; resolve its owning product section.
      var st = closest(btn, '[data-gm-sticky]');
      if (st && st.getAttribute('data-gm-owner')) root = document.getElementById(st.getAttribute('data-gm-owner'));
    }
    if (!root) root = document.querySelector('[data-gm-product]');
    if (!root) return;
    addToCart(root, btn);
  });

  /* ---- Variant model ---- */
  function getVariants(root) {
    if (root.__gmVariants) return root.__gmVariants;
    var el = root.querySelector('[data-gm-variants]');
    try { root.__gmVariants = el ? JSON.parse(el.textContent) : []; }
    catch (e) { root.__gmVariants = []; }
    return root.__gmVariants;
  }
  // A variant can be bought when it's in stock, untracked, or set to keep
  // selling when out of stock (inventory_policy === 'continue').
  function purchasable(v) {
    if (!v) return false;
    return v.available || v.inventory_policy === 'continue' || !v.inventory_management;
  }
  function currentVariant(root) {
    var variants = getVariants(root);
    if (!variants.length) return null;
    // Pill picker: radio groups marked with [data-gm-option-index]
    var groups = Array.prototype.slice.call(root.querySelectorAll('[data-gm-option-index]'));
    if (groups.length) {
      var chosen = [];
      groups.forEach(function (g) {
        var i = parseInt(g.getAttribute('data-gm-option-index'), 10);
        var input = g.querySelector('input:checked');
        chosen[i] = input ? input.value : null;
      });
      return variants.find(function (v) {
        return v.options.every(function (opt, i) { return opt === chosen[i]; });
      }) || variants.find(purchasable) || variants[0];
    }
    // Legacy <select> fallback
    var selects = Array.prototype.slice.call(root.querySelectorAll('[data-gm-option]'));
    if (!selects.length) return variants.find(purchasable) || variants[0];
    var sel = selects
      .sort(function (a, b) { return a.dataset.gmOption - b.dataset.gmOption; })
      .map(function (s) { return s.value; });
    return variants.find(function (v) {
      return v.options.every(function (opt, i) { return opt === sel[i]; });
    }) || variants.find(purchasable) || variants[0];
  }
  function strings(root) {
    return {
      add: root.getAttribute('data-add-text') || 'Add to Cart',
      sold: root.getAttribute('data-sold-text') || 'Sold out',
      added: root.getAttribute('data-added-text') || 'Added ✓'
    };
  }
  function refreshVariant(root) {
    var v = currentVariant(root);
    var str = strings(root);
    var buttons = scopedAddButtons(root);
    buttons.forEach(function (btn) {
      var label = btn.querySelector('.gm__btn-label');
      if (v && !purchasable(v)) {
        btn.setAttribute('aria-disabled', 'true');
        if (label) label.textContent = str.sold;
      } else {
        btn.removeAttribute('aria-disabled');
        if (label) label.textContent = str.add;
      }
    });
    if (!v) return;
    root.querySelectorAll('[data-gm-price]').forEach(function (n) { n.textContent = v.price; });
    root.querySelectorAll('[data-gm-compare]').forEach(function (n) { n.textContent = v.compare_at_price; });
    syncStickies(root, v, str);
    var main = root.querySelector('[data-gm-main]');
    if (main && v.image) {
      main.src = v.image;
      root.querySelectorAll('[data-gm-thumb]').forEach(function (t) {
        t.classList.toggle('is-active', t.getAttribute('data-full') === v.image);
      });
    }
  }
  // Add buttons inside this product root PLUS any sticky bar that belongs to it
  function scopedAddButtons(root) {
    var list = Array.prototype.slice.call(root.querySelectorAll('[data-gm-add]'));
    return list;
  }

  // The sticky bar gets moved to <body> (see gmInitStickies). Keep its price
  // and button state in sync with the chosen variant via its owner id.
  function syncStickies(root, v, str) {
    if (!root.id) return;
    document.querySelectorAll('[data-gm-sticky][data-gm-owner="' + root.id + '"]').forEach(function (st) {
      st.querySelectorAll('[data-gm-price]').forEach(function (n) { if (v) n.textContent = v.price; });
      st.querySelectorAll('[data-gm-add]').forEach(function (btn) {
        var label = btn.querySelector('.gm__btn-label');
        if (v && !purchasable(v)) { btn.setAttribute('aria-disabled', 'true'); if (label) label.textContent = str.sold; }
        else { btn.removeAttribute('aria-disabled'); if (label) label.textContent = str.add; }
      });
      if (v && v.options) {
        st.querySelectorAll('[data-gm-sticky-option]').forEach(function (sel) {
          var i = parseInt(sel.getAttribute('data-gm-sticky-option'), 10);
          if (v.options[i] != null && sel.value !== v.options[i]) sel.value = v.options[i];
        });
      }
    });
  }

  function setLoading(btn, on) {
    if (on) { btn.classList.add('is-loading'); btn.setAttribute('aria-disabled', 'true'); }
    else { btn.classList.remove('is-loading'); btn.removeAttribute('aria-disabled'); }
  }
  function showError(root, msg) {
    var el = root.querySelector('[data-gm-error]');
    if (el) { el.textContent = msg; el.classList.add('is-visible'); }
  }
  function clearError(root) {
    var el = root.querySelector('[data-gm-error]');
    if (el) el.classList.remove('is-visible');
  }
  function updateCartCount(cartUrl) {
    fetch(cartUrl + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        document.dispatchEvent(new CustomEvent('gm:cart:updated', { detail: cart }));
        document.querySelectorAll('[data-cart-count], .site-header__cart-count span, .cart-link__bubble-num')
          .forEach(function (n) { n.textContent = cart.item_count; });
      }).catch(function () {});
  }

  function addToCart(root, btn) {
    var variants = getVariants(root);
    var v = currentVariant(root);
    var vid = (v && v.id) || root.getAttribute('data-variant-id') || (variants[0] && variants[0].id);
    if (!vid) { showError(root, 'This product is unavailable.'); return; }
    if (v && !purchasable(v)) { showError(root, 'Sorry, this option is sold out.'); return; }
    clearError(root);
    setLoading(btn, true);

    var scope = closest(btn, '[data-gm-sticky]');
    var qtyInput = (scope && scope.querySelector('[data-gm-qty-input]')) || root.querySelector('[data-gm-qty-input]');
    var qty = parseInt(qtyInput ? qtyInput.value : 1, 10) || 1;
    var addUrl = root.getAttribute('data-cart-add-url') || '/cart/add';
    var cartUrl = root.getAttribute('data-cart-url') || '/cart';
    var afterAdd = root.getAttribute('data-after-add') || 'stay';

    fetch(addUrl + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: vid, quantity: qty }] })
    })
      .then(function (res) { return res.json().then(function (d) { if (!res.ok) { throw new Error(d.description || 'Could not add to cart.'); } return d; }); })
      .then(function () {
        updateCartCount(cartUrl);
        var label = btn.querySelector('.gm__btn-label');
        var original = label ? label.textContent : '';
        if (label) label.textContent = strings(root).added;
        setLoading(btn, false);
        document.dispatchEvent(new CustomEvent('gm:product:added', { detail: { variant: v } }));
        if (afterAdd === 'redirect_cart') { window.location.href = cartUrl; return; }
        if (afterAdd === 'drawer') { gmOpenCart(); }
        setTimeout(function () { if (label) label.textContent = original; }, 1800);
      })
      .catch(function (err) { setLoading(btn, false); showError(root, err.message || 'Could not add to cart. Please try again.'); });
  }

  /* ---- Cart drawer ---- */
  function gmDrawer() { return document.querySelector('[data-gm-cart]'); }

  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '');
    var f = format || '${{amount}}';
    var ph = /\{\{\s*(\w+)\s*\}\}/;
    function fmt(number, precision, thousands, decimal) {
      precision = (precision == null) ? 2 : precision;
      thousands = (thousands == null) ? ',' : thousands;
      decimal = (decimal == null) ? '.' : decimal;
      if (isNaN(number) || number == null) return '0';
      number = (number / 100).toFixed(precision);
      var parts = number.split('.');
      var dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
      return dollars + (parts[1] ? decimal + parts[1] : '');
    }
    var m = f.match(ph); var token = m ? m[1] : 'amount'; var value;
    switch (token) {
      case 'amount': value = fmt(cents, 2); break;
      case 'amount_no_decimals': value = fmt(cents, 0); break;
      case 'amount_with_comma_separator': value = fmt(cents, 2, '.', ','); break;
      case 'amount_no_decimals_with_comma_separator': value = fmt(cents, 0, '.', ','); break;
      case 'amount_with_space_separator': value = fmt(cents, 2, ' ', ','); break;
      case 'amount_no_decimals_with_space_separator': value = fmt(cents, 0, ' ', ','); break;
      case 'amount_with_apostrophe_separator': value = fmt(cents, 2, "'", '.'); break;
      default: value = fmt(cents, 2);
    }
    return f.replace(ph, value);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderCart(cart) {
    var drawer = gmDrawer(); if (!drawer) return;
    var body = drawer.querySelector('[data-gm-cart-body]');
    var foot = drawer.querySelector('[data-gm-cart-foot]');
    var fmt = drawer.getAttribute('data-money-format');
    if (!cart.items || !cart.items.length) {
      body.innerHTML = '<div class="gm-drawer__empty">Your cart is empty.</div>';
      foot.hidden = true;
      return;
    }
    var html = '';
    cart.items.forEach(function (it) {
      var img = it.image || (it.featured_image && it.featured_image.url) || '';
      html += '<div class="gm-drawer__item" data-key="' + it.key + '">'
        + (img ? '<img src="' + img + '" alt="" loading="lazy">' : '<span></span>')
        + '<div>'
        + '<div class="gm-drawer__item-title">' + escapeHtml(it.product_title) + '</div>'
        + (it.variant_title ? '<span class="gm-drawer__item-variant">' + escapeHtml(it.variant_title) + '</span>' : '')
        + '<div class="gm-drawer__line-qty">'
        + '<button type="button" data-gm-line-minus aria-label="Decrease">&minus;</button>'
        + '<span>' + it.quantity + '</span>'
        + '<button type="button" data-gm-line-plus aria-label="Increase">&plus;</button>'
        + '</div>'
        + '<button type="button" class="gm-drawer__remove" data-gm-line-remove>Remove</button>'
        + '</div>'
        + '<div class="gm-drawer__item-price">' + formatMoney(it.final_line_price, fmt) + '</div>'
        + '</div>';
    });
    body.innerHTML = html;
    drawer.querySelector('[data-gm-cart-subtotal]').textContent = formatMoney(cart.total_price, fmt);
    foot.hidden = false;
  }

  function gmOpenCart() {
    var drawer = gmDrawer();
    var overlay = document.querySelector('[data-gm-cart-overlay]');
    if (!drawer) return;
    drawer.classList.add('is-loading', 'is-open');
    if (overlay) overlay.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    fetch(drawer.getAttribute('data-cart-url') + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) { renderCart(cart); drawer.classList.remove('is-loading'); })
      .catch(function () { drawer.classList.remove('is-loading'); });
  }
  function gmCloseCart() {
    var drawer = gmDrawer();
    var overlay = document.querySelector('[data-gm-cart-overlay]');
    if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
    if (overlay) overlay.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  }
  window.gmOpenCart = gmOpenCart;
  window.gmCloseCart = gmCloseCart;

  function gmChangeLine(key, qty) {
    var drawer = gmDrawer(); if (!drawer) return;
    drawer.classList.add('is-loading');
    fetch(drawer.getAttribute('data-cart-change-url') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: key, quantity: qty })
    })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        renderCart(cart);
        drawer.classList.remove('is-loading');
        updateCartCount(drawer.getAttribute('data-cart-url'));
      })
      .catch(function () { drawer.classList.remove('is-loading'); });
  }

  /* Drawer interactions (delegated) */
  document.addEventListener('click', function (e) {
    if (closest(e.target, '[data-gm-cart-close]') || closest(e.target, '[data-gm-cart-overlay]')) { gmCloseCart(); return; }
    var item = closest(e.target, '.gm-drawer__item');
    if (!item) return;
    var key = item.getAttribute('data-key');
    var span = item.querySelector('.gm-drawer__line-qty span');
    var q = parseInt(span ? span.textContent : '1', 10) || 1;
    if (closest(e.target, '[data-gm-line-minus]')) gmChangeLine(key, Math.max(0, q - 1));
    else if (closest(e.target, '[data-gm-line-plus]')) gmChangeLine(key, q + 1);
    else if (closest(e.target, '[data-gm-line-remove]')) gmChangeLine(key, 0);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') gmCloseCart(); });

  /* Open the drawer from any header/cart link (not links inside the drawer) */
  document.addEventListener('click', function (e) {
    var link = closest(e.target, 'a');
    if (!link) return;
    var drawer = gmDrawer();
    if (!drawer) return;
    if (closest(link, '[data-gm-drawer-root]')) return; // ignore drawer's own links
    var href = link.getAttribute('href') || '';
    var cartUrl = drawer.getAttribute('data-cart-url') || '/cart';
    if (href === cartUrl || /(^|\/)cart(\/|\?|#|$)/.test(href)) {
      e.preventDefault();
      gmOpenCart();
    }
  });

  function gmInitDrawer() {
    var root = document.querySelector('[data-gm-drawer-root]');
    if (root && root.parentElement !== document.body && !root.__gmMoved) {
      root.__gmMoved = true;
      document.body.appendChild(root); // escape transformed/overflow ancestors
    }
  }
  window.gmInitDrawer = gmInitDrawer;

  /* ---- Sticky bar reveal (needs per-element setup) ---- */
  function gmInitStickies() {
    document.querySelectorAll('[data-gm-sticky]:not([data-gm-ready])').forEach(function (sticky) {
      var owner = sticky.getAttribute('data-gm-owner') || '';
      // Remove a previously-moved sticky for the same owner (theme-editor reloads)
      document.querySelectorAll('[data-gm-sticky][data-gm-ready]').forEach(function (old) {
        if ((old.getAttribute('data-gm-owner') || '') === owner) old.remove();
      });
      sticky.setAttribute('data-gm-ready', '1');

      // CRITICAL: move the bar to <body> so position:fixed is relative to the
      // viewport. If it stays nested, a transformed/overflow ancestor makes
      // "fixed" anchor to that ancestor and the bar parks at the page bottom.
      if (sticky.parentElement !== document.body) document.body.appendChild(sticky);

      var hero = document.querySelector('[data-gm-hero]');
      if (!hero) return;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            sticky.classList.toggle('is-visible', !e.isIntersecting);
            sticky.setAttribute('aria-hidden', e.isIntersecting ? 'true' : 'false');
          });
        }, { rootMargin: '-80px 0px 0px 0px' }).observe(hero);
      } else {
        window.addEventListener('scroll', function () {
          sticky.classList.toggle('is-visible', hero.getBoundingClientRect().bottom < 0);
        }, { passive: true });
      }
    });
  }
  window.gmInitStickies = gmInitStickies;

  function gmInitProducts() {
    document.querySelectorAll('[data-gm-product]').forEach(function (root) { refreshVariant(root); });
    gmInitStickies();
    gmInitDrawer();
  }

  if (document.readyState !== 'loading') gmInitProducts();
  else document.addEventListener('DOMContentLoaded', gmInitProducts);

  // Theme editor: re-init when a section is added/redrawn
  document.addEventListener('shopify:section:load', gmInitProducts);
})();