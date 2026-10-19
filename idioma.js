/* TIKLIVEauto — idiomas de la web.
   Va en el <head>. Elige el idioma (el que eligió la persona, o el de su navegador), carga el
   diccionario y, al final de la página, TLA_aplicar() cambia los textos marcados con data-t.
   Para agregar o corregir un texto: i18n/<idioma>.js (la clave sale de es.js). */
(function () {
  var IDIOMAS = [
    ['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français'], ['it', 'Italiano'],
    ['ar', 'العربية'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文']
  ];
  var codigos = IDIOMAS.map(function (x) { return x[0]; });
  var elegido = null;
  try { elegido = localStorage.getItem('tla_idioma'); } catch (e) {}
  try { var q = new URLSearchParams(location.search).get('lang'); if (q) elegido = q; } catch (e) {}
  if (codigos.indexOf(elegido) < 0) {
    elegido = 'es';
    var nav = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'es'];
    for (var i = 0; i < nav.length; i++) {
      var c = String(nav[i] || '').slice(0, 2).toLowerCase();
      if (codigos.indexOf(c) >= 0) { elegido = c; break; }
    }
  }
  var html = document.documentElement;
  html.lang = elegido;
  if (elegido === 'ar') html.dir = 'rtl';
  window.TLA_IDIOMA = elegido;
  window.TLA_IDIOMAS = IDIOMAS;
  var base = (document.currentScript && document.currentScript.src || '').replace(/idioma\.js.*$/, '');
  if (elegido !== 'es') {
    html.className += ' tla-trad';
    document.write('<style>html.tla-trad body{visibility:hidden}</style>');
    document.write('<script src="' + base + 'i18n/' + elegido + '.js?v=1"><\/script>');
  }
  // Traducir un texto armado desde JavaScript (busca por el texto en español)
  window.tr = function (es) {
    var d = window.TLA_X;
    return (d && es && d[es]) || es;
  };
  window.TLA_aplicar = function () {
    var D = window.TLA_T;
    if (D) {
      var els = document.querySelectorAll('[data-t]');
      for (var i = 0; i < els.length; i++) { var t = D[els[i].getAttribute('data-t')]; if (t) els[i].innerHTML = t; }
      ['placeholder', 'title', 'aria-label', 'alt', 'content'].forEach(function (at) {
        var l = document.querySelectorAll('[data-t-' + at + ']');
        for (var j = 0; j < l.length; j++) { var v = D[l[j].getAttribute('data-t-' + at)]; if (v) l[j].setAttribute(at, v.replace(/<[^>]+>/g, '')); }
      });
      if (document.title && D._titulo) document.title = D._titulo;
    }
    ponerSelector();
    html.className = html.className.replace(' tla-trad', '');
  };
  function ponerSelector() {
    if (document.getElementById('tla-idioma')) return;
    var cont = document.querySelector('.barra nav') || document.querySelector('header') || document.body;
    var s = document.createElement('select');
    s.id = 'tla-idioma';
    s.setAttribute('aria-label', 'Idioma / Language');
    s.style.cssText = 'background:rgba(12,20,36,.9);color:inherit;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:6px 8px;font:inherit;font-size:14px;cursor:pointer;margin-inline-start:8px;max-width:' + (innerWidth < 700 ? '96px' : '170px') + ';text-overflow:ellipsis';
    IDIOMAS.forEach(function (x) {
      var o = document.createElement('option'); o.value = x[0]; o.textContent = '🌐 ' + x[0].toUpperCase() + '  ' + x[1];
      if (x[0] === elegido) o.selected = true; s.appendChild(o);
    });
    s.onchange = function () {
      try { localStorage.setItem('tla_idioma', s.value); } catch (e) {}
      // Siempre recargar (aunque la dirección tenga #planes) y dejar el idioma en la dirección,
      // así funciona también en navegadores que no guardan datos (celular, modo privado).
      var u = new URL(location.href); u.searchParams.set('lang', s.value);
      try { history.replaceState(null, '', u.toString()); } catch (e) {}
      location.reload();
    };
    cont.appendChild(s);
  }
  // Por si algo falla: nunca dejar la página invisible
  setTimeout(function () { html.className = html.className.replace(' tla-trad', ''); }, 4000);
})();
