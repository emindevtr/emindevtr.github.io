/* /services v3, "la vitrina" (25-nov-2026). Ver services.css.
   L = capas.json de temp/vitrina/recorta.py: cada objeto y su disco dentro de su marco (fracciones) y
   en los atlas (px). El colibrí son los mismos fotogramas de la portada (assets/bird). */
(function () {
  "use strict";
  var L = {"frame":[1364,1805],"atlas":[2487,1012],"atlas_hd":[3112,2178],"piezas":[{"id":"websites","obj":[0.0433,0.0133,0.9326,0.7335],"disc":[0.1496,0.8089,0.8255,0.1463],"perch":[0.7972,0.0143],"a_on":[0,0,432,450],"a_og":[0,452,432,450],"a_dn":[0,904,383,90],"a_hd":[0,0,1068,1112]},{"id":"brand","obj":[0.1151,0.1003,0.7918,0.6526],"disc":[0.0968,0.8294,0.8255,0.1435],"perch":[0.513,0.0204],"a_on":[434,0,367,401],"a_og":[434,452,367,401],"a_dn":[385,904,383,88],"a_hd":[1070,0,907,990]},{"id":"video","obj":[0.0132,0.051,0.9868,0.6233],"disc":[0.0213,0.8017,0.9685,0.1679],"perch":[0.3321,0.0169],"a_on":[803,0,458,382],"a_og":[803,452,458,382],"a_dn":[770,904,449,103],"a_hd":[1979,0,1131,945]},{"id":"marketing","obj":[0.0762,0.026,0.8724,0.7003],"disc":[0.0587,0.8039,0.8761,0.1568],"perch":[0.6269,0.0111],"a_on":[1263,0,405,430],"a_og":[1263,452,405,430],"a_dn":[1221,904,406,96],"a_hd":[0,1114,1000,1062]},{"id":"ai","obj":[0.0469,0.0,0.9289,0.6909],"disc":[0.0,0.8271,0.9773,0.1729],"perch":[0.487,0.0179],"a_on":[1670,0,431,424],"a_og":[1670,452,431,424],"a_dn":[1629,904,453,106],"a_hd":[1002,1114,1064,1047]},{"id":"care","obj":[0.1444,0.0355,0.7126,0.6997],"disc":[0.0616,0.8166,0.8636,0.1529],"perch":[0.5041,0.015],"a_on":[2103,0,330,429],"a_og":[2103,452,330,429],"a_dn":[2084,904,401,94],"a_hd":[2068,1114,816,1061]}]};
  var ATLAS = "/assets/sv-objects.webp?v=1", ATLAS_HD = "/assets/sv-objects-hd.webp?v=1", BIRD = "/assets/bird/";
  var vt = document.getElementById("vt");
  if (!vt) { return; }
  var row = document.getElementById("vt-row"), title = vt.querySelector(".vt-title");
  var cols = [].slice.call(vt.querySelectorAll(".vt-col"));
  var arts = [].slice.call(document.querySelectorAll("#vt-dt article"));
  var IDS = L.piezas.map(function (p) { return p.id; });
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mob = matchMedia("(max-width: 760px)");
  var hoverable = matchMedia("(hover: hover) and (pointer: fine)");
  var AR = L.frame[0] / L.frame[1];

  function pct(v) { return (v * 100) + "%"; }
  function sprite(el, a, atl, url) {   // atlas rect a=[x,y,w,h] stretched to fill el
    el.style.backgroundImage = "url(" + url + ")";
    el.style.backgroundSize = pct(atl[0] / a[2]) + " " + pct(atl[1] / a[3]);
    el.style.backgroundPosition = pct(a[0] / (atl[0] - a[2])) + " " + pct(a[1] / (atl[1] - a[3]));
  }
  function place(el, r) { el.style.left = pct(r[0]); el.style.top = pct(r[1]); el.style.width = pct(r[2]); el.style.height = pct(r[3]); }
  function damp(cur, goal, k, dt) { return cur + (goal - cur) * (1 - Math.pow(k, dt)); }
  function span(cls, parent) { var s = document.createElement("span"); s.className = cls; parent.appendChild(s); return s; }

  /* ── the six objects ── */
  var P = L.piezas.map(function (p, i) {
    var st = cols[i].querySelector(".vt-stage");
    var d = p.disc;
    var floor = span("vt-floor", st);
    var disc = span("vt-disc", st); sprite(disc, p.a_dn, L.atlas, ATLAS);
    var lit = span("vt-lit", st);
    var obj = span("vt-obj", st);
    var n = span("vt-n", obj); sprite(n, p.a_on, L.atlas, ATLAS);
    var g = span("vt-g", obj); sprite(g, p.a_og, L.atlas, ATLAS);
    return { p: p, st: st, obj: obj, g: g, lit: lit, floor: floor, disc: disc, go: p.obj, on: 0, phase: i * 1.7, period: 5.2 + (i % 3) * 0.7,
             tx: 0, ty: 0, s: 1, a: 1, box: null };
  });
  // small pictures of the neighbours in the previous / next buttons
  [].forEach.call(document.querySelectorAll(".vt-pg .th"), function (th) {
    var p = L.piezas[IDS.indexOf(th.getAttribute("data-th"))];
    if (p) { sprite(th, p.a_og, L.atlas, ATLAS); th.style.aspectRatio = p.a_og[2] + "/" + p.a_og[3]; th.style.height = "auto"; }
  });
  /* where object and disc sit in their stage. Desktop: the common 4K frame. Phone: every object fitted to
     the same area of a square stage, standing just above a disc of the same width, so the six match. */
  var geoMode = "";
  function geo() {
    var m = mob.matches ? "m" : "d";
    if (m === geoMode) { return; } geoMode = m;
    P.forEach(function (o) {
      var p = o.p, ob = p.obj, d = p.disc;
      if (m === "m") {
        var asp = (ob[2] * L.frame[0]) / (ob[3] * L.frame[1]);
        var w = Math.sqrt(0.4 * asp), h = w / asp;
        if (h > 0.64) { h = 0.64; w = h * asp; }
        if (w > 0.84) { w = 0.84; h = w / asp; }
        ob = [(1 - w) / 2, 0.7 - h, w, h];
        var dw = 0.72; d = [(1 - dw) / 2, 0.74, dw, dw * p.a_dn[3] / p.a_dn[2]];
      }
      o.go = ob;
      place(o.obj, ob); place(o.disc, d);
      place(o.floor, [d[0] - d[2] * 0.08, d[1] + d[3] * 0.55, d[2] * 1.16, d[3] * 0.9]);
      place(o.lit, [d[0] - d[2] * 0.05, d[1] - d[3] * 0.25, d[2] * 1.1, d[3] * 1.3]);
    });
  }
  var hd = false;
  function loadHD() {
    if (hd) { return; } hd = true;
    var im = new Image();
    im.onload = function () { P.forEach(function (o) { sprite(o.g, o.p.a_hd, L.atlas_hd, ATLAS_HD); }); };
    im.src = ATLAS_HD;
  }

  /* ── layout: the whole row (names and buttons included) always fits on the screen ── */
  var VW = 1, VH = 1, lastW = 0, lastH = 0;
  function layout(force) {
    VW = document.documentElement.clientWidth; VH = window.innerHeight;
    if (!force && VW === lastW && Math.abs(VH - lastH) < 120) { return measure(); }
    lastW = VW; lastH = VH;
    vt.style.paddingTop = "";
    geo();
    var vr = vt.getBoundingClientRect(), rr = row.getBoundingClientRect();
    var top = rr.top - vr.top, colW = cols[0].clientWidth, tw;
    if (mob.matches) {
      tw = Math.min(colW * 0.94, 240);
    } else {
      var capH = 0;
      cols.forEach(function (c) { capH = Math.max(capH, c.querySelector(".vt-name").offsetHeight + c.querySelector(".vt-more").offsetHeight + 16); });
      vt.style.setProperty("--caph", capH + "px");
      tw = Math.min(colW * 1.04, (VH - top - capH - 30) * AR);
      tw = Math.max(tw, 120);
    }
    vt.style.setProperty("--tw", tw + "px");
    /* 26-nov, Alex: "has dejado un hueco enorme abajo, no esta bien centrado". On a big screen the
       row is as wide as it can be and still leaves space below: share that space above and below,
       so title and objects sit in the middle of the screen. */
    if (!mob.matches) {
      var base = parseFloat(getComputedStyle(vt).paddingTop) || 0;
      // One column is always open (its list and button show), so the block to centre is the row
      // with that list, not just the names.
      var bottom = row.getBoundingClientRect().bottom - vt.getBoundingClientRect().top;
      var shift = (VH - bottom - 24) / 2;
      if (shift > 12) { vt.style.paddingTop = Math.round(base + shift) + "px"; }
    }
    fitSheets();
    measure();
  }
  /* on a computer the sheet of a service has no scroll: if it is taller than the space under the
     menu, it is shrunk (never below 72 %) so the quote button and previous / next always show */
  function fitSheets() {
    var avail = VH - 80 - 28;
    arts.forEach(function (a) {
      a.style.zoom = "";
      if (mob.matches) { return; }
      var h = a.offsetHeight;
      if (h > avail) { a.style.zoom = Math.max(0.72, avail / h).toFixed(3); }
    });
  }
  function measure() {                 // where each object sits, in section coordinates (no transforms)
    var vr = vt.getBoundingClientRect();
    P.forEach(function (o) {
      var r = o.st.getBoundingClientRect(), b = o.go;
      o.box = { x: r.left - vr.left + b[0] * r.width, y: r.top - vr.top + b[1] * r.height, w: b[2] * r.width, h: b[3] * r.height };
    });
    var bw = mob.matches ? P[0].box.w * 0.62 : P[0].box.w * 0.6;
    bscale = Math.max(56, bw) / SW;
    BIRD_IN = mob.matches ? 1.35 : 1.6;
    cv.style.width = (SW * bscale) + "px"; cv.style.height = (SH * bscale) + "px";
  }

  /* ── state ── */
  var active = 0, wanted = 0, wantT = 0, open = -1;
  function setActive(i) {
    if (i === wanted) { return; }
    wanted = i; wantT = performance.now();
    cols.forEach(function (c, k) { c.classList.toggle("on", k === i); });
  }
  function show(i, push) {             // step inside service i (or back out with -1)
    if (i >= 0) { loadHD(); }
    open = i;
    vt.classList.toggle("open", i >= 0);
    document.documentElement.classList.toggle("vt-lock", i >= 0);
    cols.forEach(function (c, k) { c.classList.toggle("is-open", k === i); });
    arts.forEach(function (a, k) { a.classList.toggle("show", k === i); a.setAttribute("aria-hidden", k === i ? "false" : "true"); });
    if (i >= 0) { setActive(i); active = i; document.getElementById("vt-dt").scrollTop = 0; }
    if (push) {
      var h = i >= 0 ? "#" + IDS[i] : location.pathname + location.search;
      if (i >= 0 && location.hash) { history.replaceState(null, "", h); } else { history.pushState(null, "", h); }
    }
  }
  function fromHash() { show(IDS.indexOf(location.hash.slice(1)), false); }
  addEventListener("popstate", fromHash);

  cols.forEach(function (c, i) {
    c.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && open < 0) { setActive(i); loadHD(); } });
    c.addEventListener("focus", function () { if (open < 0) { setActive(i); } });
    c.addEventListener("click", function (e) { e.preventDefault(); show(i, true); });
  });
  document.getElementById("vt-back").addEventListener("click", function () { show(-1, true); });
  document.querySelector(".vt-veil").addEventListener("click", function () { show(-1, true); });
  [].forEach.call(document.querySelectorAll("[data-go]"), function (b) {
    b.addEventListener("click", function () { show(+b.getAttribute("data-go"), true); });
  });
  addEventListener("keydown", function (e) {
    if (open < 0) { return; }
    if (e.key === "Escape") { show(-1, true); }
    if (e.key === "ArrowRight") { show((open + 1) % 6, true); }
    if (e.key === "ArrowLeft") { show((open + 5) % 6, true); }
  });
  // inside a service on a phone: swipe sideways for the next one
  var sx = null, sy = 0;
  document.addEventListener("touchstart", function (e) { if (open >= 0) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (sx === null || open < 0) { sx = null; return; }
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) { return; }
    show((open + (dx < 0 ? 1 : 5)) % 6, true);
  }, { passive: true });
  cols[0].classList.add("on");

  /* ── cursor parallax ── */
  var mx = 0, my = 0, px = 0, py = 0;
  vt.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") { mx = e.clientX / VW - 0.5; my = e.clientY / VH - 0.5; } });
  vt.addEventListener("pointerleave", function () { mx = 0; my = 0; });

  /* ── the hummingbird: switched off on this site (no canvas, no frames loaded, never drawn) ── */
  var cv = document.createElement("canvas");
  var ctx = cv.getContext("2d");
  var SW = 256, SH = 153, FEET = { x: 129, y: 99 }, bscale = 1, BIRD_IN = 1.6;
  var fly = [], land = [], LAND0 = 36, LAND_SETTLE = 82, LAND_END = 117;
  cv.width = SW; cv.height = SH;
  function load(name) {
    return fetch(BIRD + name).then(function (r) { return r.blob(); }).then(createImageBitmap).catch(function () { return null; });
  }
  var jobs = [];

  var B = { x: 0, y: 0, mode: "off", target: 0, t: 0, from: null, dur: 1, face: 1, lf: LAND0, sz: 1 };
  function ctr(o) { return { x: o.box.x + o.box.w / 2, y: o.box.y + o.box.h / 2 }; }
  function perchPx(i) {               // follows the object as it floats, moves and grows
    var o = P[i], c = ctr(o), q = o.p.perch;
    var x = o.box.x + q[0] * o.box.w, y = o.box.y + q[1] * o.box.h;
    return { x: c.x + o.tx + (x - c.x) * o.s, y: c.y + o.ty + (y - c.y) * o.s };
  }
  function flyTo(i, now) {
    var a = { x: B.x, y: B.y }, b = perchPx(i), d = Math.hypot(b.x - a.x, b.y - a.y);
    B.from = a; B.target = i; B.t = 0; B.t0 = now;
    B.dur = Math.min(0.85, Math.max(0.34, 0.28 + d / VW * 0.7));
    B.lift = Math.min(VH * 0.16, VH * 0.04 + d * 0.2);
    B.face = b.x > a.x ? -1 : 1;       // the sprite looks left; mirror it to fly right
    B.mode = "fly";
  }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function drawBird(img, flip) {
    ctx.clearRect(0, 0, SW, SH);
    if (!img) { return; }
    ctx.save();
    if (flip < 0) { ctx.translate(SW, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, 0, SH - img.height);
    ctx.restore();
  }

  /* where the chosen object goes inside its service (screen coordinates, turned into section ones) */
  function insideGoal(o, vr) {
    var c = ctr(o), gx, gy, s, nav = mob.matches ? 74 : 80;
    if (mob.matches) {
      var top = 132, bottom = VH * 0.42 - 10;                       // under "All services", above the sheet
      var up = FEET.y * bscale * BIRD_IN;                           // the bird stands this tall above its feet
      var perchY = o.p.perch[1];                                    // perch, as a fraction from the object's top
      s = Math.max(0.6, Math.min(2.4, (VW * 0.5) / o.box.w, (bottom - top - up) / (o.box.h * (1 - perchY) + 0.0001)));
      var hh = o.box.h * s, over = Math.max(0, up - perchY * hh);  // how far the bird sticks out above the object
      gx = VW / 2; gy = top + (bottom - top - hh - over) / 2 + over + hh / 2;
    } else {
      gx = VW * 0.28; gy = nav + (VH - nav) * 0.5;
      s = Math.min(2.8, (VW * 0.3) / o.box.w, ((VH - nav) * 0.56) / o.box.h);
    }
    return { tx: gx - vr.left - c.x, ty: gy - vr.top - c.y, s: s };
  }

  /* ── main loop ── */
  var last = performance.now(), birdReady = false;
  function tick(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now / 1000;
    if (open < 0 && wanted !== active && now - wantT > 70) { active = wanted; }
    px = damp(px, open >= 0 ? 0 : mx, 0.002, dt); py = damp(py, open >= 0 ? 0 : my, 0.002, dt);
    var vr = open >= 0 ? vt.getBoundingClientRect() : null;
    P.forEach(function (o, i) {
      if (!o.box) { return; }
      var isOpen = open === i, others = open >= 0 && !isOpen;
      var on = (open >= 0 ? isOpen : (i === active && (hoverable.matches || mob.matches === false))) ? 1 : 0;
      o.on = damp(o.on, on, on ? 0.0004 : 0.004, dt);
      var bob = still ? 0 : Math.sin(t * 2 * Math.PI / o.period + o.phase) * o.box.h * 0.025;
      var depth = 0.6 + (i % 3) * 0.25;
      var g = { tx: -px * o.box.w * 0.06 * depth, ty: bob - py * o.box.h * 0.04 * depth - o.on * o.box.h * 0.06, s: 1 + o.on * 0.04 };
      if (isOpen) { g = insideGoal(o, vr); g.ty += bob * 1.4; }
      if (others) { g.ty = o.box.h * 0.3; }
      var k = isOpen || (open < 0 && o.s > 1.2) ? 0.006 : 0.0015;   // big moves glide, small ones snap
      o.tx = damp(o.tx, g.tx, k, dt); o.ty = damp(o.ty, g.ty, k, dt); o.s = damp(o.s, g.s, k, dt);
      o.a = damp(o.a, others ? 0 : 1, others ? 0.0005 : 0.01, dt);
      var rot = still ? 0 : Math.sin(t * 2 * Math.PI / (o.period * 1.3) + o.phase) * 0.8;
      o.obj.style.transform = "translate3d(" + o.tx.toFixed(2) + "px," + o.ty.toFixed(2) + "px,0) rotate(" + rot.toFixed(3) + "deg) scale(" + o.s.toFixed(4) + ")";
      o.obj.style.opacity = o.a.toFixed(3);
      o.g.style.opacity = o.on.toFixed(3);
      o.lit.style.opacity = (o.on * 0.9).toFixed(3);
    });
    if (birdReady) { stepBird(now, dt); }
    requestAnimationFrame(tick);
  }

  function birdGoal() { return open >= 0 ? open : active; }
  function stepBird(now, dt) {
    var img, goal = birdGoal();
    if (B.mode === "perch" && B.target !== goal) { B.mode = "takeoff"; B.lf = Math.min(B.lf, LAND_SETTLE); }
    if (B.mode === "land" && B.target !== goal) { B.mode = "takeoff"; }
    if (B.mode === "fly") {
      if (B.target !== goal) { flyTo(goal, now); }
      var b = perchPx(B.target);
      B.t = Math.min(1, (now - B.t0) / 1000 / B.dur);
      var e = ease(B.t), cx = (B.from.x + b.x) / 2, cy = Math.min(B.from.y, b.y) - B.lift;
      B.x = (1 - e) * (1 - e) * B.from.x + 2 * (1 - e) * e * cx + e * e * b.x;
      B.y = (1 - e) * (1 - e) * B.from.y + 2 * (1 - e) * e * cy + e * e * b.y;
      img = fly[Math.floor(now / 20) % 9];
      if (B.t >= 1) { B.mode = "land"; B.lf = LAND0 + 10; }
    } else if (B.mode === "land") {
      var pp = perchPx(B.target); B.x = pp.x; B.y = pp.y;
      B.lf = Math.min(LAND_SETTLE, B.lf + dt * 130);
      img = land[Math.floor(B.lf)];
      if (B.lf >= LAND_SETTLE) { B.mode = "perch"; B.pt = now; }
    } else if (B.mode === "perch") {
      var q = perchPx(B.target); B.x = q.x; B.y = q.y;
      var sp = LAND_END - LAND_SETTLE, u = ((now - B.pt) / 1000 * 9) % (2 * sp);
      B.lf = LAND_SETTLE + (u < sp ? u : 2 * sp - u);
      img = land[Math.floor(B.lf)];
    } else if (B.mode === "takeoff") {
      B.lf -= dt * 230;
      img = land[Math.max(LAND0, Math.floor(B.lf))];
      if (B.lf <= LAND0 + 10) { flyTo(goal, now); }
    }
    B.sz = damp(B.sz, open >= 0 ? BIRD_IN : 1, 0.01, dt);
    drawBird(img || fly[0], B.face);
    var sc = bscale * B.sz;
    cv.style.transform = "translate3d(" + (B.x - FEET.x * sc).toFixed(2) + "px," + (B.y - FEET.y * sc).toFixed(2) + "px,0) scale(" + B.sz.toFixed(4) + ")";
  }

  layout(true);
  addEventListener("resize", function () { layout(false); });
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function () { layout(true); }); }
  addEventListener("load", function () {
    layout(true);
    if (!mob.matches) { setTimeout(loadHD, 1200); }
  });
  fromHash();
  Promise.all(jobs).then(function () {
    measure();
    var g = birdGoal(), first = perchPx(g);
    if (still) { B.x = first.x; B.y = first.y; B.mode = "perch"; B.pt = performance.now(); B.target = g; }
    else { B.x = VW * 1.05; B.y = VH * 0.12; flyTo(g, performance.now()); B.dur = 1.1; }
  });
  requestAnimationFrame(tick);
})();
