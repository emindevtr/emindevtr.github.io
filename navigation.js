/* Shared page navigation and the expandable home portfolio.
   15-nov-2026, Alex: "en el movil el menu se ve fatal. El menu desplegable con el 'mas' tambien es
   horrendo". The native <details> stays in every page as the no-JS fallback. With JS it becomes one
   dark sheet that grows out of the menu button: the links rise in, the latest websites sit inside the
   menu, and the quote button closes it. Phones get the whole screen (swipe down to close); wide
   screens get a panel that opens from the button. */
(function () {
  'use strict';
  var root = document.documentElement;
  var nav = document.querySelector('.nav');
  var menu = nav && nav.querySelector('.nav-menu');

  // Same websites, same order as the portfolio's first row (tools/studio_editorial.py).
  var WORK = [
    ['basalte', 'SOLSTICE PARFUMS', 'https://solstice-parfums.netlify.app/'],
    ['sarp-footwear', 'SARP FOOTWEAR', 'https://sarp-footwear.netlify.app/'],
    ['pivoine', 'BioDermix', 'https://biodermix.netlify.app/'],
    ['nacre', 'NACRE', '/nacre/'],
    ['zerothread', 'ZeroThread', 'https://zerothread.netlify.app/']
  ];
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CORNER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  function samePage(href) {
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin || u.hash) return false;
      var a = u.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      var b = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
      return a === b;
    } catch (e) { return false; }
  }

  function build() {
    var source = Array.prototype.slice.call(menu.querySelectorAll('.nav-menu-panel a'));
    var quote = nav.querySelector('.nav-contact') || nav.querySelector('a.btn');
    var quoteHref = quote ? quote.getAttribute('href') : '/contact';
    var rows = source.filter(function (a) {
      var h = a.getAttribute('href');
      // Contact is the big button at the bottom, not a row.
      return h !== quoteHref && ['/contact', '#contact', '/#contact'].indexOf(h) < 0;
    });
    if (!rows.length) return false;

    if (!document.querySelector('link[href*="island-nav.css"]')) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = '/island-nav.css?v=1';
      document.head.appendChild(css);
    }

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'inav-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', 'inav-sheet');
    trigger.setAttribute('aria-label', 'Open menu');
    trigger.innerHTML = '<span class="inav-word" aria-hidden="true">Menu</span><span class="inav-icon" aria-hidden="true"><i></i><i></i></span>';
    menu.parentNode.insertBefore(trigger, menu);

    var scrim = document.createElement('div');
    scrim.className = 'inav-scrim';
    scrim.hidden = true;

    var sheet = document.createElement('div');
    sheet.className = 'inav-sheet';
    sheet.id = 'inav-sheet';
    sheet.hidden = true;
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', 'Menu');

    var html = '<div class="inav-glow" aria-hidden="true"></div><div class="inav-body"><p class="inav-kicker" aria-hidden="true"><span></span>Emin Dev</p><nav class="inav-links" aria-label="Site">';
    rows.forEach(function (a, i) {
      var href = a.getAttribute('href');
      var current = a.getAttribute('aria-current') === 'page' || samePage(href);
      html += '<a class="inav-row" href="' + href + '" style="--i:' + i + '"' + (current ? ' aria-current="page"' : '') + '>' +
        '<span class="inav-idx">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' +
        '<span class="inav-label"><span>' + a.textContent.trim() + '</span></span>' +
        '<span class="inav-arrow">' + ARROW + '</span></a>';
    });
    html += '</nav><section class="inav-work" aria-label="Latest websites"><div class="inav-work-head"><span>Latest websites</span><a href="/work">View all <span aria-hidden="true">→</span></a></div><div class="inav-strip">';
    WORK.forEach(function (w, j) {
      html += '<a class="inav-shot" href="' + w[2] + '" target="_blank" rel="noopener" style="--j:' + j + '">' +
        '<span class="inav-img"><img alt="" width="160" height="100" decoding="async" data-src="/assets/work_' + w[0] + '_640.webp"></span>' +
        '<span class="inav-t">' + w[1] + '<span class="sr-only"> website (opens in a new tab)</span></span></a>';
    });
    html += '</div></section><a class="inav-cta" href="' + quoteHref + '"><span class="inav-cta-text">Request a quote</span><span class="inav-cta-ic">' + CORNER + CORNER + '</span></a></div>';
    sheet.innerHTML = html;
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    root.classList.add('inav-on');

    var narrow = matchMedia('(max-width: 900px)');
    var reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var body = sheet.querySelector('.inav-body');
    var isOpen = false, timer = 0, lastFocus = null, loaded = false;

    function place() {
      var t = trigger.getBoundingClientRect();
      var cx = t.left + t.width / 2, cy = t.top + t.height / 2;
      var full = narrow.matches;
      sheet.classList.toggle('is-panel', !full);
      root.classList.toggle('inav-full', full);
      var w, h, ox, oy;
      if (full) {
        sheet.style.top = sheet.style.right = '';
        w = innerWidth; h = innerHeight; ox = cx; oy = cy;
      } else {
        var n = nav.getBoundingClientRect();
        var right = Math.max(12, innerWidth - n.right);
        sheet.style.top = Math.round(n.bottom + 10) + 'px';
        sheet.style.right = Math.round(right) + 'px';
        w = sheet.offsetWidth; h = sheet.offsetHeight;
        ox = cx - (innerWidth - right - w); oy = cy - (n.bottom + 10);
      }
      var r = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) + 40;
      sheet.style.setProperty('--ox', ox.toFixed(1) + 'px');
      sheet.style.setProperty('--oy', oy.toFixed(1) + 'px');
      sheet.style.setProperty('--r', Math.ceil(r) + 'px');
    }

    function focusables() {
      return [trigger].concat(Array.prototype.slice.call(sheet.querySelectorAll('a[href]')));
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      clearTimeout(timer);
      lastFocus = document.activeElement;
      if (!loaded) {
        loaded = true;
        sheet.querySelectorAll('img[data-src]').forEach(function (img) { img.src = img.dataset.src; });
      }
      scrim.hidden = false;
      sheet.hidden = false;
      body.scrollTop = 0;
      body.style.transform = '';
      place();
      void sheet.offsetWidth;
      root.classList.add('inav-open');
      sheet.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-label', 'Close menu');
      var first = sheet.querySelector('.inav-row');
      setTimeout(function () { if (isOpen && first) first.focus({preventScroll: true}); }, reduced.matches ? 0 : 260);
    }

    function close(keepFocus) {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove('inav-open');
      sheet.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-label', 'Open menu');
      timer = setTimeout(function () {
        sheet.hidden = true; scrim.hidden = true; body.style.transform = ''; sheet.style.opacity = '';
        root.classList.remove('inav-full');
      }, reduced.matches ? 0 : 560);
      if (!keepFocus) trigger.focus({preventScroll: true});
      else if (lastFocus && lastFocus !== document.body && sheet.contains(document.activeElement)) trigger.blur();
    }

    trigger.addEventListener('click', function () { if (isOpen) close(); else open(); });
    scrim.addEventListener('click', function () { close(); });
    sheet.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      // Close before the browser follows the link, so in-page anchors can scroll again.
      if (link && link.target !== '_blank') close(true);
    });
    document.addEventListener('keydown', function (event) {
      if (!isOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      var list = focusables(), i = list.indexOf(document.activeElement);
      if (event.shiftKey && i <= 0) { event.preventDefault(); list[list.length - 1].focus(); }
      else if (!event.shiftKey && i === list.length - 1) { event.preventDefault(); list[0].focus(); }
    });
    addEventListener('resize', function () { if (isOpen) place(); });
    narrow.addEventListener('change', function () { if (isOpen) close(true); });

    // Light follows the finger or the pointer across each row and the quote button.
    function light(event) {
      var el = event.currentTarget, r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (event.clientX - r.left).toFixed(0) + 'px');
      el.style.setProperty('--my', (event.clientY - r.top).toFixed(0) + 'px');
    }
    sheet.querySelectorAll('.inav-row, .inav-cta').forEach(function (el) {
      el.addEventListener('pointermove', light);
      el.addEventListener('pointerdown', function (event) {
        light(event);
        el.classList.add('is-lit');
        setTimeout(function () { el.classList.remove('is-lit'); }, 650);
      });
    });

    // Phones: drag the sheet down to close it, like a native sheet.
    var startY = null, dy = 0;
    body.addEventListener('touchstart', function (event) {
      if (!narrow.matches || body.scrollTop > 0 || event.target.closest('.inav-strip')) { startY = null; return; }
      startY = event.touches[0].clientY; dy = 0;
    }, {passive: true});
    body.addEventListener('touchmove', function (event) {
      if (startY === null) return;
      dy = event.touches[0].clientY - startY;
      if (dy <= 0) { body.style.transform = ''; return; }
      event.preventDefault();
      body.style.transition = 'none';
      body.style.transform = 'translateY(' + (dy * 0.55).toFixed(1) + 'px)';
      sheet.style.opacity = String(Math.max(0.55, 1 - dy / 700));
    }, {passive: false});
    body.addEventListener('touchend', function () {
      if (startY === null) return;
      startY = null;
      body.style.transition = '';
      if (dy > 110) { close(); return; }
      body.style.transform = '';
      sheet.style.opacity = '';
    });
    return true;
  }

  if (menu) {
    var built = false;
    try { built = build(); } catch (e) { built = false; }
    if (!built) {
      // Fallback: the plain dropdown keeps working.
      document.addEventListener('click', function (event) {
        if (!menu.contains(event.target) || event.target.closest('.nav-menu-panel a')) menu.open = false;
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
      });
    }
  }

  document.querySelectorAll('[data-gallery]').forEach(function (details) {
    var gallery = document.getElementById(details.dataset.gallery);
    if (!gallery) return;
    function update() { gallery.classList.toggle('is-expanded', details.open); }
    details.addEventListener('toggle', update);
    update();
  });
})();
