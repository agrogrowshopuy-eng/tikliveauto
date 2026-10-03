// =============================================================
//  CUENTA: registro / entrada (Google o email) y zona del usuario
//  Guarda en Firestore: usuarios/{uid} = { email, nombre, creado, plan, pruebaHasta, premiumHasta }
// =============================================================
const CFG = window.TIKLIVE_CONFIG;
const $ = (s) => document.querySelector(s);
const DEMO = !CFG.firebaseConfig.apiKey || CFG.firebaseConfig.apiKey === 'PEGAR_AQUI';
const DIA = 24 * 60 * 60 * 1000;
document.getElementById('anio').textContent = new Date().getFullYear();

const urlDescarga = () => CFG.github.usuario && CFG.github.usuario !== 'PEGAR_AQUI'
  ? `https://github.com/${CFG.github.usuario}/${CFG.github.repositorio}/releases/latest/download/TIKLIVEauto-Setup.exe`
  : '#';

// ---------- Vuelta de Mercado Pago: guarda el número de suscripción ----------
// Mercado Pago devuelve a esta página con ?preapproval_id=XXXX. Se guarda en el navegador
// (por si la persona todavía tiene que entrar a su cuenta) y se limpia la dirección.
const CLAVE_MP = 'tla_mp_suscripcion';
(function () {
  try {
    const q = new URLSearchParams(location.search);
    const id = q.get('preapproval_id');
    if (id && /^[A-Za-z0-9]{20,40}$/.test(id)) {
      localStorage.setItem(CLAVE_MP, JSON.stringify({ id, intentos: 0 }));
      q.delete('preapproval_id');
      const resto = q.toString();
      history.replaceState(null, '', location.pathname + (resto ? '?' + resto : ''));
    }
  } catch (e) { /* sin almacenamiento: se sigue igual */ }
})();
function suscripcionPendiente() {
  try { return JSON.parse(localStorage.getItem(CLAVE_MP) || 'null'); } catch (e) { return null; }
}
function avisoPago(texto, bien = false) {
  let a = document.getElementById('aviso-pago');
  if (!a) {
    a = document.createElement('div'); a.id = 'aviso-pago';
    const caja = document.querySelector('.estado-plan');
    if (caja) caja.appendChild(a);
  }
  a.textContent = texto;
  a.className = 'aviso' + (texto ? (bien ? ' bien' : ' mal') : '');
  a.style.marginTop = '12px';
}

// ---------- Modo: entrar o registrarse ----------
let registro = new URLSearchParams(location.search).has('registro');
function pintarModo() {
  $('#titulo-entrar').textContent = registro ? 'Crear cuenta' : 'Entrar';
  $('#sub-entrar').textContent = registro ? `Creá tu cuenta gratis: tenés ${CFG.diasPrueba} días con todo.` : 'Entrá para descargar TIKLIVEauto y ver tu plan.';
  $('#b-email').textContent = registro ? 'Crear cuenta' : 'Entrar';
  $('#campo-nombre').classList.toggle('oculto', !registro);
  $('#clave').autocomplete = registro ? 'new-password' : 'current-password';
  $('#cambiar').innerHTML = registro ? '¿Ya tenés cuenta? <a id="b-cambiar">Entrar</a>' : '¿No tenés cuenta? <a id="b-cambiar">Crear una gratis</a>';
  $('#b-cambiar').onclick = () => { registro = !registro; pintarModo(); avisar(''); };
}
pintarModo();

function avisar(texto, bien = false) {
  const a = $('#aviso');
  a.textContent = texto;
  a.className = 'aviso' + (texto ? (bien ? ' bien' : ' mal') : '');
}
const ERRORES = {
  'auth/invalid-email': 'Ese email no es válido.',
  'auth/missing-password': 'Escribí una contraseña.',
  'auth/weak-password': 'La contraseña tiene que tener al menos 6 letras o números.',
  'auth/email-already-in-use': 'Ya tenés una cuenta con ese email. Tocá "Entrar" (abajo) con la misma contraseña, o "Continuar con Google" si la creaste con Google. Si no te acordás la contraseña, tocá "Me olvidé la contraseña".',
  'permission-denied': 'Tu cuenta está creada, pero todavía no pudimos leer tu plan. Igual podés descargar el programa.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/wrong-password': 'Email o contraseña incorrectos.',
  'auth/user-not-found': 'No hay ninguna cuenta con ese email. Tocá "Crear una gratis".',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
  'auth/network-request-failed': 'Sin conexión a internet. Revisá tu conexión.',
};
const traducir = (e) => ERRORES[e && e.code] || ('No se pudo: ' + (e && e.message || e));

