/* EL COMPAÑERO — the hero's hummingbird, tiny, follows the scroll and
   perches on real page elements. One actor, continuous: flight loop while
   moving (position driven by scroll along an arced path), generated landing
   clip when it arrives (wings fold, sits), reversed for takeoff. All motion
   is transform + canvas blits of pre-decoded ImageBitmaps; document
   geometry is read only on resize/height changes, never per frame. */
(function () {
  "use strict";

  /* the companion is scroll-position-driven, not a looping/parallax effect,
     and it's core brand content for this flagship demo — it stays on under
     prefers-reduced-motion. Only bail if the browser can't decode sprites. */
  if (!window.createImageBitmap) { return; }

  var mobile = matchMedia("(max-width: 700px)").matches;
  var BIRD_W = mobile ? 116 : 170;        /* CSS px — proporcional a la rama */
  var LEAD = 380;                          /* scroll px of entry flight */
  var PAD = mobile ? 100 : 130;            /* dwell half-zone around a perch */
  var ARC = mobile ? 46 : 90;              /* flight arc lift */
  var SPR_W = 256;
  var LAND_START = 28;                     /* landing clip cursor floor: frames
                                              before it are hover-on-spot and are
                                              never drawn, so never fetched */

  var host = document.createElement("div");
  host.className = "bird";
  host.setAttribute("aria-hidden", "true");
  var canvas = document.createElement("canvas");
  host.appendChild(canvas);
  /* contact shadow — appears only while sitting; a shadow in mid-air over
     the open page would float on nothing */
  var shadow = document.createElement("b");
  shadow.className = "shadow";
  host.appendChild(shadow);
  document.body.appendChild(host);
  var ctx = canvas.getContext("2d");
  var lastSitting = false;

  var man = null, fly = [], land = [];
  var flyAnchor = { x: 128, y: 92 };
  var landAnchor = { x: 129, y: 99 };

  /* ── perches: anchored to real elements, doc coords cached ── */
  var perchDefs = [
    /* holdF: fraction of the element's height the bird STAYS perched for —
       on the featured build it sits while the whole preview scrolls by.

       The selector is PINNED to the card carrying `data-perch`, not to "the
       first .screen in .work". measure() resolves each perch with
       querySelector, which returns whichever piece is first in the document —
       so the moment a second build was added to the section the bird stopped
       landing on the perfume video and landed on the new one instead, with
       nothing in this file changing. Where it sits is art direction, not a
       side effect of the running order: mark the card, don't count it. */
    { sel: ".work .piece[data-perch] .screen", fx: 0.86, fy: 0, holdF: 0.85 },
    /* the crystal branch: the bird sits ON the tapered tip, hiding it */
    { sel: ".perch-branch",  fx: 0.10, fy: 0.50, branch: true },
    { sel: ".pricing .price-panel", fx: 0.74, fy: 0, holdF: 0.5 },
    { sel: ".contact-form",  fx: 0.70, fy: 0 }
  ];
  // The editorial gallery moves horizontally. Land on its fixed heading rule,
  // the studio's service rule and the contact form, never on a moving picture.
  if (document.body.classList.contains("studio-home")) {
    perchDefs = [
      { sel: ".work-head .bird-rest", fx: 0.62, fy: 0, holdF: 0 }, // 4-nov: a la derecha está el ojo del portfolio
      { sel: ".studio-note .bird-rest", fx: 0.78, fy: 0, holdF: 0 },
      { sel: ".contact-form", fx: 0.78, fy: 0 }
    ];
  }
  var branchIdx = -1;
  var branchEl = null;
  var perches = [];   /* {x, y, s} doc coords + landing scroll */
  var docH = 0;

  function docOffset(el) {
    /* layout position, immune to the entry animations' transforms
       (getBoundingClientRect measured the piece mid-settle: 34px off) */
    var x = 0, y = 0, n = el;
    while (n) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  }

  /* mobile URL bar breathes innerHeight; a shifting viewport height moves
     every landing boundary mid-scroll and the bird flaps states — use the
     LARGE viewport (only grows; reset when width changes = rotation) */
  var vhStable = innerHeight, lastW = innerWidth;
  function measure() {
    if (innerWidth !== lastW) { vhStable = innerHeight; lastW = innerWidth; }
    vhStable = Math.max(vhStable, innerHeight);
    var vh = vhStable;
    perches = [];
    branchIdx = -1;
    perchDefs.forEach(function (d) {
      var el = document.querySelector(d.sel);
      if (!el || el.offsetWidth < 10) { return; }
      var o = docOffset(el);
      var x = o.x + el.offsetWidth * d.fx;
      var y = o.y + el.offsetHeight * d.fy;
      var hold = Math.max(PAD, el.offsetHeight * (d.holdF || 0));
      if (d.branch) { branchIdx = perches.length; branchEl = el; }
      perches.push({ x: x, y: y, s: 0, hold: hold });
    });
    perches.forEach(function (p) {
      p.s = Math.max(0, p.y - vh * 0.52);
    });
    /* keep strictly ascending so zones never invert */
    for (var i = 1; i < perches.length; i++) {
      var floor = perches[i - 1].s + perches[i - 1].hold + PAD + 40;
      if (perches[i].s <= floor) { perches[i].s = floor; }
    }
    /* cap hold + release margin to the gap to the NEXT perch — on mobile
       the perches sit close together and an uncapped hold devoured the
       whole gap, leaving a dead zone where the bird never let go */
    for (var j = 0; j < perches.length; j++) {
      var gap = (j + 1 < perches.length) ? perches[j + 1].s - perches[j].s : 1e9;
      perches[j].hold = Math.min(perches[j].hold, Math.max(PAD, gap * 0.45));
      perches[j].out = Math.min(90, Math.round(gap * 0.18));
    }
    docH = document.documentElement.scrollHeight;
  }

  /* ── sprite loading, STAGED and FAULT-TOLERANT: the 9 flight frames come
     first so the bird exists almost immediately; the landing clip follows.
     Every frame retries on failure and any straggler is filled with its
     neighbour — one flaky request over a phone connection must never leave
     the bird hovering forever. ── */
  var readyFly = false, readyLand = false;
  /* PRIORIDAD DE RED (2026-08-16). Estas peticiones salían con la prioridad por
     defecto, o sea DETRÁS de los dos vídeos (7 MB el hero + 13 MB el preview).
     Medido hoy en producción: `manifest.json` — 153 bytes, lo PRIMERO que
     necesita el pájaro — no terminaba hasta el segundo 367, cuando pedido suelto
     tarda 0,31 s. Sin manifest no hay ni medidas de lienzo, así que no hay
     pájaro: es exactamente "no vuela, y si vuela vuela diez segundos tarde".
     El kit mínimo de vuelo son 153 B + 9 fotogramas (~68 KB). Al lado de 20 MB
     de vídeo no le quita ancho de banda a nadie, pero tiene que ir DELANTE.
     Los 90 fotogramas de aterrizaje van al revés: no se dibujan hasta que el
     pájaro se posa y salían a competir con el hero en el peor momento. */
  /* TOPE POR INTENTO (2026-08-16). La cabecera de aquí arriba promete que "una
     petición con mala suerte sobre una conexión de móvil nunca puede dejar al
     pájaro flotando para siempre". El código no lo cumplía: solo reintentaba
     cuando la petición FALLABA, y una petición COLGADA no falla nunca, así que
     el `Promise.all` de loadFrames la esperaba indefinidamente y el pájaro no
     volaba NUNCA — no tarde: nunca.

     POR QUÉ 15 s Y NO 4. El tope NO es el mecanismo que hace volar al pájaro a
     tiempo — de eso se encarga el `plazo` de loadFrames, que suelta el vuelo a
     los 2,5 s con los fotogramas que haya. El tope es solo el last resort para
     que una petición colgada acabe resolviéndose algún día. Puesto en 4 s hacía
     daño: en una línea lenta de verdad (que es de donde viene nuestro tráfico,
     leads abriendo el correo en la calle) un sprite legítimo tarda más de 4 s,
     y abortarlo para reintentarlo gasta el doble de datos y llega más tarde.
     Probado hoy contra producción con la conexión saturada: 9 sprites x 4
     intentos = 36 peticiones y ni un fotograma. Un tope generoso y UN reintento
     no le quitan nada a nadie porque el pájaro ya vuela sin esperarlos. */
  var TOPE = 15000;
  function fetchFrame(url, tries, prio) {
    var ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ac ? setTimeout(function () { ac.abort(); }, TOPE) : 0;
    var opts = { priority: prio || "auto" };
    if (ac) { opts.signal = ac.signal; }
    return fetch(url, opts)
      .then(function (r) { if (!r.ok) { throw new Error("http"); } return r.blob(); })
      .then(function (b) { clearTimeout(t); return createImageBitmap(b); })
      .catch(function () {
        clearTimeout(t);
        if (tries <= 0) { return null; }
        return new Promise(function (res) { setTimeout(res, 350); })
          .then(function () { return fetchFrame(url, tries - 1, prio); });
      });
  }
  /* el manifest es el punto único de fallo de TODO el pájaro: sin él no hay ni
     medidas de lienzo ni número de fotogramas, y su `.catch` de abajo se limita
     a rendirse en silencio. Colgado y sin reintento, eso era un pájaro que no
     aparece jamás — el mismo agujero que el de los fotogramas. */
  function fetchManifest(tries) {
    var ac = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ac ? setTimeout(function () { ac.abort(); }, TOPE) : 0;
    var opts = { priority: "high" };
    if (ac) { opts.signal = ac.signal; }
    return fetch("assets/bird/manifest.json", opts)
      .then(function (r) { if (!r.ok) { throw new Error("http"); } return r.json(); })
      .then(function (m) { clearTimeout(t); return m; })
      .catch(function (e) {
        clearTimeout(t);
        if (tries <= 0) { throw e; }
        return new Promise(function (res) { setTimeout(res, 350); })
          .then(function () { return fetchManifest(tries - 1); });
      });
  }
  /* `from` skips frames the clip never actually shows. draw() clamps the
     landing cursor to LAND_START, so land_00..27 were fetched and decoded
     on every single visit and drawn zero times — 28 requests of pure waste
     competing with the sprites the bird DOES need to start flying.
     Indices stay aligned with the file numbering; into[0..from-1] simply
     stay empty and are never read. */
  /* `plazo` = cuánto se espera COMO MUCHO al lote antes de volar con lo que haya
     llegado. ESTE es el mecanismo que arregla "vuela diez segundos tarde", no el
     tope de arriba: a los 2,5 s el pájaro sale con los fotogramas que tenga y
     los que lleguen después se incorporan solos al bucle, porque se escriben en
     el mismo array que `draw()` ya está leyendo. Nueve fotogramas o cinco es la
     diferencia entre un aleteo fino y uno tosco; ninguno o alguno es la
     diferencia entre haber hecho la web y no haberla hecho.
     Si al vencer el plazo no ha llegado NI UNO, no hay nada que enseñar: ahí sí
     se espera al lote de verdad, sin abortar nada, y el pájaro aparece cuando
     pueda. Rendirse en ese punto sería quedarse sin pájaro por ir con prisa. */
  function loadFrames(prefix, count, into, from, prio, plazo) {
    var jobs = [], start = from || 0;
    for (var i = start; i < count; i++) {
      (function (i) {
        var u = "assets/bird/" + prefix + "_" + (i < 10 ? "0" + i : i) + ".webp";
        jobs.push(fetchFrame(u, 1, prio).then(function (bm) { into[i] = bm || null; }));
      })(i);
    }
    var todos = Promise.all(jobs);
    function rellena() {
      var lastGood = null, ok = 0, i;
      for (i = start; i < count; i++) {
        if (into[i]) { lastGood = into[i]; ok++; }
        else if (lastGood) { into[i] = lastGood; }
      }
      for (i = count - 1; i >= start; i--) {
        if (!into[i] && into[i + 1]) { into[i] = into[i + 1]; }
      }
      return ok;
    }
    if (!plazo) { return todos.then(rellena); }
    return Promise.race([
      todos, new Promise(function (res) { setTimeout(res, plazo); })
    ]).then(function () {
      return rellena() || todos.then(rellena);
    });
  }
  function boot() {
    fetchManifest(2)
      .then(function (m) {
        man = m;
        landAnchor = { x: m.land.feetX, y: m.land.feetY };
        flyAnchor = { x: SPR_W / 2, y: Math.round(m.fly.h * 0.62) };
        canvas.width = SPR_W;
        canvas.height = Math.max(m.fly.h, m.land.h);
        host.style.width = BIRD_W + "px";
        host.style.height = Math.round(BIRD_W * canvas.height / SPR_W) + "px";
        loadFrames("fly", m.fly.frames, fly, 0, "high", 2500)
          .then(function (ok) {
            if (!ok) { return 0; }
            measure(); readyFly = true;
            /* el aterrizaje no tiene plazo a propósito: mientras no esté, el
               pájaro se queda cerniéndose sobre el sitio — que es lo que hace
               un colibrí — y eso ya lo cubre el estado de más abajo. Nada que
               el visitante esté esperando depende de este lote.
               Y por eso mismo espera a que el vídeo del hero se mueva (o 3 s):
               son 90 peticiones y ~650 KB que en móvil retrasaban el arranque
               del hero, que es lo primero que se ve (2026-09-26). */
            var turno = window.ascentaTrasHero ||
                        function (fn) { fn(); };
            return new Promise(function (res) { turno(res); }).then(function () {
              return loadFrames("land", m.land.frames, land, LAND_START, "low");
            });
          })
          .then(function (ok) { if (ok) { readyLand = true; } });
      })
      .catch(function () { /* no bird — the page is complete without it */ });
  }
  boot();

  addEventListener("resize", (function () {
    var t; return function () { clearTimeout(t); t = setTimeout(measure, 180); };
  })(), { passive: true });

  /* ── state machine ── */
  var ST_HIDDEN = 0, ST_FLY = 1, ST_LANDING = 2, ST_PERCHED = 3, ST_TAKEOFF = 4;
  var state = ST_HIDDEN;
  var facing = 1;                 /* 1 = left (natural), -1 = mirrored */
  var landF = 0;                  /* landing clip cursor (floor: LAND_START) */
  var blend = 0;                  /* 0..1 fly→land crossfade at arrival */
  var lastX = 0, lastY = 0, lastFrame = -1, lastState = -1, lastFacing = 1;
  var prevAX = null;              /* previous anchor x, for facing detection */
  var flyT0 = performance.now();

  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function segment(sy) {
    /* returns {mode, perch index a/b, t} for this scroll position */
    var n = perches.length;
    if (!n) { return { mode: "hide" }; }
    if (sy < perches[0].s - LEAD) { return { mode: "hide" }; }
    if (sy < perches[0].s) {
      return { mode: "entry", t: (sy - (perches[0].s - LEAD)) / LEAD };
    }
    for (var i = 0; i < n - 1; i++) {
      var a = perches[i], b = perches[i + 1];
      if (sy >= a.s && sy < b.s) {
        if (sy < a.s + a.hold) { return { mode: "at", i: i }; }
        if (sy > b.s - PAD) { return { mode: "at", i: i + 1 }; }
        return { mode: "fly", a: i, b: i + 1,
                 t: (sy - a.s - a.hold) / (b.s - a.s - a.hold - PAD) };
      }
    }
    return { mode: "at", i: n - 1 };
  }

  var att = -1;                   /* attached perch index, -1 = airborne */
  var prevSy = null;
  var fromPerch = -1;             /* which perch the current sit began on */
  var bx = 0, by = 0, have = false;   /* smoothed DOC position (airborne) */
  var pbx = 0, lastNow = 0;

  /* branch flex — one damped spring drives BOTH the branch rotation and
     the bird's ride on the tip, so they move as a single body */
  var springT0 = -1, springA = 0;
  function springAngle(now) {
    if (springT0 < 0) { return 0; }
    var t = now - springT0;
    if (t > 1600) {
      springT0 = -1;
      if (branchEl) { branchEl.style.transform = ""; }
      return 0;
    }
    return springA * Math.exp(-t / 340) * Math.sin(t / 430 * Math.PI * 2);
  }

  function tick(now) {
    if (!readyFly) { return; }
    if (docH !== document.documentElement.scrollHeight) { measure(); }
    var sy = window.scrollY;
    var speed = prevSy === null ? 0 : Math.abs(sy - prevSy);
    prevSy = sy;
    var seg = segment(sy);
    var x, y;

    if (seg.mode === "hide") {
      att = -1; have = false;
      if (state !== ST_HIDDEN) { state = ST_HIDDEN; host.classList.remove("on"); }
      return;
    }
    if (state === ST_HIDDEN) { state = ST_FLY; host.classList.add("on"); }

    /* attachment with hysteresis: land only at gentle speed, let go only
       well past the dwell edge — kills the state-flapping jitter that the
       mobile momentum scroll (and its rubber-banding) provoked */
    if (att >= 0) {
      var pa = perches[att];
      if (sy > pa.s + pa.hold + pa.out || sy < pa.s - PAD - pa.out) { att = -1; }
    }
    /* it may only land once it has physically ARRIVED: the flight target
       is scroll-driven, but the bird chases it with real momentum — a big
       scroll jump means it visibly flies there instead of teleporting */
    if (att < 0 && seg.mode === "at" && speed < 40 && have) {
      var pp = perches[seg.i];
      var ddx = bx - pp.x, ddy = by - pp.y;
      if (ddx * ddx + ddy * ddy < 45 * 45) { att = seg.i; }
    }

    if (att >= 0) {
      var p = perches[att];
      x = p.x; y = p.y - sy;
      if (readyLand) {
        if (state === ST_FLY) {
          state = ST_LANDING; landF = LAND_START; blend = 0;
          fromPerch = att;
          if (att === branchIdx) { springT0 = now; springA = 2.4; }
        }
        if (state === ST_LANDING) {
          blend = Math.min(1, blend + 0.12);
          landF = Math.min(landF + 3, land.length - 1);
          if (landF >= land.length - 1 && blend >= 1) { state = ST_PERCHED; }
        } else if (state === ST_PERCHED) {
          landF = land.length - 1;
        }
      } /* landing frames still streaming: hover on the spot — it's a
           hummingbird, hovering is what it does */
    } else if (seg.mode === "entry") {
      var p0 = perches[0];
      var e0 = ease(seg.t);
      var sx = innerWidth + BIRD_W;
      x = sx + (p0.x - sx) * e0;
      y = (p0.y - sy) - 140 * (1 - e0) - Math.sin(e0 * Math.PI) * ARC;
      setFly(now, x, y);
    } else if (seg.mode === "fly") {
      var a = perches[seg.a], b = perches[seg.b];
      var e = ease(Math.min(Math.max(seg.t, 0), 1));
      x = a.x + (b.x - a.x) * e;
      y = (a.y + (b.y - a.y) * e) - sy - Math.sin(e * Math.PI) * ARC;
      setFly(now, x, y);
    } else { /* over a perch but too fast (or hysteresis gap): hover there */
      var ph = perches[seg.i];
      x = ph.x; y = ph.y - sy;
      setFly(now, x, y);
    }

    /* takeoff: leaving a perch back into flight */
    if (att < 0 && (state === ST_PERCHED || state === ST_LANDING)) {
      state = ST_TAKEOFF;
      if (fromPerch === branchIdx) { springT0 = now; springA = -1.1; }
      fromPerch = -1;
    }
    if (state === ST_TAKEOFF) {
      landF -= 5;
      if (landF <= LAND_START) { state = ST_FLY; blend = 0; }
    }

    /* apply the branch spring: rotate the branch, ride the bird on it */
    var ang = springAngle(now);
    if (springT0 >= 0 && branchEl) {
      branchEl.style.transform = "rotate(" + ang.toFixed(3) + "deg)";
      if (att === branchIdx) {
        y += branchEl.offsetWidth * 0.84 * ang * Math.PI / 180;
      }
    }

    /* document coordinates: while perched this is CONSTANT (zero writes,
       the page carries the bird); while airborne the bird CHASES the
       scroll-driven target with a time constant — a scroll jump becomes a
       visible flight, never a teleport */
    var tyDoc = y + sy;
    var dt = lastNow ? Math.min(now - lastNow, 80) : 16;
    lastNow = now;
    if (att >= 0) {
      bx = x; by = tyDoc; have = true;
    } else if (!have) {
      bx = x; by = tyDoc; have = true;
    } else {
      var cdx = x - bx, cdy = tyDoc - by;
      if (cdx * cdx + cdy * cdy > 1800 * 1800) { bx = x; by = tyDoc; }
      else {
        var k = 1 - Math.exp(-dt / 140);
        bx += cdx * k; by += cdy * k;
      }
      if (bx - pbx > 0.8) { facing = -1; }
      else if (bx - pbx < -0.8) { facing = 1; }
    }
    pbx = bx;
    draw(now, bx, by);
  }

  function setFly(now, x, y) {
    if (state === ST_PERCHED || state === ST_LANDING) { return; } /* handled above */
    if (state !== ST_TAKEOFF) { state = ST_FLY; }
    /* facing is derived from the SMOOTHED motion in the tick tail */
  }

  function draw(now, x, y) {
    var scale = BIRD_W / SPR_W;
    var anchor = (state === ST_FLY) ? flyAnchor : landAnchor;
    var frame, img;
    if (state === ST_FLY) {
      frame = Math.floor((now - flyT0) / 42) % fly.length;
      img = fly[frame];
    } else {
      frame = Math.min(Math.max(landF, LAND_START), land.length - 1);
      img = land[frame];
    }
    var ax = (facing === 1) ? anchor.x : SPR_W - anchor.x;
    var tx = Math.round(x - ax * scale);
    var ty = Math.round(y - anchor.y * scale);
    var moved = Math.abs(tx - lastX) > 0.4 || Math.abs(ty - lastY) > 0.4;
    var repaint = frame !== lastFrame || state !== lastState || facing !== lastFacing;
    if (moved) {
      host.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
      lastX = tx; lastY = ty;
    }
    var sitting = state === ST_LANDING || state === ST_PERCHED;
    if (sitting !== lastSitting) {
      host.classList.toggle("sitting", sitting);
      lastSitting = sitting;
    }
    if (sitting && repaint) {
      shadow.style.left = ax * scale + "px";
      shadow.style.top = (anchor.y * scale + 1) + "px";
    }
    if (repaint) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      if (facing === -1) { ctx.translate(SPR_W, 0); ctx.scale(-1, 1); }
      if (state === ST_LANDING && blend < 1) {
        var ff = fly[Math.floor((now - flyT0) / 42) % fly.length];
        ctx.globalAlpha = 1 - blend;
        ctx.drawImage(ff, landAnchor.x - flyAnchor.x, landAnchor.y - flyAnchor.y);
        ctx.globalAlpha = blend;
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
      lastFrame = frame; lastState = state; lastFacing = facing;
    }
  }

  /* one shared clock: piggyback on rAF without touching Lenis */
  (function loop(t) { tick(t); requestAnimationFrame(loop); })(0);

  /* resume-safe: nothing to do — state is derived from scroll each frame */
})();
