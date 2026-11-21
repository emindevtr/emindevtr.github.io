/* Newsletter: asks for email confirmation. Nothing is stored until the subscriber confirms. */
(function () {
  'use strict';
  var form = document.querySelector('.newsletter-form');
  if (!form || !window.fetch) return;
  var status = form.querySelector('.newsletter-status');
  var button = form.querySelector('button[type=submit]');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var email = form.elements.email;
    if (!email.checkValidity()) { status.dataset.state = 'error'; status.textContent = 'Please enter a valid email address.'; email.focus(); return; }
    button.disabled = true; status.dataset.state = ''; status.textContent = 'Sending…';
    fetch(form.action, {method:'POST', headers:{'Accept':'application/json'}, body:new FormData(form)})
      .then(function (r) { return r.json().catch(function () { return {ok:false}; }); })
      .then(function (data) {
        status.dataset.state = data.ok ? 'ok' : 'error';
        status.textContent = data.message || 'Something went wrong. Please try again.';
        if (data.ok) { form.reset(); window.dispatchEvent(new CustomEvent('ascenta:journey', {detail:{stage:'newsletter',page:location.pathname}})); }
      })
      .catch(function () { status.dataset.state = 'error'; status.textContent = 'Something went wrong. Please try again.'; })
      .then(function () { button.disabled = false; });
  });
})();
