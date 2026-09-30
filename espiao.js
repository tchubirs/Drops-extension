// Corre dentro das paginas da Twitch, antes da propria pagina. Quando a pagina fala com
// a Twitch (gql.twitch.tv), guarda os cabecalhos que ela usa — sobretudo o
// "Client-Integrity", que a Twitch exige para ler as campanhas — para a extensao os
// reutilizar. Nao muda nada nos pedidos da pagina e nao envia nada para lado nenhum.
(() => {
  const QUERO = ['client-integrity', 'x-device-id', 'client-session-id', 'client-version', 'client-id', 'authorization'];
  const guardar = (url, cab) => {
    if (!/gql\.twitch\.tv/.test(String(url || ''))) return;
    const out = window.__dropsCabecalhos || {};
    const por = (k, v) => { if (QUERO.includes(String(k).toLowerCase()) && v) out[String(k).toLowerCase()] = String(v); };
    if (cab instanceof Headers) cab.forEach((v, k) => por(k, v));
    else if (Array.isArray(cab)) cab.forEach(([k, v]) => por(k, v));
    else if (cab && typeof cab === 'object') Object.entries(cab).forEach(([k, v]) => por(k, v));
    if (out['client-integrity']) out.quando = Date.now();
    window.__dropsCabecalhos = out;
  };
  const f = window.fetch;
  window.fetch = function (entrada, opcoes) {
    try {
      const url = entrada instanceof Request ? entrada.url : entrada;
      guardar(url, (opcoes && opcoes.headers) || (entrada instanceof Request ? entrada.headers : null));
    } catch { /* nunca estragar a pagina */ }
    return f.apply(this, arguments);
  };
  const abrir = XMLHttpRequest.prototype.open, cab = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, url) { this.__dropsUrl = url; return abrir.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { guardar(this.__dropsUrl, { [k]: v }); } catch { /* idem */ } return cab.apply(this, arguments); };
})();
