/* Local copy: TR/EN switch. HTML stays English; this swaps text to Turkish from window.I18N_TR
   (loaded just before this file) and keeps translating text that the page's own scripts add later.
   Load in <head>, synchronously, so text is swapped before first paint. */
(function () {
  var KEY = "lang";
  var lang = "tr";
  try { if (localStorage.getItem(KEY) === "en") lang = "en"; } catch (e) {}
  var root = document.documentElement;
  root.lang = lang;

  function setLang(l) {
    try { localStorage.setItem(KEY, l); } catch (e) {}
    location.reload(); // simplest way back to the untouched English text
  }

  function toggle() {
    if (document.getElementById("i18n-toggle")) return;
    var box = document.createElement("div");
    box.id = "i18n-toggle";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", lang === "tr" ? "Dil" : "Language");
    ["tr", "en"].forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = l.toUpperCase();
      b.setAttribute("aria-pressed", String(l === lang));
      b.setAttribute("lang", l);
      b.addEventListener("click", function () { if (l !== lang) setLang(l); });
      box.appendChild(b);
    });
    // studio pages: in the menu, left of the quote button; SEO pages: end of the top bar; demos: floating
    var before = document.querySelector(window.I18N_SLOT || ".nav > .nav-contact, .nav > a.btn");
    var bar = document.querySelector(".bar .wrap");
    if (before) { box.className = "i18n-inline"; before.parentNode.insertBefore(box, before); }
    else if (bar) { box.className = "i18n-inline"; bar.appendChild(box); }
    else { box.className = "i18n-float"; document.body.appendChild(box); }
    var css = document.createElement("style");
    css.textContent =
      "#i18n-toggle{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:rgba(20,33,31,.08);font:600 12px/1 system-ui,sans-serif;letter-spacing:.04em;z-index:2147483000}" +
      "#i18n-toggle button{all:unset;cursor:pointer;padding:7px 10px;border-radius:999px;color:inherit;opacity:.6}" +
      "#i18n-toggle button[aria-pressed=true]{background:#14211f;color:#fff;opacity:1}" +
      "#i18n-toggle button:focus-visible{outline:2px solid #2f6bff;outline-offset:2px}" +
      ".i18n-inline{margin:0 12px;align-self:center;flex:none}" +
      ".i18n-float{position:fixed;left:16px;bottom:72px;background:rgba(255,255,255,.9)!important;color:#14211f;box-shadow:0 4px 16px rgba(0,0,0,.15)}";
    document.head.appendChild(css);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", toggle);
  else toggle();

  // Prices: shown only in Turkish lira, in both languages. Rate: 19 Nov 2026 (USD 50.47, EUR 55.48).
  var RATE = { "$": 50.47, "USD": 50.47, "€": 55.48, "EUR": 55.48 };
  function num(s) {
    // the last separator followed by 1–2 digits is the decimal point; any other separator groups thousands
    var m = s.match(/^(.*?)(?:[.,](\d{1,2}))?$/);
    return parseFloat(m[1].replace(/[.,]/g, "") + (m[2] ? "." + m[2] : ""));
  }
  function lira(n) {
    n = Math.round(n);
    return lang === "tr" ? n.toLocaleString("tr-TR") + " TL" : "₺" + n.toLocaleString("en-US");
  }
  var N = "(\\d[\\d.,]*\\d|\\d)";
  var MONEY = [
    [/USD \$/g, function () { return lang === "tr" ? "TL ₺" : "TRY ₺"; }],
    [new RegExp("\\b(USD|EUR)\\s?" + N + " to " + N, "g"), function (m, c, a, b) { return lira(num(a) * RATE[c]) + " to " + lira(num(b) * RATE[c]); }],
    [new RegExp("(?:US)?([$€])\\s?" + N, "g"), function (m, c, a) { return lira(num(a) * RATE[c]); }],
    [new RegExp("\\b(USD|EUR)\\s?" + N, "g"), function (m, c, a) { return lira(num(a) * RATE[c]); }],
    [new RegExp(N + "\\s?–\\s?" + N + "\\s?(USD|EUR)\\b", "g"), function (m, a, b, c) { return lira(num(a) * RATE[c]) + " – " + lira(num(b) * RATE[c]); }],
    [new RegExp(N + "\\s?(USD|EUR|[$€])", "g"), function (m, a, c) { return lira(num(a) * RATE[c]); }],
    [/TL'd[ae]n/g, "TL'den"]
  ];
  function money(s) {
    if (!/[$€]|USD|EUR/.test(s)) return s;
    for (var i = 0; i < MONEY.length; i++) s = s.replace(MONEY[i][0], MONEY[i][1]);
    return s;
  }

  var D = lang === "tr" ? (window.I18N_TR || {}) : {};
  var ATTRS = ["placeholder", "aria-label", "alt", "title"];
  var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/;

  // text the demos build with numbers/names in it (bag counts, sizes, "X added to bag")
  var RE = [
    [/^(?:Open bag|Bag), (\d+) items?$/, function (m) { return (m[0][0] === "O" ? "Sepeti aç, " : "Sepet, ") + m[1] + " ürün"; }],
    [/^(\d+) items?$/, "$1 ürün"],
    [/^Bag \((\d+)\)(, open bag)?$/, function (m) { return "Sepet (" + m[1] + ")" + (m[2] ? ", sepeti aç" : ""); }],
    [/^(.+) added to (?:your )?bag\.? ?(?:(\d+) items?\.)?$/, function (m) { return m[1].replace(/, size (\S+),$/, ", $1 beden,") + " sepete eklendi." + (m[2] ? " " + m[2] + " ürün." : ""); }],
    [/^Size (\S+) \/ Qty (\d+)$/, "Beden $1 / Adet $2"],
    [/^Remove (.+), size (\S+)$/, "$1, $2 beden, sepetten çıkar"],
    [/^Male model wearing (.+?)(?: in the blue atelier)?$/, "Mavi atölyede $1 giyen erkek manken"],
    [/^(.+) jacket in close-up in the blue atelier$/, "Mavi atölyede $1 ceketin yakın çekimi"],
    [/^(.+) jacket in the blue atelier$/, "Mavi atölyede $1 ceket"],
    [/^added to your bag$/, "sepetinize eklendi"],
    [/^Add to bag · Size (\S+)$/, "Sepete ekle · Ölçü $1"],
    [/^Add to bag · (.+)$/, "Sepete ekle · $1"],
    [/^Ring size (\S+) selected$/, "$1 yüzük ölçüsü seçildi"],
    [/^Add (\d+) ml · (.+)$/, "$1 ml ekle · $2"],
    [/^(\d+) · Nail lacquer$/, "$1 · Oje"],
    [/^(.+) nail lacquer on the hand$/, "Elde $1 oje"],
    [/^(.+) nail lacquer bottle$/, "$1 oje şişesi"],
    [/^Remove (.+) from (?:cart|bag)$/, "$1 ürününü sepetten çıkar"],
    [/^Add (.+) to (?:cart|bag)$/, "$1 ürününü sepete ekle"],
    [/^Qty (\d+)$/, "Adet $1"],
    [/^Pay (.+) now$/, "$1 öde"]
  ];
  function tr(s) {
    var k = s.replace(/\s+/g, " ").trim();
    if (!k) return null;
    var out = null;
    if (D.hasOwnProperty(k)) out = D[k];
    else if (lang === "tr") for (var i = 0; i < RE.length; i++) {
      var m = k.match(RE[i][0]);
      if (m) { out = typeof RE[i][1] === "function" ? RE[i][1](m) : k.replace(RE[i][0], RE[i][1]); break; }
    }
    var cur = money(out === null ? k : out);
    if (cur !== (out === null ? k : out)) out = cur;
    if (out === null) return null;
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    return lead + out + tail;
  }
  function text(n) {
    var p = n.parentNode;
    if (!p || (p.tagName && SKIP.test(p.tagName))) return;
    var t = tr(n.nodeValue);
    if (t !== null && t !== n.nodeValue) n.nodeValue = t;
  }
  function attrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v) { var t = tr(v); if (t !== null && t !== v) el.setAttribute(ATTRS[i], t); }
    }
    if (el.tagName === "INPUT" && /^(submit|button)$/.test(el.type) && el.value) {
      var tv = tr(el.value); if (tv !== null && tv !== el.value) el.value = tv;
    }
    if (el.tagName === "META" && el.name === "description") {
      var tc = tr(el.content); if (tc !== null) el.content = tc;
    }
  }
  function walk(node) {
    if (node.nodeType === 3) return text(node);
    if (node.nodeType !== 1 || SKIP.test(node.tagName)) return;
    attrs(node);
    var w = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) text(n);
      else attrs(n);
    }
  }

  walk(root);
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") text(m.target);
      else if (m.type === "attributes") attrs(m.target);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(["value", "content"]) });
})();
