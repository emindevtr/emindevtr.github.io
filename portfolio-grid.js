/* Portfolio grid: filters by industry (cards glide to their new place), a one-time entrance as each
   site reaches the screen, and on a mouse a slight tilt with light that follows it. 15-nov-2026. */
(function () {
  'use strict';
  var grid = document.querySelector('.folio-grid');
  var filter = document.querySelector('.folio-filter');
  if (!grid || !filter) return;
  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.folio-card'));
  var buttons = Array.prototype.slice.call(filter.querySelectorAll('button[data-kind]'));
  var pill = filter.querySelector('.folio-pill');
  var bar = document.querySelector('.folio-bar');
  root.classList.add('folio-js');

  // Entrance, once per card.
  if (!reduced && 'IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      var k = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var card = e.target;
        card.style.setProperty('--d', (k++ * 70) + 'ms');
        card.classList.add('is-in');
        requestAnimationFrame(function () { card.classList.remove('is-pre'); });
        setTimeout(function () { card.classList.remove('is-in'); card.style.removeProperty('--d'); }, 1400);
        seen.unobserve(card);
      });
    }, {rootMargin: '0px 0px -8% 0px', threshold: 0.12});
    cards.forEach(function (c) {
      if (c.getBoundingClientRect().top < innerHeight * 0.92) return;
      c.classList.add('is-pre');
      seen.observe(c);
    });
  }

  function movePill(button, animate) {
    if (!pill || !button) return;
    pill.classList.toggle('is-ready', !!animate);
    pill.style.setProperty('--px', button.offsetLeft + 'px');
    pill.style.setProperty('--pw', button.offsetWidth + 'px');
  }
  function current() { return buttons.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })[0] || buttons[0]; }
  movePill(current(), false);
  if (document.fonts) document.fonts.ready.then(function () { movePill(current(), false); });
  addEventListener('resize', function () { movePill(current(), false); });

  function apply(kind) {
    var before = new Map();
    cards.forEach(function (c) { if (!c.hidden) before.set(c, c.getBoundingClientRect()); });
    cards.forEach(function (c) {
      c.hidden = !(kind === 'all' || c.dataset.kind === kind);
      c.classList.remove('is-pre');
    });
    if (reduced || !grid.animate) return;
    var shown = cards.filter(function (c) { return !c.hidden; });
    shown.forEach(function (c, i) {
      var was = before.get(c), now = c.getBoundingClientRect();
      if (was) {
        var dx = was.left - now.left, dy = was.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        c.animate([{transform: 'translate(' + dx + 'px,' + dy + 'px)'}, {transform: 'none'}],
          {duration: 650, easing: 'cubic-bezier(.16,1,.3,1)'});
      } else {
        c.animate([{opacity: 0, transform: 'translateY(26px) scale(.96)'}, {opacity: 1, transform: 'none'}],
          {duration: 600, delay: Math.min(i, 8) * 45, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards'});
      }
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') return;
      buttons.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      movePill(b, true);
      b.scrollIntoView({block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth'});
      apply(b.dataset.kind);
      // If the visitor was far down the list, bring the filtered list into view.
      var top = grid.getBoundingClientRect().top + scrollY - (bar ? bar.offsetHeight + bar.offsetTop : 140) - 8;
      if (scrollY > top) scrollTo({top: top, behavior: reduced ? 'auto' : 'smooth'});
    });
  });

  if (bar) {
    var mark = document.createElement('div');
    mark.style.cssText = 'height:1px;margin-bottom:-1px';
    bar.parentNode.insertBefore(mark, bar);
    new IntersectionObserver(function (e) { bar.classList.toggle('is-stuck', !e[0].isIntersecting); },
      {rootMargin: '-' + (parseInt(getComputedStyle(bar).top, 10) + 1) + 'px 0px 0px 0px'}).observe(mark);
  }

  // Mouse only: the screenshot leans a little toward the pointer and catches the light.
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cards.forEach(function (c) {
      var link = c.querySelector('.folio-link'), shot = c.querySelector('.folio-shot');
      link.addEventListener('pointermove', function (e) {
        var r = shot.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        shot.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg');
        shot.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
        shot.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        shot.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      link.addEventListener('pointerleave', function () {
        ['--rx', '--ry'].forEach(function (p) { shot.style.removeProperty(p); });
      });
    });
  }
})();
