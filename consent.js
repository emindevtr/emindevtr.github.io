/* Optional cookies: prior, purpose-specific choice in every country. */
(function () {
  'use strict';
  var VERSION = '2', MAX_AGE = 15552000, previousFocus;
  var advertising = !!document.querySelector('script[src*="meta-pixel.js"]');
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? m[1] : '';
  }
  function set(name, value) {
    document.cookie = name + '=' + value + ';path=/;max-age=' + MAX_AGE + ';SameSite=Lax;Secure';
  }
  function allowed(purpose) {
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return false;
    return cookie('asc_privacy_v') === VERSION && cookie('asc_' + purpose) === '1';
  }
  function eraseOptional(analytics, ads) {
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.split('=')[0].trim();
      if (!/^(_ga(?:_|$)|_fbp$|_fbc$|ph_)/.test(name)) return;
      if (/^(_ga|ph_)/.test(name) && analytics) return;
      if (/^_fb/.test(name) && ads) return;
      ['', location.hostname, '.' + location.hostname, '.' + location.hostname.replace(/^www\./, '')].forEach(function (domain) {
        document.cookie = name + '=;path=/;max-age=0;SameSite=Lax;Secure' + (domain ? ';domain=' + domain : '');
      });
    });
    // PostHog also keeps its anonymous id in localStorage.
    if (!analytics) try {
      Object.keys(localStorage).forEach(function (key) { if (/^(ph_|__ph_)/.test(key)) localStorage.removeItem(key); });
      Object.keys(sessionStorage).forEach(function (key) { if (/^(ph_|__ph_)/.test(key)) sessionStorage.removeItem(key); });
    } catch (err) {}
  }
  function close() {
    var box = document.getElementById('ascConsent');
    if (box) box.remove();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
  }
  function save(analytics, ads) {
    var was = {analytics:allowed('analytics'),ads:allowed('ads')};
    var signal = navigator.globalPrivacyControl || navigator.doNotTrack === '1';
    analytics = analytics && !signal; ads = ads && !signal;
    set('asc_privacy_v', VERSION);set('asc_analytics', analytics ? '1' : '0');set('asc_ads', ads ? '1' : '0');
    set('asc_consent', '0');
    eraseOptional(analytics, ads);
    close();
    window.dispatchEvent(new CustomEvent('asc:privacy', {detail:{analytics:analytics,ads:ads}}));
    // Reload after withdrawal so previously downloaded vendor code cannot keep running.
    if ((was.analytics && !analytics) || (was.ads && !ads)) location.reload();
  }
  function banner(focus) {
    if (document.getElementById('ascConsent')) return;
    previousFocus = focus ? document.activeElement : null;
    var box = document.createElement('section');
    box.id = 'ascConsent';box.className = 'analytics-choice';
    box.setAttribute('role','dialog');box.setAttribute('aria-labelledby','ascPrivacyTitle');
    box.innerHTML = '<h2 id="ascPrivacyTitle">Your privacy choices</h2>' +
      '<p>With your permission, Google Analytics and PostHog help us understand how this website is used, including which parts get clicked.' +
      (advertising ? ' Meta cookies measure advertising on this page.' : '') +
      ' Optional cookies stay off until you choose. <a href="/privacy">Privacy policy</a></p>' +
      '<div class="privacy-actions"><button type="button" data-choice="accept">Accept all</button><button type="button" data-choice="reject">Reject all</button></div>' +
      '<button type="button" class="privacy-customize" aria-expanded="false">Customize choices</button>' +
      '<div class="privacy-options" hidden><label><input type="checkbox" name="analytics"> Analytics <span>Google Analytics and PostHog heatmaps</span></label>' +
      (advertising ? '<label><input type="checkbox" name="ads"> Advertising <span>Meta Pixel and Conversions API</span></label>' : '') +
      '<p>Essential functions and your privacy choice are always available.</p><button type="button" data-choice="save">Save choices</button></div>';
    box.querySelector('[name="analytics"]').checked = allowed('analytics');
    if (advertising) box.querySelector('[name="ads"]').checked = allowed('ads');
    box.addEventListener('click', function (event) {
      var action = event.target.closest('[data-choice]');
      if (action) {
        var kind = action.dataset.choice;
        save(kind === 'accept' || (kind === 'save' && box.querySelector('[name="analytics"]').checked),
          (kind === 'accept' && advertising) || (kind === 'save' && advertising && box.querySelector('[name="ads"]').checked));
      }
      var customize = event.target.closest('.privacy-customize');
      if (customize) {
        var open = customize.getAttribute('aria-expanded') !== 'true';
        customize.setAttribute('aria-expanded',String(open));box.querySelector('.privacy-options').hidden = !open;
      }
    });
    document.body.appendChild(box);
    if (focus) box.querySelector('button').focus({preventScroll:true});
  }
  window.ascentaPrivacy = {allowed:allowed,open:function(){banner(true);}};
  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (link && /^(?:\/(?:brands)?)?#cookies$/.test(link.getAttribute('href'))) {
      event.preventDefault();banner(true);
    }
  });
  addEventListener('hashchange', function () {if(location.hash === '#cookies') banner(true);});
  if (location.hash === '#cookies' || cookie('asc_privacy_v') !== VERSION) banner(false);
  eraseOptional(allowed('analytics'), allowed('ads'));
})();
