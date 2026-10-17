// =============================================================
//  TIKLIVEauto NUBE
//  El programa funcionando en internet, para usarlo SOLO con el celular (sin PC).
//
//  Cómo funciona:
//   - La app del celular (en la web de TIKLIVEauto) entra con la cuenta de siempre y se
//     conecta acá. Este servidor revisa que la cuenta tenga Premium o la prueba gratis.
//   - Cada cuenta tiene su "sala". El servidor se conecta al LIVE de esa persona y escucha
//     regalos, chat, seguidores y potenciadores de batalla.
//   - Lo que tiene que salir en el LIVE (animaciones, voz del lector, sonidos) se manda al
//     "overlay": una página que la persona pega en PRISM Live (Widget → Web).
//   - El servidor sigue conectado aunque el celular tenga la app cerrada: lo importante
//     pasa entre TikTok, este servidor y el overlay que está adentro de PRISM.
//
//  Plataformas: hoy TikTok. Preparado para sumar YouTube, Kick, Facebook e Instagram
//  (cada sala tiene "plataforma").
// =============================================================
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { WebSocketServer } = require('ws');

const PUERTO = Number(process.env.PORT) || 8080;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAvMWsAATSrq7VxzqlQnlAtCvqhzSwPHjg';
const ADMIN = String(process.env.ADMIN_EMAIL || 'agrogrowshopuy@gmail.com').toLowerCase();
const SECRETO = process.env.SECRETO_SALAS || 'tikliveauto-nube';
const MAX_SALAS = Number(process.env.MAX_SALAS) || 40;
const SIGN_API_KEY = process.env.SIGN_API_KEY || '';
const DIAS_PRUEBA = Number(process.env.DIAS_PRUEBA) || 15;
const PRECIO_USD = Number(process.env.PRECIO_USD) || 20;
const fs = require('fs');
const path = require('path');
const CARPETA = process.env.CARPETA_DATOS || (fs.existsSync('/data') ? '/data' : path.join(__dirname, 'datos'));
const ARCH_CUENTAS = path.join(CARPETA, 'cuentas.json');
let cuentas = {};
try { cuentas = JSON.parse(fs.readFileSync(ARCH_CUENTAS, 'utf8')) || {}; } catch {}
let tGuardar = null;
const guardarCuentas = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => {
  try { fs.mkdirSync(CARPETA, { recursive: true }); fs.writeFileSync(ARCH_CUENTAS + '.tmp', JSON.stringify(cuentas)); fs.renameSync(ARCH_CUENTAS + '.tmp', ARCH_CUENTAS); } catch (e) { console.log('⚠️ No se pudo guardar:', e.message); }
}, 1500); };
const MEDIA = (process.env.MEDIA_URL || 'https://agrogrowshopuy-eng.github.io/tikliveauto/app/robots/').replace(/\/?$/, '/');

// ---------- Robots que vienen con el programa (uno por potenciador) ----------
const ROBOTS = {
  guante: 'pot_robot_guante.webm', 'guante dorado': 'pot_robot_guante_dorado.webm',
  neblina: 'pot_robot_neblina.webm', martillo: 'pot_robot_martillo.webm',
  'numero 2': 'pot_robot_n2.webm', 'numero 3': 'pot_robot_n3.webm',
  x2: 'pot_robot_x2.webm', x3: 'pot_robot_x3.webm', tiempo: 'pot_robot_tiempo.webm',
  snipe: 'pot_robot_snipe.webm', musica: 'pot_robot_musica.webm',
};
const POTENCIADORES = {
  2: ['guante', 'useCriticalStrikeCard'], 3: ['neblina', 'useSmokeCard'], 5: ['tiempo', 'useExtraTimeCard'],
  6: ['especial', 'useSpecialEffectCard'], 7: ['pocion', 'usePotionCard'], 8: ['ola', 'useWaveCard'],
  10: ['numero 2', 'useTop2Card'], 11: ['numero 3', 'useTop3Card'], 12: ['guante dorado', 'useVaultGloveCard'],
};

const CFG_INICIAL = () => ({
  plataforma: 'tiktok',
  usuario: '',
  potenciadores: true,         // los robots salen solos en las batallas
  soloMios: true,              // solo los potenciadores que me tiran a mí (no los del rival)
  lector: { activo: true, voz: 'es-AR-ElenaNeural', quien: 'todos', regalos: true, seguidores: false, velocidad: 0 },
  volumen: 80,
  eventos: [],                 // [{ regalo: 'Rosa' | '', minMonedas: 1, url: '...', texto: '' }]
});

