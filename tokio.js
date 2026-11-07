/* =============================================================
   🦉 TOKIO VOLANDO POR LA WEB (07-11-2026)
   Cada tanto Tokio cruza la pantalla volando y desaparece con un destello.
   - Se carga recién cuando la página ya terminó (no la hace más lenta).
   - No sale si la persona pidió "reducir movimiento" en su equipo.
   - Se pausa si la pestaña no está a la vista.
   - Al tocarlo lleva a la tarjeta del compañero virtual.
============================================================= */
(function () {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var base = (document.currentScript && document.currentScript.src || '').replace(/tokio\.js.*$/, '');
  var IMG = base + 'img/tokio_volando.webp';
  var css = '.tokio-vuela{position:fixed;left:0;top:0;z-index:60;width:var(--tk,170px);height:auto;cursor:pointer;pointer-events:auto;' +
    'filter:drop-shadow(0 8px 18px rgba(0,0,0,.45));will-change:transform,opacity;user-select:none;-webkit-user-drag:none}' +
    '.tokio-chispa{position:fixed;z-index:61;pointer-events:none;font-size:22px;will-change:transform,opacity}' +
    '.tokio-globo{position:fixed;z-index:62;pointer-events:none;background:#0b0f1d;color:#fff;border:1px solid rgba(255,255,255,.18);' +
    'font:700 13px/1.3 Manrope,system-ui,sans-serif;padding:7px 11px;border-radius:12px;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,.4);opacity:0;transition:opacity .3s}' +
    '@media (max-width:640px){.tokio-vuela{--tk:118px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var FRASES = {
    es: ['¡Hola! Soy Tokio 🦉', '¿Querés un compañero como yo?', 'Tocá y te cuento 👋'],
    en: ['Hi! I’m Tokio 🦉', 'Want a companion like me?', 'Tap me 👋'],
    pt: ['Oi! Eu sou o Tokio 🦉', 'Quer um companheiro como eu?', 'Toque em mim 👋'],
  };
  var lang = (window.TLA_IDIOMA || document.documentElement.lang || 'es').slice(0, 2);
  var frases = FRASES[lang] || FRASES.en;

  var volando = false;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function chispas(x, y) {
    for (var i = 0; i < 10; i++) {
      var s = document.createElement('span'); s.className = 'tokio-chispa'; s.textContent = i % 3 ? '✨' : '💜';
      s.style.left = x + 'px'; s.style.top = y + 'px'; document.body.appendChild(s);
      var ang = Math.random() * Math.PI * 2, dist = rnd(30, 90);
      s.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) scale(1.2)', opacity: 0 }],
        { duration: 800, easing: 'ease-out' }).onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }
  function vuelo() {
    if (volando || document.hidden) return programar();
    volando = true;
    var W = innerWidth, H = innerHeight, ancho = W <= 640 ? 118 : 170;
    var izq = Math.random() < 0.5;                      // de qué lado entra
    var y0 = rnd(H * 0.15, H * 0.6), y1 = y0 + rnd(-H * 0.15, H * 0.15);
    var x0 = izq ? -ancho - 20 : W + 20, xf = izq ? W + 20 : -ancho - 20;
    var desaparece = Math.random() < 0.6;               // a veces se esfuma en el medio
    var xFin = desaparece ? rnd(W * 0.35, W * 0.65) : xf;
    var giro = izq ? 'scaleX(-1)' : 'scaleX(1)';        // mira hacia donde vuela
    var t = document.createElement('img'); t.src = IMG; t.alt = 'Tokio'; t.className = 'tokio-vuela'; t.draggable = false;
    t.title = frases[1];
    t.onclick = function () { location.href = base + 'index.html#companero'; };
    document.body.appendChild(t);
    var dur = Math.abs(xFin - x0) / (W <= 640 ? 0.16 : 0.22); // velocidad tranquila
    var pasos = [];
    for (var i = 0; i <= 8; i++) {
      var p = i / 8, x = x0 + (xFin - x0) * p, y = y0 + (y1 - y0) * p + Math.sin(p * Math.PI * 3) * 22;
      pasos.push({ transform: 'translate(' + x + 'px,' + y + 'px) ' + giro + ' rotate(' + (Math.sin(p * 9) * 4) + 'deg)', opacity: 1 });
    }
    var anim = t.animate(pasos, { duration: dur, easing: 'linear', fill: 'forwards' });
    // Globito con una frase, una sola vez en el medio del vuelo
    var globo = document.createElement('div'); globo.className = 'tokio-globo'; globo.textContent = frases[Math.floor(Math.random() * frases.length)];
    document.body.appendChild(globo);
    var tGlobo = setTimeout(function () {
      var r = t.getBoundingClientRect();
      globo.style.left = Math.max(8, Math.min(W - 230, r.left + r.width / 2 - 90)) + 'px'; globo.style.top = Math.max(8, r.top - 34) + 'px';
      globo.style.opacity = 1; setTimeout(function () { globo.style.opacity = 0; }, 1600);
    }, dur * 0.35);
    anim.onfinish = function () {
      clearTimeout(tGlobo); globo.remove();
      if (desaparece) {
        var r = t.getBoundingClientRect(); chispas(r.left + r.width / 2, r.top + r.height / 2);
        t.animate([{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0, filter: 'brightness(2.2)' }], { duration: 450 }).onfinish = function () { t.remove(); };
      } else t.remove();
      volando = false; programar();
    };
  }
  var reloj = null;
  function programar(primera) { clearTimeout(reloj); reloj = setTimeout(vuelo, primera ? rnd(5000, 9000) : rnd(22000, 38000)); }
  function arrancar() { var pre = new Image(); pre.src = IMG; programar(true); }
  if (document.readyState === 'complete') arrancar(); else addEventListener('load', arrancar);
})();
