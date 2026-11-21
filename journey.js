/* Anonymous event counts per page load. No identities, form values, cookies or click IDs. */
(function () {
  'use strict';
  if (navigator.webdriver) return;
  var path = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  var page = ({'/':'home','/brands':'brands','/work':'work','/website-services':'services','/content-services':'content','/contact':'contact'})[path];
  if (!page) return;
  var counted = new Set();
  function event(name) {
    if (counted.has(name)) return;
    counted.add(name);
    fetch('/events?page=' + page + '&stage=' + name, {cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', keepalive:true}).catch(function () {});
    window.dispatchEvent(new CustomEvent('ascenta:journey', {detail:{stage:name,page:page}}));
  }
  event('view');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { event(entry.target.id === 'pricing' ? 'pricing' : 'form_view'); observer.unobserve(entry.target); }
      });
    }, {threshold:0.15});
    ['pricing','conceptForm'].forEach(function (id) { var el=document.getElementById(id); if(el) observer.observe(el); });
  }
  document.addEventListener('click', function (e) {
    var link=e.target.closest('a[href]'); if (!link) return;
    var href=link.getAttribute('href');
    if (href === '#contact' || /^\/contact(?:\?|$)/.test(href)) event('cta');
    if (/^https:\/\/ig\.me\//.test(href)) event('instagram');
    if (link.classList.contains('piece-open')) event('sample');
  }, true);
  var form=document.getElementById('conceptForm');
  if (form) {
    form.addEventListener('input',function(){event('form_start');},{once:true});
    form.addEventListener('ascenta:form-error',function(e){
      event(e.detail.reason === 'validation' ? 'validation_error' : 'delivery_error');
    });
    form.addEventListener('ascenta:sent',function(){event('form_sent');});
  }
})();