// =============================================================
//  CUENTA: se revisa con Firebase (la misma cuenta de la web)
// =============================================================
async function revisarCuenta(token) {
  if (!token || typeof token !== 'string') throw new Error('Falta entrar con tu cuenta');
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken: token }),
  }).catch(() => { throw new Error('No se pudo revisar tu cuenta. Probá de nuevo en un momento.'); });
  const j = await r.json().catch(() => ({}));
  const u = j?.users?.[0];
  if (!r.ok || !u?.localId) throw new Error('Tu sesión venció: volvé a entrar');
  const email = String(u.email || '').toLowerCase();
  const esAdmin = email === ADMIN && u.emailVerified === true;
  // El modo celular es un producto APARTE del programa de Windows:
  //  - celularHasta: lo activa el admin desde la app (sección Admin) cuando alguien paga los 20 USD del mes.
  //    Se guarda en este servidor, no en Firestore, así nadie se lo puede poner solo.
  //  - si no pagó: 15 días de prueba desde la primera vez que usa el modo celular
  const ahora = Date.now();
  const c = cuentas[u.localId] || (cuentas[u.localId] = { email, pruebaDesde: ahora });
  c.email = email; c.visto = ahora;
  const pend = cuentas._pendientes?.[email];
  if (pend) { c.celularHasta = Math.max(c.celularHasta || 0, pend); delete cuentas._pendientes[email]; }
  guardarCuentas();
  const celularHasta = c.celularHasta || 0;
  const pruebaHasta = c.pruebaDesde + DIAS_PRUEBA * 864e5;
  const plan = esAdmin || celularHasta > ahora ? 'premium' : pruebaHasta > ahora ? 'prueba' : 'gratis';
  return { uid: u.localId, email, esAdmin, nombre: u.displayName || email.split('@')[0], plan, vence: plan === 'premium' ? celularHasta : pruebaHasta };
}
const codigoSala = (uid) => crypto.createHmac('sha256', SECRETO).update(uid).digest('base64url').replace(/[-_]/g, '').slice(0, 10).toLowerCase();

// =============================================================
//  VOZ (lector del chat): voces de Microsoft, gratis
// =============================================================
const audios = new Map(); // id -> { buf, hora }
function guardarAudio(buf) {
  const id = crypto.randomBytes(8).toString('hex');
  audios.set(id, { buf, hora: Date.now() });
  for (const [k, v] of audios) if (Date.now() - v.hora > 10 * 60000) audios.delete(k);
  return id;
}
const sinEmojis = (t) => String(t || '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
const escaparXML = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function hablar(texto, voz, velocidad = 0) {
  texto = sinEmojis(texto).slice(0, 220);
  if (!texto) return null;
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voz || 'es-AR-ElenaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(escaparXML(texto), { rate: `${velocidad >= 0 ? '+' : ''}${velocidad}%` });
    const partes = [];
    await Promise.race([
      new Promise((ok, mal) => { audioStream.on('data', (d) => partes.push(d)); audioStream.on('close', ok); audioStream.on('end', ok); audioStream.on('error', mal); }),
      new Promise((_, no) => setTimeout(() => no(new Error('La voz tardó demasiado')), 20000)),
    ]);
    const buf = Buffer.concat(partes);
    if (buf.length < 1000) return null;
    return { id: guardarAudio(buf), ms: Math.round(buf.length * 8 / 96000 * 1000) };
  } finally { try { tts.close(); } catch {} }
}

// =============================================================
//  SALAS: una por cuenta
// =============================================================
const salas = new Map(); // codigo -> sala

function nuevaSala(codigo, cuenta) {
  const s = {
    codigo, cuenta, cfg: CFG_INICIAL(),
    controles: new Set(), overlays: new Set(),
    con: null, estado: { conectado: false, conectando: false, mensaje: 'desconectado', espectadores: 0 },
    detenido: true, reloj: null, fallos: 0, vistos: new Map(), cola: [], hablando: false,
    ultimo: Date.now(), registro: [],
  };
  salas.set(codigo, s);
  return s;
}

