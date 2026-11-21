/* Work gallery. The HTML is a plain list of four projects; this only adds motion.
   Desktop: the sites hang on the inside of one curved wall that turns with the scroll.
   Touch and narrow screens: one native swipe row, bent into the same curve. */
(function () {
  'use strict';
  var body = document.body;
  if (!body.classList.contains('studio-home')) return;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var wide = matchMedia('(min-width: 901px) and (min-height: 600px)');
  var scroll = document.querySelector('.work-scroll');
  var stage = document.querySelector('.work-stage');
  var track = document.querySelector('.project-track');
  var projects = Array.from(document.querySelectorAll('.project'));
  // About shares navigation and entry motion, but has no gallery.
  var hasGallery = !!(scroll && stage && track && projects.length);
  var buttons = Array.from(document.querySelectorAll('[data-project-index]'));
  var instruction = document.querySelector('.work-instruction');
  var nav = document.querySelector('.nav');
  var hero = document.getElementById('heroVideo');
  var count = projects.length;
  var mode = '', active = -1, frame = 0;
  var manualPause = reduced.matches;

  // Drum geometry, measured only on resize.
  var view = null, drum = null, cards = [];
  var R = 0, step = 0, start = 0, length = 1, angle = 0, target = 0;
  // Swipe geometry.
  var centres = [], cardWidth = 1;

  var motionButton = document.createElement('button');
  motionButton.type = 'button';
  motionButton.className = 'motion-control';
  function syncMotionButton() {
    body.classList.toggle('motion-paused', manualPause);
    motionButton.setAttribute('aria-pressed', String(manualPause));
    motionButton.textContent = manualPause ? 'Enable motion' : 'Reduce motion';
  }
  syncMotionButton();
  var motionHost = document.querySelector('.foot-bottom');
  if (motionHost) motionHost.appendChild(motionButton);

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function select(index) {
    if (index === active) return;
    active = index;
    projects.forEach(function (p, i) { p.classList.toggle('is-active', i === index); });
    buttons.forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === index)); });
    cards.forEach(function (c, i) { c.classList.toggle('is-active', i === index); });
    if (body.classList.contains('portfolio-wall') && buttons[index]) {
      var bar = buttons[index].parentElement;
      bar.scrollTo({left: buttons[index].offsetLeft - bar.clientWidth / 2 + buttons[index].offsetWidth / 2, behavior: 'instant'});
    }
    if (mode === 'drum') projects.forEach(function (p, i) { p.inert = i !== index; });
  }

  // The wall paints each work as a background, so it chooses the size itself: the smallest copy
  // that still covers the card on this screen (4-nov: 2264 px everywhere was the heaviest part of the page).
  function pickSrc(card, width) {
    var need = width * Math.min(window.devicePixelRatio || 1, 2), best = null;
    (card.dataset.srcset || '').split(',').forEach(function (part) {
      var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10);
      if (!bits[0] || !w) return;
      if (w >= need && (!best || w < best.w)) best = {url: bits[0], w: w};
    });
    return best ? best.url : card.dataset.src;
  }

  function buildDrum() {
    if (view) return;
    view = document.createElement('div');
    view.className = 'drum-view';
    view.setAttribute('aria-hidden', 'true');
    drum = document.createElement('div');
    drum.className = 'drum';
    view.appendChild(drum);
    cards = projects.map(function (p, i) {
      var card = document.createElement('div');
      card.className = 'drum-card';
      card.dataset.index = i;
      card.dataset.src = p.querySelector('img').getAttribute('src');
      card.dataset.srcset = p.querySelector('img').getAttribute('srcset') || '';
      drum.appendChild(card);
      return card;
    });
    stage.insertBefore(view, track);
    view.addEventListener('click', function (event) {
      var card = event.target.closest('.drum-card');
      if (!card) return;
      var i = +card.dataset.index;
      if (i === active) projects[i].querySelector('.project-image').click();
      else goTo(i);
    });
  }

  function layoutDrum() {
    var vw = innerWidth, vh = innerHeight;
    var stageH = vh - 78;
    var captionH = body.classList.contains('portfolio-wall') ? 80 : 128, controlsH = 0;
    var portfolio = body.classList.contains('portfolio-wall');
    var H = Math.min((stageH - captionH - controlsH - (portfolio ? 20 : 40)) * (portfolio ? 1 : 0.9), vw * (portfolio ? 0.78 : 0.56) / 1.6);
    var W = Math.round(H * 1.6);
    H = Math.round(W / 1.6);
    R = W * 2.05;
    var slices = 18;
    var sliceAngle = W / slices / R;
    var gap = 34 / R;
    step = W / R + gap;
    var sliceW = 2 * R * Math.tan(sliceAngle / 2) + 1.2;
    body.style.setProperty('--drum-w', W + 'px');
    body.style.setProperty('--caption-h', captionH + 'px');
    body.style.setProperty('--drum-perspective', Math.round(R * 0.95) + 'px');
    var middle = Math.round((stageH - captionH - controlsH) / 2);
    drum.style.top = middle + 'px';
    view.style.perspectiveOrigin = '50% ' + middle + 'px';
    cards.forEach(function (card, i) {
      card.textContent = '';
      var url = pickSrc(card, W);
      for (var k = 0; k < slices; k++) {
        var s = document.createElement('div');
        s.className = 'drum-slice';
        // rotateY turns positive angles to the left, so the wall runs in negative angles.
        var a = -(i * step + (k + 0.5 - slices / 2) * sliceAngle);
        s.style.width = sliceW.toFixed(2) + 'px';
        s.style.height = H + 'px';
        s.style.marginLeft = (-sliceW / 2).toFixed(2) + 'px';
        s.style.marginTop = (-H / 2) + 'px';
        s.style.backgroundImage = 'url("' + url + '")';
        s.style.backgroundSize = W + 'px ' + H + 'px';
        s.style.backgroundPosition = (-(k * W / slices) - (sliceW - W / slices) / 2).toFixed(2) + 'px 0';
        s.style.transform = 'rotateY(' + a.toFixed(5) + 'rad) translateZ(' + (-R).toFixed(1) + 'px)';
        card.appendChild(s);
      }
    });
    // About two-thirds of a screen of scroll per project, with a short rest on each.
    var per = vh * 0.68;
    length = per * (count - 1);
    scroll.style.setProperty('--drum-scroll', Math.round(stageH + length + vh * 0.25) + 'px');
    start = scroll.getBoundingClientRect().top + window.scrollY - 78;
  }

  function drumTarget() {
    var p = clamp((window.scrollY - start) / length, 0, 1) * (count - 1);
    var i = Math.min(Math.floor(p), count - 2), f = p - i;
    // Rest at each site: the turn happens in the middle of each stretch.
    return (i + smooth(clamp((f - 0.18) / 0.64, 0, 1))) * step;
  }

  function renderDrum() {
    angle += (target - angle) * 0.14;
    if (Math.abs(target - angle) < 0.0004) angle = target;
    drum.style.transform = 'translateZ(' + R.toFixed(1) + 'px) rotateY(' + angle.toFixed(5) + 'rad)';
    var position = angle / step;
    cards.forEach(function (c, i) { c.style.display = Math.abs(i - position) <= 2 ? '' : 'none'; });
    select(clamp(Math.round(position), 0, count - 1));
    return angle !== target;
  }

  function measureSwipe() {
    cardWidth = projects[0].offsetWidth || 1;
    centres = projects.map(function (p) { return p.offsetLeft + p.offsetWidth / 2; });
  }

  function renderSwipe() {
    var mid = track.scrollLeft + track.clientWidth / 2;
    var nearest = 0, best = Infinity;
    projects.forEach(function (p, i) {
      var d = clamp((centres[i] - mid) / cardWidth, -1.6, 1.6);
      if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
      // Concave, like standing inside the same curved wall as on desktop.
      p.querySelector('.project-image').style.transform =
        'translateX(' + (-d * cardWidth * 0.17).toFixed(1) + 'px) perspective(800px) rotateY(' + (-d * 34).toFixed(2) + 'deg) translateZ(' + (Math.abs(d) * -30).toFixed(1) + 'px)';
      p.querySelector('.project-caption').style.opacity = (1 - Math.min(1, Math.abs(d) * 1.8)).toFixed(3);
    });
    select(nearest);
  }

  function clearSwipe() {
    projects.forEach(function (p) {
      p.querySelector('.project-image').style.transform = '';
      p.querySelector('.project-caption').style.opacity = '';
    });
  }

  function measure() {
    if (!hasGallery) return;
    var next = reduced.matches ? 'static' : (wide.matches ? 'drum' : 'swipe');
    if (mode === 'swipe' && next !== 'swipe') clearSwipe();
    mode = next;
    projects.forEach(function (p) { p.inert = false; });
    body.classList.toggle('gallery-drum', mode === 'drum');
    // In the drum the pictures are drawn on the wall; the title link is the way in.
    projects.forEach(function (p) { p.querySelector('.project-image').tabIndex = mode === 'drum' ? -1 : 0; });
    if (mode === 'drum') {
      buildDrum();
      layoutDrum();
      target = drumTarget();
      angle = target;
      instruction.textContent = 'Scroll to turn. Click a site to open it.';
    } else {
      if (mode === 'swipe') { measureSwipe(); instruction.textContent = 'Swipe to see the others.'; }
      else instruction.textContent = '';
    }
    active = -1;
    update();
  }

  function update() {
    frame = 0;
    nav.classList.toggle('scrolled', window.scrollY > 30);
    if (mode === 'drum') {
      target = drumTarget();
      if (renderDrum()) frame = requestAnimationFrame(update);
    } else if (mode === 'swipe') renderSwipe();
  }
  function requestUpdate() { if (!frame) frame = requestAnimationFrame(update); }

  function goTo(i) {
    var instant = reduced.matches ? 'instant' : 'smooth';
    if (mode === 'drum') {
      // Land in the middle of that project's rest.
      var y = start + (i === 0 ? 0 : (i - 1 + 0.9) * length / (count - 1));
      if (i === count - 1) y = start + length;
      window.scrollTo({top: y, behavior: instant});
    } else if (mode === 'swipe') {
      track.scrollTo({left: centres[i] - track.clientWidth / 2, behavior: instant});
    } else projects[i].scrollIntoView({block: 'center', behavior: instant});
  }

  addEventListener('scroll', requestUpdate, {passive: true});
  if (track) track.addEventListener('scroll', function () { if (mode === 'swipe') requestUpdate(); }, {passive: true});
  var resizeTimer;
  addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); });
  wide.addEventListener('change', measure);
  reduced.addEventListener('change', function () {
    manualPause = reduced.matches;
    syncMotionButton();
    if (manualPause && hero) hero.pause();
    measure();
  });
  buttons.forEach(function (button, i) { button.addEventListener('click', function () { goTo(i); }); });
  // Keyboard: tabbing to a project brings it to the front.
  projects.forEach(function (project, i) {
    project.addEventListener('focusin', function () { if (mode !== 'static' && active !== i) goTo(i); });
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) requestUpdate(); });

  motionButton.addEventListener('click', function () {
    manualPause = !manualPause;
    syncMotionButton();
    if (!hero) return;
    if (manualPause) hero.pause(); else hero.play().catch(function () {});
  });
  // Existing media code may resume the hero; respect the visitor's pause.
  if (hero) hero.addEventListener('play', function (event) { if (manualPause) event.target.pause(); });

  var enterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      if (!reduced.matches && !manualPause) entry.target.animate([
        {transform: 'translateY(28px)', opacity: 0.2},
        {transform: 'translateY(0)', opacity: 1}
      ], {duration: 800, easing: 'cubic-bezier(.2,.7,.2,1)'});
      enterObserver.unobserve(entry.target);
    });
  }, {threshold: 0.15});
  document.querySelectorAll('[data-enter]').forEach(function (el) { enterObserver.observe(el); });
  document.fonts.ready.then(measure);
  addEventListener('load', measure);
  measure();
})();
