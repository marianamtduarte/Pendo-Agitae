// Instalação do Pendo. Arquivo separado (em vez de <script> dentro do HTML) de propósito: a política de
// segurança do servidor (CSP, em server/app.js) só permite scripts vindos de arquivo, não blocos escritos
// direto no HTML — então isto tem que ficar aqui. Para trocar a chave do app ou o snippet, edite só este arquivo.
(function (publicAppId) {
  (function (p, e, n, d, o) { var v, w, x, y, z; o = p[d] = p[d] || {}; o._q = o._q || [];
    v = ['initialize', 'identify', 'updateOptions', 'pageLoad', 'track', 'trackAgent']; for (w = 0, x = v.length; w < x; ++w) (function (m) {
      o[m] = o[m] || function () { o._q[m === v[0] ? 'unshift' : 'push']([m].concat([].slice.call(arguments, 0))); };
    })(v[w]);
    y = e.createElement(n); y.async = !0; y.src = 'https://cdn.pendo.io/agent/static/' + publicAppId + '/pendo.js';
    z = e.getElementsByTagName(n)[0]; z.parentNode.insertBefore(y, z);
  })(window, document, 'script', 'pendo');
})('b2ec970a-20e0-471c-b7c3-9b9686fad78e');

function agitaePendoVisitor() {
  var v = window.agitaeVisitor(); // { id: 'u123'|null, role, provider: {slug, plan}|null }
  return {
    visitor: { id: v.id || undefined, role: v.role }, // sem id → Pendo cuida do anônimo sozinho (cookie estável)
    account: v.provider ? { id: v.provider.slug, planLevel: v.provider.plan } : undefined, // tier do fornecedor; cliente puro não tem conta
  };
}
// js/app.js é um módulo e sempre roda DEPOIS deste script clássico — por isso esperamos o aviso dele
// (window.agitaeVisitor só existe a partir desse aviso) antes de chamar pendo.initialize.
function agitaePendoStart() { pendo.initialize(agitaePendoVisitor()); }
if (window.agitaeVisitor) agitaePendoStart();
else window.addEventListener('agitae:visitor-ready', agitaePendoStart, { once: true });
window.addEventListener('agitae:user', function () {
  setTimeout(function () { if (window.agitaeVisitor) pendo.identify(agitaePendoVisitor()); }, 300); // SPA: troca de papel sem recarregar a página
});