const enviar = (ws, m) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(m)); } catch {} };
const aControles = (s, m) => s.controles.forEach((w) => enviar(w, m));
const aOverlays = (s, m) => s.overlays.forEach((w) => enviar(w, m));
function estado(s, cambios) {
  Object.assign(s.estado, cambios);
  aControles(s, { tipo: 'estado', estado: s.estado, overlays: s.overlays.size });
}
function anotar(s, texto) {
  s.registro.push({ hora: Date.now(), texto });
  if (s.registro.length > 40) s.registro.shift();
  aControles(s, { tipo: 'registro', texto });
}

// ---------- Lo que sale en el LIVE ----------
function animar(s, url, volumen) {
  if (!url) return;
  aOverlays(s, { tipo: 'video', url, volumen: volumen ?? s.cfg.volumen });
}
function leer(s, texto) {
  if (!s.cfg.lector.activo || !texto) return;
  if (s.cola.length >= 6) s.cola.shift(); // si el chat va muy rápido, se saltean los más viejos
  s.cola.push(texto);
  siguienteVoz(s);
}
async function siguienteVoz(s) {
  if (s.hablando || !s.cola.length) return;
  s.hablando = true;
  const texto = s.cola.shift();
  try {
    const a = await hablar(texto, s.cfg.lector.voz, Number(s.cfg.lector.velocidad) || 0);
    if (a) {
      aOverlays(s, { tipo: 'audio', url: `/voz/${a.id}.mp3`, volumen: s.cfg.volumen });
      await new Promise((r) => setTimeout(r, a.ms + 400));
    }
  } catch (e) { anotar(s, '⚠️ Voz: ' + e.message); }
  s.hablando = false;
  siguienteVoz(s);
}

// ---------- Lo que llega del LIVE ----------
function entrada(s, e) {
  s.ultimo = Date.now();
  const c = s.cfg;
  if (e.tipo === 'comentario') {
    aControles(s, { tipo: 'chat', usuario: e.usuario, texto: e.comentario });
    const t = String(e.comentario || '').trim();
    if (!t || t.startsWith('!')) return;
    if (c.lector.quien === 'seguidores' && !e.sigue) return;
    leer(s, `${e.usuario} dice: ${t}`);
  } else if (e.tipo === 'regalo') {
    anotar(s, `🎁 ${e.usuario} mandó ${e.cantidad > 1 ? e.cantidad + ' × ' : ''}${e.regalo} (${e.monedas} monedas)`);
    if (c.lector.regalos) leer(s, `Gracias ${e.usuario} por ${e.cantidad > 1 ? 'los ' + e.cantidad : 'el'} ${e.regalo}`);
    const nombre = String(e.regalo || '').toLowerCase();
    const ev = (c.eventos || []).find((x) => x.url && (x.regalo ? nombre === String(x.regalo).toLowerCase() : e.monedas * (e.cantidad || 1) >= (Number(x.minMonedas) || 1)));
    if (ev) animar(s, ev.url);
  } else if (e.tipo === 'seguir') {
    anotar(s, `➕ ${e.usuario} te sigue`);
    if (c.lector.seguidores) leer(s, `Gracias ${e.usuario} por seguirme`);
  } else if (e.tipo === 'potenciador') {
    anotar(s, `🥊 ${e.usuario} tiró ${e.potenciador}${e.para === 'rival' ? ' (al rival)' : ''}`);
    if (!c.potenciadores) return;
    if (c.soloMios && e.para === 'rival') return;
    const f = ROBOTS[e.potenciador];
    if (f && (f !== ROBOTS['guante dorado'] || s.cuenta.plan !== 'gratis')) animar(s, MEDIA + f);
  }
}

