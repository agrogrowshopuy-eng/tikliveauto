// =============================================================
//  CONFIGURACIÓN DE LA WEB DE TIKLIVEauto
//  1) firebaseConfig: pegá acá el bloque que te da Firebase
//     (Configuración del proyecto → Tus apps → Web). No es secreto.
//  2) github: tu usuario de GitHub y el repositorio con los instaladores.
//  Mientras apiKey diga "PEGAR_AQUI", la página funciona en MODO VISTA PREVIA.
// =============================================================
window.TIKLIVE_CONFIG = {
  firebaseConfig: {
    apiKey: 'AIzaSyAvMWsAATSrq7VxzqlQnlAtCvqhzSwPHjg',
    authDomain: 'tikliveauto.firebaseapp.com',
    projectId: 'tikliveauto',
    storageBucket: 'tikliveauto.firebasestorage.app',
    messagingSenderId: '310664355626',
    appId: '1:310664355626:web:5022e3232d68f60d5a4853',
  },
  github: { usuario: 'agrogrowshopuy-eng', repositorio: 'tikliveauto' },
  diasPrueba: 30,
  whatsapp: '59898993720',
  precioPremium: 12,
  // Cobro de Premium. precioPremium = lo que se cobra por PayPal, en USD. mercadopago = link del plan de suscripción ($ 500 uruguayos por mes). Vacío = no se muestra.
  pagos: { paypal: 'agrogrow', mercadopago: 'https://mpago.la/2j6YiXo' },
};
