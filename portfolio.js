/* Optional previews on the full work page, loaded only when requested. */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !matchMedia('(hover:hover)').matches) return;
  var active;
  function stop(card) { var video=card.querySelector('.preview');if(video)video.pause();card.classList.remove('playing'); }
  document.querySelectorAll('.piece[data-preview]').forEach(function (card) {
    var video=card.querySelector('.preview'); if(!video)return;
    function play() {
      if(active && active!==card)stop(active); active=card;
      if(!video.src)video.src=card.dataset.preview;
      video.play().then(function(){if(active===card)card.classList.add('playing');}).catch(function(){});
    }
    card.addEventListener('mouseenter',play);card.addEventListener('focusin',play);
    card.addEventListener('mouseleave',function(){stop(card);if(active===card)active=null;});
    card.addEventListener('focusout',function(e){if(!card.contains(e.relatedTarget)){stop(card);if(active===card)active=null;}});
    new IntersectionObserver(function(entries){if(!entries[0].isIntersecting)stop(card);}).observe(card);
  });
})();
