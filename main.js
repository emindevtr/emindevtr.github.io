/* EMIN DEV — hero loop, hover previews, Lenis (single smoothing chain),
   IO reveals. Laws: rAF is Lenis's clock; animations are transform/opacity;
   no scroll handlers; videos decode ONLY while on screen (jank guard):
   the hero pauses off-viewport, previews pause off-viewport, and only one
   preview plays at a time. */
(function () {
  "use strict";

  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* PRIORIDAD DE ANCHO DE BANDA: nada pesado y opcional se descarga mientras el
     hero todavía está intentando arrancar. Quien quiera esperar turno se apunta
     con `trasHero()`; `begin()` los suelta a todos en cuanto el vídeo se mueve.
     El tope de 3 s es porque el hero puede no arrancar nunca (ahorro de datos,
     red pobre, autoplay bloqueado) y en ese caso lo demás no puede quedarse
     esperando a una señal que no va a llegar. */
  var heroArrancado = false, colaTrasHero = [];
  function trasHero(fn) {
    if (heroArrancado) { fn(); return; }
    colaTrasHero.push(fn);
  }
  setTimeout(function () {
    heroArrancado = true;
    while (colaTrasHero.length) { colaTrasHero.shift()(); }
  }, 3000);
  /* bird.js también espera turno (2026-09-26): sus 90 fotogramas de aterrizaje (~650 KB)
     salían a la vez que el vídeo del hero y en móvil le quitaban la línea justo cuando
     tenía que arrancar. Se exporta aquí porque main.js va antes que bird.js (los dos defer,
     y los defer se ejecutan en orden). */
  window.ascentaTrasHero = trasHero;

  /* ── hero video: per-device ping-pong loop (forward + reverse, seamless).
     Three art-directed masters (Law 6): 9:16 portrait, 16:9 desktop, 21:9
     ultra (capped at 3840px — the universal hardware-decode ceiling; 4420
     and even 4096 can fall back to software decode = visible stutter). ── */
  if (document.getElementById("heroVideo")) {
  var video = document.getElementById("heroVideo");
  var media = video.parentElement;
  var mqMobile = matchMedia("(max-width: 700px)");

  function chooseSrc() {
    var m = mqMobile.matches;
    /* FICHERO NUEVO, no `?v=` (2026-08-14). El master de movil paso de 1080x1938 a
       540x970: 1,37 MB en vez de 4,05 — 66% menos, con SSIM 0,986 contra el original.
       Recodificar a 1080 no servia de nada (a CRF 24 salia MAS grande que el original: ya
       estaba bien comprimido); el margen estaba en los pixeles, no en el bitrate.
       Se paso por 720 (2,03 MB, SSIM 0,990) y se bajo otro escalon a proposito: es un loop
       de fondo desenfocado DETRAS del texto, no una foto de producto, y la diferencia entre
       0,990 y 0,986 no se ve en un movil. Lo que si se nota son 700 KB menos en datos
       moviles para un lead que abre nuestro correo en la calle, que es de donde viene todo
       nuestro trafico.

       LO QUE **NO** HACE, Y SE PROBO: bajar de 720 a 540 NO movio el LCP ni un milisegundo
       (6,3 s con los dos, medido tres veces cada uno). O sea que el LCP no lo manda el PESO
       del video sino CUANDO empieza a pedirse: arranca en `load` y espera a tener 2 s de
       buffer antes de revelarse. Esa espera es deliberada y esta pagada — revelarlo antes
       traia el tiron visible de la primera visita. El poster tapa el hueco, y el FCP (0,9 s)
       es lo que el visitante percibe de verdad. Se deja el 540 por los datos ahorrados, no
       por la metrica.

       POR QUE NOMBRE NUEVO Y NO `?v=4`: se probo con `?v=3` y NO bastó. Reemplazado el
       fichero y verificado desde aqui que las dos URLs servian los 2,03 MB, PageSpeed seguia
       descargando 4.049 KB de `?v=2` una hora despues — su borde del CDN guardaba el objeto
       viejo con el TTL de 7 dias con el que se cacheo ANTES de arreglar el .htaccess. Una
       cadena de query es la misma entrada de cache para algunos bordes. Un NOMBRE que no ha
       existido nunca no lo tiene cacheado nadie, en ningun borde del mundo. Es lo unico
       verdaderamente atomico, y es lo que hacen los empaquetadores serios (hash en el
       nombre). El fichero viejo se deja subido: los navegadores que ya lo tengan cacheado no
       ganan nada bajandolo otra vez. */
    /* móvil SIN av1 a propósito: medido, el AV1 salía un 152% del H.264 —
       más grande. Ver build_hero_av1.py. `av1: null` ⇒ elegirFichero()
       devuelve el H.264 sin ni siquiera preguntar. */
    /* 2026-11-22: the hummingbird/A loop became the white rabbit -> Emin Dev E loop.
       One 16:9 master only (1920x1080), so ultra screens reuse the desktop files. */
    return m ? { poster: "assets/hero_rabbit_poster_mobile.jpg",
                 src:    "assets/hero_rabbit_mobile.mp4",
                 av1:    null,                                 w: 540,  h: 970,  br: 900000 }
             : { poster: "assets/hero_rabbit_poster_desktop.jpg",
                 src:    "assets/hero_rabbit_desktop.mp4",
                 av1:    "assets/hero_rabbit_desktop_av1.mp4", w: 1920, h: 1080, br: 3000000 };
  }

  /* ── AV1 CUANDO EL NAVEGADOR GARANTIZA QUE VA FLUIDO (2026-08-15) ──
     El H.264 de este hero va a 10,3 Mbit/s (desktop) y 11,2 (ultra). A ese
     caudal, los ~0,6 s de vídeo que hacen falta para arrancar sin tirones son
     ~800 KB, y hasta que no llegan el pájaro está CONGELADO. Medido en
     producción: primer fotograma en movimiento a los 6,63 s. Ese era el "tarda
     muchísimo en empezar a volar".

     AV1 da la misma imagen por ~45% de los bytes (medido con VMAF, no de
     oídas: ver la nota del vault). Menos bytes por segundo = el arranque llega
     antes, SIN tocar resolución ni recomprimir el H.264, que es justo lo que
     la Ley 5 prohíbe. El H.264 se queda como base universal.

     LA ELECCIÓN NO SE HACE CON canPlayType. `canPlayType` dice "probably" en
     cuanto existe un decodificador, aunque sea por software — y un AV1 de
     3840x1630 decodificado por CPU en un portátil viejo va a tirones, que es
     peor que esperar. `mediaCapabilities.decodingInfo` es la única API que
     responde a la pregunta real: ¿este fichero concreto, a este tamaño y a
     este bitrate, se reproduce SIN saltos? Se exige `smooth`. NO se exige
     `powerEfficient`: eso significa decodificador por hardware, y muchos
     sobremesa decodifican AV1 por software perfectamente fluido — pedirlo
     mandaría a casi todo el escritorio al H.264 y no serviría de nada. En
     móvil el máster son 540x970, donde esto no es discusión.

     Es una consulta local, sin red: resuelve en el mismo tick, no retrasa nada. */
  function elegirFichero(pick) {
    var mc = navigator.mediaCapabilities;
    if (!pick.av1 || !mc || !mc.decodingInfo) { return Promise.resolve(pick.src); }
    return mc.decodingInfo({
      type: "file",
      video: { contentType: 'video/mp4; codecs="av01.0.08M.08"',
               width: pick.w, height: pick.h, bitrate: pick.br, framerate: 24 }
    }).then(function (r) {
      return (r && r.supported && r.smooth) ? pick.av1 : pick.src;
    }).catch(function () { return pick.src; });
  }
  /* el poster va SIEMPRE de inmediato: es la capa que sostiene el primer
     pintado y la que sigue tapando el hueco si el vídeo se atasca */
  function applyPoster(pick) {
    video.poster = pick.poster;
    media.style.setProperty("--hero-poster", 'url("' + pick.poster + '")');
  }
  var arrancarEscapeHatch = function () {};   /* lo rellena el bloque de arranque de abajo */
  var armado = false;
  /* CUÁNDO SE PIDE EL VÍDEO — corregido el 2026-08-15.
     Antes esto esperaba al evento `load`, o sea a que hubiera llegado TODO lo
     demás. Medido en producción con eso puesto: el src no se asignaba hasta los
     6,28 s y el primer fotograma en movimiento llegaba a los 6,63 s. Seis
     segundos y medio de pájaro congelado con un servidor que sirve el máster
     entero en 1,4 s — la espera no la imponía la red, la imponíamos nosotros.

     Ahora se pide en cuanto el POSTER está dentro. Ese es el momento correcto y
     no el primer pintado a secas: el poster es el elemento LCP, va precargado
     con fetchpriority=high, y mientras no haya llegado, meter el vídeo en la
     cola le quita ancho de banda a lo único que el visitante ve. En cuanto está,
     ya no hay nada delante que proteger. El `new Image()` no descarga nada dos
     veces: la precarga del <head> ya lo puso en caché, así que esto resuelve
     prácticamente en el acto y solo sirve de señal.
     El tope de 900 ms es por si el poster no llega (caché rara, 404): el hero
     no puede quedarse esperando a una señal que no va a venir. */
  function armarVideo() {
    if (armado) { return; }
    armado = true;
    var pick = chooseSrc();
    elegirFichero(pick).then(function (url) {
      /* preload="auto" AQUI, al armar (2026-09-26). El HTML lleva "none" para no pelear con
         el poster, pero con "none" el navegador se queda en los metadatos (300 bytes) y no
         baja ni un fotograma hasta que alguien llama a play(). Y play() solo se llamaba con
         0,6 s en el buffer: se esperaban el uno al otro y quien rompia el empate era el
         reintento de 1,2 s. Medido en vivo: listo a los 0,78 s, volando a los 1,70 s.
         Alex: "el pajaro esta quieto y tarda como 2 segundos en empezar a volar". */
      video.preload = "auto";
      video.src = url;
      video.load();
      arrancarEscapeHatch();
    });
  }
  function armarTrasPoster() {
    var pick = chooseSrc();
    applyPoster(pick);
    var disparado = false;
    var go = function () { if (!disparado) { disparado = true; armarVideo(); } };
    var img = new Image();
    img.onload = go; img.onerror = go;
    img.src = pick.poster;
    if (img.complete) { go(); }
    setTimeout(go, 900);
  }
  /* rotating a phone crosses the device class: the 9:16 master in a 2.16:1
     viewport (or vice versa) is a razor-thin crop — hot-swap the source.
     Returns true when a swap actually happened. */
  function swapIfCrossed() {
    var pick = chooseSrc();
    /* se comprueban LOS DOS nombres: según el navegador estará sonando el AV1
       o el H.264, y comparar solo contra uno hacía un swap infinito */
    if (video.src.indexOf(pick.src) !== -1 ||
        (pick.av1 && video.src.indexOf(pick.av1) !== -1)) { return false; }
    media.classList.remove("vid");
    video.classList.remove("on");
    applyPoster(pick);
    armado = false;
    armarVideo();
    return true;
  }
  function onMQChange(fn) {
    if (mqMobile.addEventListener) { mqMobile.addEventListener("change", fn); }
    else if (mqMobile.addListener) { mqMobile.addListener(fn); }
  }
  video.removeAttribute("autoplay");
  applyPoster(chooseSrc());   /* poster ya; el src lo pone armarVideo() tras el poster */

  /* the hero loop and the scroll companion (bird.js) are brand content, not
     gratuitous motion — they stay on under prefers-reduced-motion. Only the
     text-slide/zoom choreography (CSS, gated separately) backs off. */
  {
    var started = false;
    /* PISTA DE DESPEGUE: 0,6 s, no 2 s (2026-08-15).
       La barrera vieja pedía 2 segundos de vídeo en el buffer antes de mover un
       fotograma. A 10,3 Mbit/s eso son ~2,6 MB, y sumados a que el src ni
       siquiera se pedía hasta el evento `load`, daban los 6,63 s medidos.
       La pregunta correcta no es "¿cuánto llevo descargado?" sino "¿puedo
       seguir hacia delante sin pararme?", y eso es exactamente readyState 3
       (HAVE_FUTURE_DATA). Se le suma medio segundo largo de colchón porque
       readyState 3 puede darse con un pelo de margen.
       Lo que hacía cara la barrera de 2 s era el miedo a un atasco a media
       reproducción — ese miedo ahora lo cubre la guarda de abajo, que devuelve
       el poster en vez de dejar un fotograma clavado. Con la red de seguridad
       puesta, esperar de más solo cuesta segundos de pájaro quieto. */
    var RUNWAY = 0.6;
    var readyEnough = function () {
      try {
        return video.readyState >= 3 && video.buffered.length > 0 &&
               video.buffered.end(video.buffered.length - 1) >=
                 Math.min(video.duration - 0.05, RUNWAY);
      } catch (err) { return false; }
    };
    /* GUARDA DE ATASCO. El poster NO se tira a los 1.200 ms por reloj: se tira
       cuando el vídeo se ha ganado el sitio (buffer holgado y reproduciendo de
       verdad). Mientras no se lo haya ganado, un `waiting` devuelve la capa del
       poster — que sigue derivando, o sea que la página nunca enseña un
       fotograma congelado, que es peor que no enseñar vídeo.
       Arrancar antes solo es una mejora si el arranque es SEGURO; sin esto,
       adelantar el play() sería cambiar 6 s de espera por un tirón. */
    var seguro = false;
    var afianzar = function () {
      if (seguro || !started || video.paused) { return; }
      try {
        if (video.buffered.length &&
            video.buffered.end(video.buffered.length - 1) - video.currentTime >= 4) {
          seguro = true;
          media.classList.add("vid");
        }
      } catch (err) { /* buffered puede lanzar en estados raros */ }
    };
    video.addEventListener("timeupdate", afianzar);
    video.addEventListener("progress", afianzar);
    video.addEventListener("waiting", function () {
      if (!seguro) { video.classList.remove("on"); }
    });
    video.addEventListener("playing", function () {
      video.classList.add("on");
      afianzar();
    });
    var reveal = function () { video.classList.add("on"); };
    /* Start the instant there is runway; reveal on the FIRST rendered
       frame. The fastdecode encodes warm up in 1-3 frames (~50ms), hidden
       under the crossfade — instant motion beats a perfect wait. */
    var firstFrame = function () {
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(reveal);
      } else {
        reveal();
      }
    };
    var begin = function () {
      if (started) { return; }
      started = true;
      /* el hero ya no compite con nadie: se sueltan los que esperaban turno
         (el pre-calentado de los previews, 13 MB el primero) */
      heroArrancado = true;
      while (colaTrasHero.length) { colaTrasHero.shift()(); }
      var pr = video.play();
      if (pr && pr.then) {
        pr.then(firstFrame).catch(function () { /* poster stays — fine */ });
      } else {
        firstFrame();
      }
    };
    var maybe = function () { if (readyEnough()) { begin(); } };
    maybe(); /* cached loads are often ready before listeners attach */
    video.addEventListener("loadeddata", maybe);
    video.addEventListener("progress", maybe);
    video.addEventListener("canplaythrough", maybe);
    /* La red de seguridad (una carga lenta arranca igual) ya NO se arma aqui: aqui el video
       todavia no tiene src, asi que contar 1.200 ms desde este punto era contarlos contra
       una descarga que aun no habia empezado y `begin()` saltaba sobre un video vacio. Se
       arma desde armarVideo(), cuando la descarga arranca de verdad. */
    /* RED DE SEGURIDAD QUE NO EMPEORA LAS COSAS (2026-08-15).
       Antes esto era `setTimeout(begin, 1200)` a secas: pasado el plazo se
       arrancaba SÍ O SÍ. Medido con 4 Mbit simulados y viewport de escritorio
       (el máster desktop pide 4,4 Mbit/s, o sea que no cabe en esa línea):
       arrancaba a los 2,38 s con 0,25 s de buffer y se atascaba al instante.
       Con la guarda de arriba eso ya no enseña un fotograma congelado — vuelve
       el poster — pero deja al vídeo en un ciclo de arrancar y encallar.
       Ahora el plazo REINTENTA en vez de forzar: cada 1,2 s comprueba si de
       verdad puede tirar hacia delante. Y si tras ~6 s sigue sin poder, se
       rinde a propósito y la página se queda con el poster. Un hero a tirones
       es peor que un hero quieto: el poster es el mismo fotograma y no delata
       que la línea no da. */
    arrancarEscapeHatch = function () {
      var intentos = 0;
      (function reintenta() {
        if (started) { return; }
        intentos++;
        if (readyEnough() || video.readyState >= 3) { begin(); return; }
        if (intentos >= 5) { return; }   /* nos rendimos: se queda el poster */
        setTimeout(reintenta, 1200);
      })();
    };
    /* si aun arrancando resulta que la línea no sostiene el bucle, se para y se
       vuelve al poster para siempre en vez de dar tirones eternos */
    var atascos = 0;
    video.addEventListener("waiting", function () {
      if (seguro) { return; }
      if (++atascos >= 3) {
        video.pause();
        video.classList.remove("on");
      }
    });
    /* CUÁNDO SE PIDE EL LOOP: en cuanto el POSTER está dentro — ya no en `load`.
       QUÉ DECÍA AQUÍ ANTES, Y POR QUÉ YA NO VALE: "probado adelantarlo con dos
       rAF y era peor, FCP 1,5 s contra 0,9 s". Aquella medida era correcta pero
       de OTRO escenario: entonces el vídeo eran 15,4 MB de H.264 y además
       arrancaba a la vez que `prev_aurel.mp4` (13 MB), que se precalentaba solo.
       Con 28 MB peleándose, claro que adelantar el vídeo estropeaba el primer
       pintado. Quitados los dos motivos — AV1 al 45% y el preview ya no compite
       (ver más abajo) — esperar a `load` solo aporta espera: son los 6,63 s
       medidos el 15-ago hasta que el pájaro se movía. La regla que queda es la
       de siempre: no adelantarse al LCP, pero tampoco esperar a nada más.

       AHORRO DE DATOS: sin cambios. En conexión pobre o con "ahorro de datos"
       no se pide el vídeo y la página se queda en el poster, que es exactamente
       el mismo fotograma. Cambia la factura de datos de un lead que abre el
       correo en la calle, que es de donde viene nuestro tráfico. */
    var con = navigator.connection || {};
    var redPobre = con.saveData === true ||
                   /(^|-)2g$/.test(con.effectiveType || "") ||
                   con.effectiveType === "3g";
    if (redPobre) {
      /* nada que hacer: el poster ya esta puesto y es el mismo fotograma */
    } else {
      armarTrasPoster();
      /* Respaldo del respaldo: armarTrasPoster ya lleva su propio tope de 900 ms
         por si el poster no llega nunca. Este segundo tope cubre el caso de que
         ni siquiera se ejecute esa rama. Sin él, el hero se quedaría en poster
         fijo para siempre, que es el único fallo inaceptable de este bloque. */
      setTimeout(armarVideo, 2500);
    }

    /* decode costs nothing while the hero is scrolled away */
    var heroOn = true;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        heroOn = en.isIntersecting;
        if (!started) { return; }
        if (heroOn) {
          var pr = video.play(); if (pr && pr.catch) { pr.catch(function () {}); }
        } else {
          video.pause();
        }
      });
    }, { threshold: 0 }).observe(video);

    /* browsers pause media when the tab goes to the background or the page
       comes back from the back-forward cache — and nothing resumes it. The
       frozen hero on tab return was exactly this. Resume explicitly. */
    var resumeMedia = function () {
      if (started && heroOn && video.paused) {
        var pr = video.play(); if (pr && pr.catch) { pr.catch(function () {}); }
      }
      document.querySelectorAll(".piece.playing video.preview").forEach(function (pv) {
        if (pv.paused) {
          var pp = pv.play(); if (pp && pp.catch) { pp.catch(function () {}); }
        }
      });
    };
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) { resumeMedia(); }
    });
    window.addEventListener("pageshow", resumeMedia);

    /* phone rotated across the device class: swap master, replay, re-reveal */
    onMQChange(function () {
      if (!swapIfCrossed()) { return; }
      var pr = video.play();
      if (pr && pr.then) { pr.then(firstFrame).catch(function () {}); }
      else { firstFrame(); }
    });
  }
  }

  /* ── load choreography ── */
  requestAnimationFrame(function () {
    document.body.classList.add("ready");
  });

  /* ── work previews: hover to play (desktop) / tap to play (touch).
     One decoder at a time; anything off-screen is paused.

     The preview master is 13 MB — by far the heaviest asset on the site.
     On desktop it is pre-warmed so the first hover is instant. On touch it
     is NEVER fetched unasked: on a phone it is 77% of the page weight, it
     starved the bird sprites of bandwidth, and it left an Android on data
     unable to finish loading at all. The 2264px still carries the card;
     a tap opts in. ── */
  var hoverable = matchMedia("(hover: hover)").matches;
  var active = null;

  document.querySelectorAll(".piece[data-preview]").forEach(function (card, i) {
    var v = card.querySelector("video.preview");
    if (!v) { return; }
    var armed = false;

    function arm() {
      if (armed) { return; }
      armed = true;
      v.preload = "auto";
      v.src = card.getAttribute("data-preview");
      v.load();
    }
    /* the fade-in keys off actual rendered frames, not the play() promise */
    v.addEventListener("playing", function () { card.classList.add("playing"); });

    function play() {
      if (active && active !== stop) { active(); }
      active = stop;
      arm();
      var pr = v.play();
      if (pr && pr.catch) { pr.catch(function () { /* keep the still — fine */ }); }
    }
    function stop() {
      if (active === stop) { active = null; }
      card.classList.remove("playing");
      if (armed) { v.pause(); }
    }

    if (hoverable) {
      /* warm the buffer as the card approaches the viewport, so the first
         hover starts instantly instead of waiting on a cold download —
         but only the FIRST card gets that 400px lead. The second build
         brings another 13 MB master, and with the same lead both cards
         (they are barely 3rem apart) started downloading in the same
         breath: 26 MB racing each other on one connection, so the card
         actually under the cursor loaded SLOWER than when it was alone.
         The rest warm on entry — still seconds before a cursor reaches
         them, and by then the first one is done. */
      /* EL PRE-CALENTADO ESPERA AL HERO (2026-08-15). Con `rootMargin: 400px`
         la primera tarjeta entra en zona nada más cargar la página — en un
         viewport de 1440 px de alto la sección Work empieza a ~150 px por
         debajo del pliegue, o sea dentro del margen. Resultado: `prev_aurel.mp4`
         (13 MB, el fichero más pesado del sitio) arrancaba su descarga ANTES de
         que el hero hubiera pedido su primer byte, y los dos se repartían la
         línea. Eso es la mitad de los 6,63 s que tardaba el pájaro en moverse.
         El pre-calentado sigue existiendo — el primer hover tiene que ser
         instantáneo — pero va detrás del hero, no delante. Nadie llega a la
         sección Work en el segundo 1. */
      var warm = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { trasHero(arm); warm.unobserve(card); }
        });
      }, { rootMargin: i === 0 ? "400px 0px" : "0px" });
      warm.observe(card);

      card.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "touch") { play(); }
      });
      card.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "touch") { stop(); }
      });
      card.addEventListener("focus", play);
      card.addEventListener("blur", stop);
      /* safety net: a playing preview scrolled off-screen stops decoding */
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) { stop(); }
        });
      }, { threshold: 0 }).observe(card);
    } else if (!reduced) {
      /* tap to opt in, tap again to stop. The fetch starts inside the
         gesture, so autoplay policy is satisfied and the download is
         something the visitor asked for. */
      card.addEventListener("click", function (e) {
        /* el enlace "Open live site" queda FUERA del reproductor (2026-08-16): es el
           unico camino desde la portada hasta una obra terminada, y en un movil el
           mismo toque no puede significar dos cosas. Sin esto, tocar el enlace
           arrancaria ademas el video justo antes de abandonar la pagina. */
        if (e.target.closest(".piece-open")) { return; }
        if (v.paused) { play(); } else { stop(); }
      });
      /* off-screen stops the decoder, same as desktop */
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) { stop(); }
        });
      }, { threshold: 0 }).observe(card);
    }
  });

  /* the section note says "Hover to browse" — on a phone that instruction
     is simply false, and without it nobody discovers the tap */
  if (!hoverable) {
    var note = document.querySelector(".work .sec-note");
    if (note) { note.textContent = "Tap to browse the site."; }
    document.querySelectorAll(".piece[data-preview] .chip").forEach(function (c) {
      c.textContent = "Tap to play";
    });
  }

  /* ── Lenis smooth scroll — the ONLY smoothing layer ── */
  if (!reduced && typeof Lenis === "function") {
    var lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 1 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var t = document.querySelector(a.getAttribute("href"));
        if (t) { e.preventDefault(); lenis.scrollTo(t, { duration: 1.4, offset: -110 }); }
      });
    });
  }

  // Contact submission is handled by contact-form.js.

  /* ── the studio promise fills in word by word (spans indexed for the
     CSS stagger; the reveal IO below triggers it via the .in class) ── */
  var stmt = document.querySelector(".about h1, .about h2");
  if (stmt) {
    stmt.innerHTML = stmt.textContent.trim().split(" ").map(function (w, i) {
      return '<span class="w" style="--i:' + i + '">' + w + "</span>";
    }).join(" ");
  }

  /* ── scroll reveals (IO, no scroll listeners) ── */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
})();