// ---------- Zona del usuario ----------
function pintarZona(u, datos) {
  $('#vista-entrar').classList.add('oculto');
  $('#vista-zona').classList.remove('oculto');
  $('#z-nombre').textContent = (datos.nombre || u.displayName || u.email.split('@')[0]).split(' ')[0];
  $('#z-email').textContent = u.email; $('#z-email2').textContent = u.email;
  const ahora = Date.now();
  const prem = datos.premiumHasta ? datos.premiumHasta : 0;
  const prueba = datos.pruebaHasta ? datos.pruebaHasta : 0;
  let plan, vence, venceT = 'Vence';
  if (prem > ahora) { plan = '<span class="chip premium">⭐ Premium</span>'; vence = new Date(prem).toLocaleDateString('es'); }
  else if (prueba > ahora) { plan = '<span class="chip prueba">🎁 Prueba gratis</span>'; const d = Math.ceil((prueba - ahora) / DIA); vence = `en ${d} día${d === 1 ? '' : 's'}`; venceT = 'Termina'; }
  else { plan = '<span class="chip gratis">Gratis</span>'; vence = '—'; }
  $('#z-plan').innerHTML = plan; $('#z-vence').textContent = vence; $('#z-vence-t').textContent = venceT;
  const precio = CFG.precioPremium || 10, P = CFG.pagos || {};
  $('#p-precio').textContent = precio; $('#z-email3').textContent = u.email;
  $('#b-premium').href = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(`¡Hola! Ya pagué TIKLIVEauto Premium (${precio} USD). Mi email es ${u.email}`)}`;
  $('#b-paypal').href = P.paypal ? `https://www.paypal.com/paypalme/${P.paypal}/${precio}USD` : '#';
  $('#b-paypal').classList.toggle('oculto', !P.paypal);
  $('#b-mp').href = P.mercadopago || '#';
  $('#b-mp').classList.toggle('oculto', !P.mercadopago);
  $('#caja-premium').classList.toggle('oculto', prem > ahora);
  const url = urlDescarga();
  $('#b-descargar').href = url;
  if (url === '#') { $('#b-descargar').onclick = (e) => { e.preventDefault(); alert('La descarga todavía no está publicada.'); }; }
}

// ---------- MODO VISTA PREVIA (sin Firebase) ----------
if (DEMO) {
  $('#aviso-demo').classList.remove('oculto');
  const entrarDemo = (nombre, email) => pintarZona({ email, displayName: nombre }, { nombre, pruebaHasta: Date.now() + CFG.diasPrueba * DIA });
  $('#b-google').onclick = () => entrarDemo('Gonzalo', 'ejemplo@gmail.com');
  $('#f-email').onsubmit = (e) => { e.preventDefault(); entrarDemo($('#nombre').value || 'Streamer', $('#email').value); };
  $('#b-olvide').onclick = () => avisar('En la versión real te llega un email para cambiar la contraseña.', true);
  $('#b-salir').onclick = () => location.reload();
} else {
  iniciarFirebase().catch((e) => avisar('No se pudo cargar: ' + e.message));
}