// =============================================================
//  CONEXIÓN A TIKTOK (la misma lógica del programa de PC)
// =============================================================
let lib = null;
async function conectar(s) {
  desconectar(s, false);
  const usuario = String(s.cfg.usuario || '').trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, '').replace(/^@/, '').replace(/\/live\/?$/i, '');
  if (!usuario) return estado(s, { mensaje: 'faltaUsuario' });
  s.cfg.usuario = usuario;
  s.detenido = false;
  if (!lib) lib = await import('tiktok-live-connector');
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  const con = new TikTokLiveConnection(usuario, { signApiKey: SIGN_API_KEY || undefined, enableExtendedGiftInfo: false });
  s.con = con;
  estado(s, { conectando: true, conectado: false, mensaje: 'conectando' });

  const repetido = (d, resp = '') => {
    const mid = d?.common?.msgId ?? d?.msgId;
    const clave = mid && String(mid) !== '0' ? 'id:' + mid : resp ? 'tx:' + resp : '';
    if (!clave) return false;
    const ahora = Date.now();
    if (s.vistos.size > 2000) for (const [k, h] of s.vistos) if (ahora - h > 15 * 60000) s.vistos.delete(k);
    if (s.vistos.has(clave)) return true;
    s.vistos.set(clave, ahora); return false;
  };
  const quien = (d) => {
    const u = d?.user || {};
    return { usuario: u.nickname || u.uniqueId || 'alguien', id: u.uniqueId || '', sigue: Number(u.followInfo?.followStatus) >= 1 };
  };
  con.on(WebcastEvent.CHAT, (d) => { const t = d?.content ?? d?.comment ?? ''; if (!repetido(d, 'c|' + (d?.user?.uniqueId || '') + '|' + t)) entrada(s, { tipo: 'comentario', ...quien(d), comentario: String(t) }); });
  con.on(WebcastEvent.GIFT, (d) => {
    const g = d.gift || d.giftDetails || {};
    if ((g.type ?? g.giftType) === 1 && !d.repeatEnd) return; // regalos en racha: solo al terminar
    if (repetido(d, d.groupId ? 'g|' + (d?.user?.uniqueId || '') + '|' + d.groupId + '|' + (d.repeatCount || 1) : '')) return;
    entrada(s, { tipo: 'regalo', ...quien(d), regalo: g.name || g.giftName || String(d.giftId || ''), monedas: Number(g.diamondCount || 1), cantidad: Number(d.repeatCount || 1) });
  });
  con.on(WebcastEvent.FOLLOW, (d) => !repetido(d) && entrada(s, { tipo: 'seguir', ...quien(d) }));
  con.on(WebcastEvent.ROOM_USER, (d) => estado(s, { espectadores: Number(d.viewerCount ?? d.total ?? 0) || 0 }));

  // Potenciadores de batalla
  let miId = '';
  const creadores = new Map();
  if (WebcastEvent.LINK_MIC_BATTLE) con.on(WebcastEvent.LINK_MIC_BATTLE, (d) => {
    try {
      for (const a of d?.anchorsInfo || []) {
        const u = a?.value?.user || a?.user || {};
        const id = String(a?.key || u.userId || '');
        if (!id) continue;
        creadores.set(id, String(u.displayId || '').toLowerCase());
        if (String(u.displayId || '').toLowerCase() === usuario.toLowerCase()) miId = id;
      }
    } catch {}
  });
  if (WebcastEvent.LINK_MIC_BATTLE_ITEM_CARD) con.on(WebcastEvent.LINK_MIC_BATTLE_ITEM_CARD, (d) => {
    try {
      const tipo = Number(d?.msgType);
      let [nombre, campo] = POTENCIADORES[tipo] || [];
      if (!campo) return;
      const t = d[campo]; if (!t) return;
      const info = t.cardInfo?.common || t.cardInfo || {};
      const q = info.sendUser?.user || {};
      const paraId = String(t.anchorId || info.toAnchorIdStr || info.toAnchorId || '').replace(/^0$/, '');
      if (nombre === 'especial') nombre = Number(t.effectType) === 1 ? 'martillo' : 'especial';
      const clave = 'p|' + [tipo, q.userId || q.displayId || '', info.sendTimeSec || '', paraId].join('|');
      if (repetido({}, clave)) return;
      const para = !paraId || !miId ? '' : paraId === miId ? 'mi' : 'rival';
      entrada(s, { tipo: 'potenciador', usuario: q.nickName || q.displayId || 'alguien', potenciador: nombre, para });
    } catch {}
  });
  let multiplo = 0, previsto = 0, mision = '', relojMision = null;
  if (WebcastEvent.LINK_MIC_BATTLE_TASK) con.on(WebcastEvent.LINK_MIC_BATTLE_TASK, (d) => {
    try {
      const tipo = Number(d?.taskMessageType);
      if (tipo === 0) {
        const rc = d?.start?.config?.rewardConfig || {};
        multiplo = Number(rc.rewardMultiple) || 0; previsto = Number(rc.rewardStartTimestamp) || 0; mision = String(d?.battleId || '');
      } else if (tipo === 2) {
        const c = d?.taskSettle || {};
        let empieza = Number(c.result) ? Number(c.rewardStartTimestamp) || 0 : 0;
        if (!empieza && String(d?.battleId || '') === mision && previsto * 1000 > Date.now() - 5000) empieza = previsto;
        if (!empieza) return;
        const m = mision && String(d?.battleId || '') === mision ? multiplo : 0;
        clearTimeout(relojMision);
        relojMision = setTimeout(() => { if (s.con === con) entrada(s, { tipo: 'potenciador', usuario: 'TikTok', potenciador: m ? 'x' + m : 'x2', para: '' }); },
          Math.min(120000, Math.max(0, empieza * 1000 - Date.now())));
      }
    } catch {}
  });

  con.on(WebcastEvent.STREAM_END, () => { anotar(s, '📴 El LIVE terminó'); reintentar(s, 60, 'esperandoLive'); });
  con.on(ControlEvent.DISCONNECTED, () => { if (!s.detenido && s.con === con) { s.fallos++; reintentar(s, 15, 'reconectando'); } });
  con.on(ControlEvent.ERROR, () => {});

  try {
    const st = await con.connect();
    if (s.con !== con) return;
    try { const r = st.roomInfo?.data || st.roomInfo || {}; const id = r.owner?.id_str || r.owner_user_id_str || ''; if (/^\d+$/.test(String(id))) miId = String(id); } catch {}
    s.fallos = 0;
    estado(s, { conectado: true, conectando: false, mensaje: 'conectado' });
    anotar(s, `✅ Conectado al LIVE de @${usuario}`);
  } catch (err) {
    if (s.con !== con) return;
    const texto = err?.message || String(err);
    const nombre = err?.constructor?.name || '';
    if (nombre === 'UserOfflineError' || /offline|not live|isn't live/i.test(texto)) reintentar(s, 60, 'esperandoLive');
    else if (/room ?id/i.test(texto)) reintentar(s, 45, 'noEncontrado');
    else if (nombre === 'SignatureRateLimitError' || /rate.?limit/i.test(texto)) reintentar(s, 90, 'limite');
    else { anotar(s, '❌ ' + texto.slice(0, 160)); reintentar(s, 30, 'error'); }
  }
}
function reintentar(s, seg, mensaje) {
  if (s.detenido) return;
  estado(s, { conectado: false, conectando: false, mensaje });
  clearTimeout(s.reloj);
  s.reloj = setTimeout(() => !s.detenido && conectar(s).catch(() => {}), seg * 1000);
}
function desconectar(s, avisar = true) {
  s.detenido = true;
  clearTimeout(s.reloj);
  if (s.con) { const c = s.con; s.con = null; try { c.removeAllListeners(); c.disconnect(); } catch {} }
  if (avisar) estado(s, { conectado: false, conectando: false, mensaje: 'desconectado', espectadores: 0 });
}

