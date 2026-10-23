// So corre enquanto o DropGo esta ligado (ver captura() em fundo.js). Le os cabecalhos dos
// pedidos que a propria pagina da Twitch faz a gql.twitch.tv e guarda-os na memoria da pagina
// (window.__twitchCabecalhos), para a extensao os reutilizar nos seus pedidos a mesma Twitch.
// Sao so: o "Client-Integrity" (verificacao que a Twitch exige para ler as campanhas de drops)
// e identificadores de sessao, de dispositivo e de versao. O login NAO e copiado daqui (a
// extensao usa o cookie de sessao da Twitch). Nao muda nada nos pedidos da pagina, nao grava
// em disco e nao envia nada para nenhum outro sitio.
(() => {
  window.__dropgoLigado = true;
  if (window.__dropgoGancho) return;      // ja instalado nesta pagina
  window.__dropgoGancho = true;
  const QUERO = ['client-integrity', 'x-device-id', 'client-session-id', 'client-version', 'client-id'];
  const guardar = (url, cab) => {
    if (window.__dropgoLigado === false) return;   // pausado: nao le nada
    if (!/gql\.twitch\.tv/.test(String(url || ''))) return;
    const out = window.__twitchCabecalhos || {};
    const por = (k, v) => { if (QUERO.includes(String(k).toLowerCase()) && v) out[String(k).toLowerCase()] = String(v); };
    if (cab instanceof Headers) cab.forEach((v, k) => por(k, v));
    else if (Array.isArray(cab)) cab.forEach(([k, v]) => por(k, v));
    else if (cab && typeof cab === 'object') Object.entries(cab).forEach(([k, v]) => por(k, v));
    if (out['client-integrity']) out.quando = Date.now();
    window.__twitchCabecalhos = out;
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
  XMLHttpRequest.prototype.open = function (m, url) { this.__twitchUrl = url; return abrir.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { guardar(this.__twitchUrl, { [k]: v }); } catch { /* idem */ } return cab.apply(this, arguments); };
})();