async function iniciarFirebase() {
  const V = '10.12.2';
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = initializeApp(CFG.firebaseConfig);
  const auth = A.getAuth(app); auth.languageCode = 'es';
  const db = F.getFirestore(app);

  // Lee (o crea la primera vez) la ficha del usuario
  async function ficha(u, nombre) {
    const ref = F.doc(db, 'usuarios', u.uid);
    let s = await F.getDoc(ref);
    if (!s.exists()) {
      await F.setDoc(ref, {
        email: u.email, nombre: nombre || u.displayName || '', creado: F.serverTimestamp(),
        plan: 'prueba', pruebaHasta: F.Timestamp.fromMillis(Date.now() + CFG.diasPrueba * DIA), premiumHasta: null,
      });
      s = await F.getDoc(ref);
    }
    const d = s.data();
    const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
    return { ...d, pruebaHasta: ms(d.pruebaHasta), premiumHasta: ms(d.premiumHasta) };
  }

  A.onAuthStateChanged(auth, async (u) => {
    if (!u) { $('#vista-zona').classList.add('oculto'); $('#vista-entrar').classList.remove('oculto'); return; }
    try {
      const datos = await ficha(u, $('#nombre').value.trim());
      pintarZona(u, datos);
      activarSuscripcion(u, datos);
    }
    catch (e) {
      // Si la base de datos falla, la persona igual entra y puede descargar (su prueba la controla el programa)
      console.warn('Ficha del usuario:', e);
      pintarZona(u, { nombre: u.displayName || '', pruebaHasta: Date.now() + CFG.diasPrueba * DIA });
    }
  });

  // Si la persona viene de suscribirse en Mercado Pago, le avisa al sistema de cobro
  // (Make) quién es y espera a que el Premium quede anotado en su ficha.
  async function activarSuscripcion(u, datos) {
    const P = CFG.pagos || {}, pend = suscripcionPendiente();
    if (!pend || !P.webhook) return;
    if (datos.premiumHasta > Date.now() && pend.intentos > 0) { localStorage.removeItem(CLAVE_MP); return; }
    if (pend.intentos >= 3) {
      localStorage.removeItem(CLAVE_MP);
      avisoPago('No pudimos confirmar tu suscripción automáticamente. Tocá "Ya pagué: avisar por WhatsApp" y te lo activamos a mano.');
      return;
    }
    pend.intentos += 1; localStorage.setItem(CLAVE_MP, JSON.stringify(pend));
    avisoPago('⏳ Confirmando tu suscripción con Mercado Pago…', true);
    try {
      await fetch(P.webhook, { method: 'POST', mode: 'no-cors',
        body: new URLSearchParams({ uid: u.uid, preapproval_id: pend.id, email: u.email || '' }) });
    } catch (e) { console.warn('Aviso de suscripción:', e); }
    const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const ms of [6000, 9000, 15000]) {
      await esperar(ms);
      try {
        const d = await ficha(u);
        if (d.premiumHasta > Date.now()) {
          localStorage.removeItem(CLAVE_MP);
          pintarZona(u, d);
          avisoPago('⭐ ¡Listo! Tu Premium ya está activo. Abrí el programa y lo toma solo.', true);
          return;
        }
      } catch (e) { console.warn('Ficha:', e); }
    }
    avisoPago('Tu pago todavía se está procesando. Volvé a entrar en unos minutos; si no aparece el Premium, tocá "Ya pagué: avisar por WhatsApp".');
  }

  $('#b-google').onclick = async () => {
    avisar('');
    try { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); } catch (e) { avisar(traducir(e)); }
  };
  $('#f-email').onsubmit = async (ev) => {
    ev.preventDefault(); avisar('');
    const email = $('#email').value.trim(), clave = $('#clave').value;
    try {
      if (registro) {
        const r = await A.createUserWithEmailAndPassword(auth, email, clave);
        const nombre = $('#nombre').value.trim();
        if (nombre) await A.updateProfile(r.user, { displayName: nombre });
      } else await A.signInWithEmailAndPassword(auth, email, clave);
    } catch (e) { if (e && e.code === 'auth/email-already-in-use') { registro = false; pintarModo(); } avisar(traducir(e)); }
  };
  $('#b-olvide').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) return avisar('Escribí tu email arriba y tocá de nuevo "Me olvidé la contraseña".');
    try { await A.sendPasswordResetEmail(auth, email); avisar('Te mandamos un email para cambiar la contraseña. Revisá también Spam.', true); }
    catch (e) { avisar(traducir(e)); }
  };
  $('#b-salir').onclick = () => A.signOut(auth);
}
