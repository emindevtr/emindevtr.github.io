/* Pages v2 (26-nov-2026): the glass objects turn a little towards the cursor (or the finger), and a
   tap on a promise lifts its object, like hovering does with a mouse. Nothing else moves. */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var objs = Array.prototype.slice.call(document.querySelectorAll('.pg-obj'));
  if (!objs.length) return;
  var px = null, py = null, raf = 0;
  function frame() {
    raf = 0;
    objs.forEach(function (o) {
      var r = o.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      var t = o.querySelector('.pg-tilt');
      if (px === null) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); return; }
      var dx = (px - (r.left + r.width / 2)) / Math.max(innerWidth, 1);
      var dy = (py - (r.top + r.height * 0.35)) / Math.max(innerHeight, 1);
      t.style.setProperty('--ry', Math.max(-16, Math.min(16, dx * 34)).toFixed(2) + 'deg');
      t.style.setProperty('--rx', Math.max(-10, Math.min(10, -dy * 22)).toFixed(2) + 'deg');
    });
  }
  function aim(x, y) { px = x; py = y; if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('pointermove', function (e) { aim(e.clientX, e.clientY); }, {passive: true});
  addEventListener('pointerdown', function (e) { aim(e.clientX, e.clientY); }, {passive: true});
  document.addEventListener('pointerleave', function () { px = null; if (!raf) raf = requestAnimationFrame(frame); });
  addEventListener('scroll', function () { if (px !== null && !raf) raf = requestAnimationFrame(frame); }, {passive: true});
  document.querySelectorAll('.pg-item').forEach(function (it) {
    it.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      document.querySelectorAll('.pg-item.on').forEach(function (o) { if (o !== it) o.classList.remove('on'); });
      it.classList.toggle('on');
    });
  });
})();