// Limpieza: salas sin nadie mirando
setInterval(() => {
  const ahora = Date.now();
  for (const [k, s] of salas) {
    const nadie = !s.controles.size && !s.overlays.size;
    if (nadie && s.detenido && ahora - s.ultimo > 30 * 60000) salas.delete(k);
    else if (nadie && !s.detenido && ahora - s.ultimo > 3 * 3600000) { desconectar(s); salas.delete(k); }
  }
}, 60000);

// =============================================================
//  SERVIDOR WEB
// =============================================================
const app = express();
app.use((req, res, next) => { res.set('access-control-allow-origin', '*'); next(); });
app.get('/', (req, res) => res.json({ ok: true, servicio: 'TIKLIVEauto Nube', salas: salas.size }));
app.get('/voz/:id.mp3', (req, res) => {
  const a = audios.get(req.params.id);
  if (!a) return res.status(404).end();
  res.set('content-type', 'audio/mpeg').set('cache-control', 'no-store').send(a.buf);
});

const servidor = http.createServer(app);
const wss = new WebSocketServer({ server: servidor, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const rol = q.get('rol');
  ws.vivo = true; ws.on('pong', () => { ws.vivo = true; });

  if (rol === 'overlay') {
    const s = salaDesdeCodigo(String(q.get('sala') || '').toLowerCase());
    if (!s) { enviar(ws, { tipo: 'error', texto: 'Sala no encontrada: abrí la app de TIKLIVEauto en el celular y entrá con tu cuenta.' }); return setTimeout(() => ws.close(), 500); }
    s.overlays.add(ws); s.ultimo = Date.now();
    enviar(ws, { tipo: 'listo' });
    aControles(s, { tipo: 'estado', estado: s.estado, overlays: s.overlays.size });
    ws.on('close', () => { s.overlays.delete(ws); s.ultimo = Date.now(); aControles(s, { tipo: 'estado', estado: s.estado, overlays: s.overlays.size }); });
    return;
  }

  // ---- Control (la app del celular) ----
  let s = null;
  ws.on('message', async (crudo) => {
    let m; try { m = JSON.parse(crudo); } catch { return; }
    try {
      if (m.tipo === 'hola') {
        const cuenta = await revisarCuenta(m.token);
        if (cuenta.plan === 'gratis') return enviar(ws, { tipo: 'error', codigo: 'plan', precio: PRECIO_USD, texto: `Terminaron tus ${DIAS_PRUEBA} días gratis del modo celular. Para seguir usándolo: ${PRECIO_USD} USD por mes.` });
        const codigo = codigoSala(cuenta.uid);
        if (cuentas[cuenta.uid]) { cuentas[cuenta.uid].codigo = codigo; guardarCuentas(); }
        s = salas.get(codigo);
        if (!s) {
          if (salas.size >= MAX_SALAS) return enviar(ws, { tipo: 'error', texto: 'El servidor está lleno en este momento. Probá en unos minutos.' });
          s = nuevaSala(codigo, cuenta);
          const guardada = cuentas[cuenta.uid]?.cfg;
          if (guardada) aplicarCfg(s, guardada); else if (m.cfg && typeof m.cfg === 'object') aplicarCfg(s, m.cfg);
        }
        s.cuenta = cuenta;
        s.controles.add(ws);
        ws.on('close', () => { s && s.controles.delete(ws); if (s) s.ultimo = Date.now(); });
        return enviar(ws, { tipo: 'bienvenido', sala: codigo, cuenta: { email: cuenta.email, nombre: cuenta.nombre, plan: cuenta.plan, admin: cuenta.esAdmin, vence: cuenta.vence, precio: PRECIO_USD }, cfg: s.cfg, estado: s.estado, overlays: s.overlays.size, registro: s.registro.slice(-15), robots: Object.keys(ROBOTS), media: MEDIA });
      }
      if (!s) return enviar(ws, { tipo: 'error', texto: 'Primero entrá con tu cuenta' });
      s.ultimo = Date.now();
      if (m.tipo === 'cfg') { aplicarCfg(s, m.cfg); aControles(s, { tipo: 'cfg', cfg: s.cfg }); }
      else if (m.tipo === 'conectar') { if (m.usuario !== undefined) aplicarCfg(s, { usuario: m.usuario }); recordarAuto(s, true); await conectar(s); }
      else if (m.tipo === 'desconectar') { recordarAuto(s, false); desconectar(s); anotar(s, '⏹️ Desconectado'); }
      else if (m.tipo === 'robot') { const f = ROBOTS[m.cual]; if (f) { if (f === ROBOTS['guante dorado'] && s.cuenta.plan === 'gratis') return; animar(s, MEDIA + f); } }
      else if (m.tipo === 'video') { if (/^https:\/\//i.test(m.url || '')) animar(s, String(m.url)); }
      else if (m.tipo === 'decir') { const t = String(m.texto || '').slice(0, 220); const a = await hablar(t, s.cfg.lector.voz, Number(s.cfg.lector.velocidad) || 0); if (a) aOverlays(s, { tipo: 'audio', url: `/voz/${a.id}.mp3`, volumen: s.cfg.volumen }); }
      else if (m.tipo === 'admin-dar' || m.tipo === 'admin-lista') {
        if (!s.cuenta.esAdmin) return enviar(ws, { tipo: 'error', texto: 'Solo el administrador' });
        if (m.tipo === 'admin-dar') {
          const email = String(m.email || '').trim().toLowerCase();
          const dias = Math.max(-1, Math.min(400, Number(m.dias) || 30));
          if (!/^\S+@\S+\.\S+$/.test(email)) return enviar(ws, { tipo: 'error', texto: 'Email no válido' });
          const uid = Object.keys(cuentas).find((k) => k !== '_pendientes' && cuentas[k].email === email);
          const base = uid ? Math.max(Date.now(), cuentas[uid].celularHasta || 0) : Date.now();
          const hasta = dias < 0 ? 0 : base + dias * 864e5;
          if (uid) cuentas[uid].celularHasta = hasta;
          else (cuentas._pendientes ||= {})[email] = hasta;
          guardarCuentas();
          enviar(ws, { tipo: 'aviso', texto: dias < 0 ? `Se le sacó el modo celular a ${email}` : `✅ ${email}: modo celular hasta el ${new Date(hasta).toLocaleDateString('es-UY')}${uid ? '' : ' (se activa cuando entre por primera vez)'}` });
        }
        const lista = Object.entries(cuentas).filter(([k]) => k !== '_pendientes').map(([, v]) => ({ email: v.email, celularHasta: v.celularHasta || 0, pruebaHasta: v.pruebaDesde + DIAS_PRUEBA * 864e5, visto: v.visto || 0 }))
          .sort((a, b) => b.visto - a.visto).slice(0, 100);
        enviar(ws, { tipo: 'admin', lista });
      }
      else if (m.tipo === 'cortar') { s.cola = []; aOverlays(s, { tipo: 'cortar' }); }
    } catch (e) { enviar(ws, { tipo: 'error', texto: e.message || String(e) }); }
  });
});

// Si el servidor se reinició, la sala se vuelve a armar sola cuando PRISM reconecta el overlay
function salaDesdeCodigo(codigo) {
  if (salas.has(codigo)) return salas.get(codigo);
  const uid = Object.keys(cuentas).find((k) => cuentas[k].codigo === codigo);
  if (!uid || salas.size >= MAX_SALAS) return null;
  const c = cuentas[uid];
  const vence = Math.max(c.celularHasta || 0, c.pruebaDesde + DIAS_PRUEBA * 864e5);
  const esAdmin = c.email === ADMIN;
  if (!esAdmin && vence < Date.now()) return null;
  const s = nuevaSala(codigo, { uid, email: c.email, nombre: c.email.split('@')[0], plan: (c.celularHasta || 0) > Date.now() || esAdmin ? 'premium' : 'prueba', esAdmin: false });
  if (c.cfg) aplicarCfg(s, c.cfg);
  if (c.auto && s.cfg.usuario) { console.log('🔁 Reconectando sala', codigo); conectar(s).catch(() => {}); }
  return s;
}
function recordarAuto(s, auto) { const c = cuentas[s.cuenta?.uid]; if (c) { c.auto = auto; guardarCuentas(); } }

function aplicarCfg(s, n = {}) {
  const c = s.cfg;
  if (typeof n.usuario === 'string') c.usuario = n.usuario.slice(0, 60);
  if (typeof n.potenciadores === 'boolean') c.potenciadores = n.potenciadores;
  if (typeof n.soloMios === 'boolean') c.soloMios = n.soloMios;
  if (Number.isFinite(Number(n.volumen))) c.volumen = Math.max(0, Math.min(100, Number(n.volumen)));
  if (n.lector && typeof n.lector === 'object') {
    const l = n.lector;
    if (typeof l.activo === 'boolean') c.lector.activo = l.activo;
    if (typeof l.regalos === 'boolean') c.lector.regalos = l.regalos;
    if (typeof l.seguidores === 'boolean') c.lector.seguidores = l.seguidores;
    if (['todos', 'seguidores'].includes(l.quien)) c.lector.quien = l.quien;
    if (/^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(l.voz || '')) c.lector.voz = l.voz;
    if (Number.isFinite(Number(l.velocidad))) c.lector.velocidad = Math.max(-50, Math.min(50, Number(l.velocidad)));
  }
  if (Array.isArray(n.eventos)) c.eventos = n.eventos.slice(0, 30)
    .filter((e) => e && /^https:\/\//i.test(e.url || ''))
    .map((e) => ({ regalo: String(e.regalo || '').slice(0, 40), minMonedas: Math.max(1, Number(e.minMonedas) || 1), url: String(e.url).slice(0, 400) }));
  if (s.cuenta?.uid && cuentas[s.cuenta.uid]) { cuentas[s.cuenta.uid].cfg = c; guardarCuentas(); }
}

setInterval(() => wss.clients.forEach((w) => { if (!w.vivo) return w.terminate(); w.vivo = false; try { w.ping(); } catch {} }), 30000);

servidor.listen(PUERTO, () => console.log(`⚡ TIKLIVEauto Nube escuchando en el puerto ${PUERTO}`));
process.on('unhandledRejection', (e) => console.log('⚠️', e?.message || e));
