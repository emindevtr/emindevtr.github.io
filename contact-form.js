/* Shared contact behavior. A failed or unconfirmed delivery never erases a draft. */
(function () {
  'use strict';
  var form = document.getElementById('conceptForm');
  if (!form || form.dataset.contactBound) return;
  form.dataset.contactBound = '1';
  var status = document.getElementById('cfStatus');
  var button = form.querySelector('.btn-form');
  var busy = false;
  var listedEmail = document.querySelector('a[href^="mailto:"]');
  var recipient = listedEmail ? listedEmail.getAttribute('href').split('?')[0] : 'mailto:oeminsisman@gmail.com';
  var fallback = document.createElement('a');
  fallback.textContent = 'Email your request instead';
  fallback.hidden = true;
  fallback.className = 'form-email-fallback';
  fallback.style.textDecoration = 'underline';
  status.after(fallback);

  var plan = form.querySelector('[name="plan"]');
  var planHelp = document.getElementById('cfPlanHelp');
  function updatePlan() {
    if (planHelp && plan) planHelp.textContent = planHelp.dataset[plan.value] || '';
  }
  if (plan) {
    var requestedPlan = new URLSearchParams(location.search).get('plan');
    if (['store', 'brand', 'hero'].includes(requestedPlan)) plan.value = requestedPlan;
    plan.addEventListener('change', updatePlan);
    document.querySelectorAll('a[data-plan]').forEach(function (link) {
      link.addEventListener('click', function () { plan.value = link.dataset.plan; updatePlan(); });
    });
    updatePlan();
  }
  function notice(name, reason) {
    form.dispatchEvent(new CustomEvent(name, {detail: {reason: reason || ''}}));
  }

  function show(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }
  function mailto(data) {
    var subject = 'Website project enquiry — ' + data.get('business');
    var body = data.get('message') + '\n\n— ' + data.get('business') +
      '\nReply to: ' + data.get('email');
    return recipient + '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
  }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (busy) return;
    // The bubble from reportValidity() is not reliable inside the Instagram/Facebook in-app
    // browsers, where the ad traffic lands: without a written message, Send just did nothing.
    if (!form.reportValidity()) {
      notice('ascenta:form-error', 'validation');
      show('Please fill in the empty fields and use a valid email.', 'err');
      var invalid = form.querySelector(':invalid');
      if (invalid) invalid.focus();
      return;
    }
    busy = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    fallback.hidden = true;
    show('Sending…', '');
    var data = new FormData(form);
    // Current landing URL only: no cookies, storage, click IDs or tracking pixels.
    var params = new URLSearchParams(window.location.search);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      var value = (params.get(key) || '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 120);
      if (value) data.set(key, value);
    });
    try {
      var referrerHost = new URL(document.referrer).hostname;
      if (referrerHost && referrerHost !== window.location.hostname) data.set('referrer_host', referrerHost);
    } catch (_) { /* No usable referrer: leave it absent. */ }
    var controller = new AbortController();
    var timer;
    try {
      // Race includes reading the response body. Abort alone does not bound a stalled body.
      var result = await Promise.race([
        (async function () {
          var response = await fetch('/contact', {method: 'POST', body: data, signal: controller.signal});
          return {response: response, body: await response.json()};
        })(),
        new Promise(function (_, reject) {
          timer = setTimeout(function () {
            controller.abort();
            reject(new Error('unconfirmed'));
          }, 20000);
        })
      ]);
      var json = result.body;
      if (result.response.status === 422) {
        notice('ascenta:form-error', 'validation');
        show('Please check your business name, email and message, then try again.', 'err');
        return;
      }
      if (result.response.status === 429) {
        notice('ascenta:form-error', 'rate_limit');
        show('Please wait a moment before sending again. Your message is still here.', 'err');
        return;
      }
      // Also protects visitors while a cached older receiver still returns ok:true on failure.
      if (!result.response.ok || !json || json.ok !== true ||
          (json.mailed === false && json.notified === false)) {
        throw new Error(json && json.error === 'delivery_failed' ? 'delivery_failed' : 'unconfirmed');
      }
      // Keep any edits made while this request was in flight; they were not sent.
      var current = new FormData(form);
      var unchanged = ['business', 'email', 'message', 'plan', 'tienda_url'].every(function (key) {
        return current.get(key) === data.get(key);
      });
      if (unchanged) { form.reset(); updatePlan(); }
      // The reply comes from the listed address; say which one and where to look for it.
      var replyFrom = recipient.replace(/^mailto:/, '');
      show(unchanged ? 'Thanks, your request has been sent. We will reply about your project from ' + replyFrom +
        '. If you do not see it, check your spam folder.' :
        'Your request was sent. Your newer edits are still here and have not been sent.', 'ok');
      // Delivered: /meta-pixel.js (only on /brands) listens for this to record the Lead.
      form.dispatchEvent(new CustomEvent('ascenta:sent'));
    } catch (error) {
      notice('ascenta:form-error', error.message === 'delivery_failed' ? 'delivery_failed' : 'unconfirmed');
      show(error.message === 'delivery_failed' ?
        "We couldn't deliver your request. Your message is still here. Try again or email us below." :
        "We couldn't confirm delivery. Your message is still here. Retry or email us below; we may receive a duplicate.", 'err');
      fallback.href = mailto(data);
      fallback.hidden = false;
    } finally {
      clearTimeout(timer);
      busy = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();
