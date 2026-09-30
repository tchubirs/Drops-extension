// O que corre por tras. Clicas no icone e ela faz o resto, de 2 em 2 minutos:
//   - separador 1, o INVENTARIO (twitch.tv/drops/inventory): fica sempre aberto; e daqui
//     que ela le o teu progresso, e e aqui que tu resgatas os drops prontos;
//   - separador 2, a STREAM: ela poe-no no canal certo, carrega no play se o video
//     parar, aceita o aviso "+18", e muda de canal quando o canal acaba, deixa de dar
//     drops, ou os minutos param de subir durante 8 minutos.
// Resgata sozinha os drops a 100% (pela consulta da Twitch, ou carregando no botao do
// inventario). Quando todos os drops estao a 100%, mostra FIM.
// Usa a tua sessao da Twitch deste Chrome (cookie "auth-token"); nao ve a password.
import { criarGql, decidir, acompanhar, aplicarConfig, resgatar, prontosParaResgatar, WEB } from './logica.js';

const CONFIG_URL = 'https://raw.githubusercontent.com/tchubirs/Drops-extension/main/config.json';
const CONFIG_HORAS = 6;

const INVENTARIO = 'https://www.twitch.tv/drops/inventory';
const PARADO_MIN = 8, EVITAR_MIN = 30;
const guardado = () => chrome.storage.local.get(['ligado', 'tabInv', 'tabStream', 'evitar', 'progresso', 'recarregado', 'config', 'configQuando', 'vistosProntos', 'botaoQuando']);
const mostrar = async (texto, cor, titulo) => {
  await chrome.action.setBadgeText({ text: texto });
  if (cor) await chrome.action.setBadgeBackgroundColor({ color: cor });
  if (titulo) await chrome.action.setTitle({ title: titulo.slice(0, 2000) });
};
const dormir = ms => new Promise(ok => setTimeout(ok, ms));

// a sessao da Twitch deste Chrome
async function sessao() {
  const c = await chrome.cookies.get({ url: 'https://www.twitch.tv', name: 'auth-token' });
  if (!c || !c.value) throw new Error('entra na Twitch neste Chrome (twitch.tv) e volta a ligar');
  const r = await fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: `OAuth ${c.value}` } });
  if (!r.ok) throw new Error('a sessao da Twitch expirou: entra outra vez em twitch.tv');
  const v = await r.json();
  return { token: c.value, utilizador: String(v.user_id) };
}

// um separador que existe e esta na Twitch; senao abre-o
async function separador(id, url, activo) {
  let tab = id ? await chrome.tabs.get(id).catch(() => null) : null;
  if (!tab) { tab = await chrome.tabs.create({ url, active: activo }); await dormir(6000); }
  else if (!/^https:\/\/www\.twitch\.tv\//.test(tab.url || '')) { await chrome.tabs.update(tab.id, { url }); await dormir(6000); }
  await chrome.tabs.update(tab.id, { autoDiscardable: false });     // o Chrome nao o "adormece"
  return chrome.tabs.get(tab.id);
}

// as consultas vao de dentro do separador do inventario, com os mesmos cabecalhos que a
// propria pagina usa (o "Client-Integrity" que ela gera; guardado pelo espiao.js)
function pedirPeloInventario(tabId, token) {
  return async corpo => {
    for (let tentativa = 0; ; tentativa++) {
      let r;
      try {
        [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', args: [corpo, token, WEB],
          func: async (corpo, token, id) => {
            // espera ate 15 s que a pagina faca o primeiro pedido dela (com a verificacao)
            for (let i = 0; i < 30 && !(window.__dropsCabecalhos || {})['client-integrity']; i++) await new Promise(ok => setTimeout(ok, 500));
            const c = window.__dropsCabecalhos || {};
            const cab = { 'Client-Id': c['client-id'] || id, Authorization: c.authorization || `OAuth ${token}`, 'Content-Type': 'text/plain;charset=UTF-8' };
            if (c['client-integrity']) cab['Client-Integrity'] = c['client-integrity'];
            if (c['x-device-id']) cab['X-Device-Id'] = c['x-device-id'];
            if (c['client-session-id']) cab['Client-Session-Id'] = c['client-session-id'];
            if (c['client-version']) cab['Client-Version'] = c['client-version'];
            const r = await fetch('https://gql.twitch.tv/gql', { method: 'POST', credentials: 'omit', headers: cab, body: JSON.stringify(corpo) });
            return { estado: r.status, corpo: await r.json().catch(() => null), temVerificacao: !!c['client-integrity'] };
          } });
      } catch (e) { if (tentativa >= 2) throw e; await dormir(3000); continue; }   // a pagina podia estar a carregar
      // verificacao em falta ou caducada: recarregar o inventario (a pagina gera outra) e tentar de novo
      const falhou = r && r.corpo && JSON.stringify(r.corpo.errors || '').includes('IntegrityCheckFailed');
      if (falhou && tentativa < 2) { await chrome.tabs.reload(tabId); await dormir(8000); continue; }
      if (falhou) throw new Error('a Twitch recusou a verificacao (Client-Integrity). Recarrega o separador do inventario e espera 2 min');
      return r;
    }
  };
}

// se o resgate pela consulta falhar: carregar nos botoes "Resgatar" do separador do inventario
async function resgatarNaPagina(tabId) {
  await chrome.tabs.reload(tabId); await dormir(8000);
  return chrome.scripting.executeScript({ target: { tabId }, func: () => {
    const botoes = [...document.querySelectorAll('button')].filter(b =>
      /claim-button/i.test(b.getAttribute('data-test-selector') || '') ||
      /^(resgatar|resgatar agora|reivindicar|reclamar|obter|claim|claim now)$/i.test(b.textContent.trim()));
    botoes.forEach(b => b.click());
    return botoes.length;
  } }).then(r => (r[0] && r[0].result) || 0).catch(() => 0);
}

// manter a stream a correr: aceitar o aviso +18 e carregar no play
async function manterAVer(tabId) {
  return chrome.scripting.executeScript({ target: { tabId }, func: () => {
    const botoes = [...document.querySelectorAll('button')];
    for (const b of botoes) {
      const alvo = b.getAttribute('data-a-target') || '';
      if (/mature-accept|start-watching/i.test(alvo) || /^(start watching|começar a assistir|comecar a assistir|iniciar transmissão)$/i.test(b.textContent.trim())) b.click();
    }
    const v = document.querySelector('video');
    if (v && v.paused) v.play().catch(() => {});
    return { video: !!v, parado: v ? v.paused : null };
  } }).then(r => r[0] && r[0].result).catch(() => null);
}

let aCorrer = false;
// a auto-correcao: busca os codigos da Twitch online (com a copia guardada, ou a de
// reserva que vem dentro da extensao, se a internet falhar)
async function carregarConfig(g) {
  if (g.config) aplicarConfig(g.config);                  // a ultima boa, primeiro
  if (Date.now() - (g.configQuando || 0) < CONFIG_HORAS * 3600000) return;
  try {
    const r = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!r.ok) return;
    const cfg = await r.json();
    if (aplicarConfig(cfg)) await chrome.storage.local.set({ config: cfg, configQuando: Date.now() });
  } catch { /* sem internet ou ficheiro em baixo: fica a copia de reserva */ }
}

async function passo() {
  if (aCorrer) return;
  aCorrer = true;
  try {
    const g = await guardado();
    if (!g.ligado) return;
    await carregarConfig(g);
    const agora = Date.now();
    const evitar = Object.fromEntries(Object.entries(g.evitar || {}).filter(([, ate]) => ate > agora));
    const s = await sessao();
    const inv = await separador(g.tabInv, INVENTARIO, false);
    // o inventario recarrega-se de 10 em 10 min, para veres o progresso actualizado
    if (agora - (g.recarregado || 0) > 10 * 60000) { await chrome.tabs.reload(inv.id); await dormir(5000); g.recarregado = agora; }
    const stream = await separador(g.tabStream, 'https://www.twitch.tv/directory/category/rust', false);
    await chrome.storage.local.set({ tabInv: inv.id, tabStream: stream.id, recarregado: g.recarregado || 0 });
    const gql = criarGql(pedirPeloInventario(inv.id, s.token));
    const d = await decidir({ gql, utilizador: s.utilizador, urlAtual: stream.url, evitar: Object.keys(evitar) });

    // os minutos estao a subir? (se o canal ficar 8 min parado, muda)
    // resgatar sozinha o que chegou a 100%
    let resgatados = [];
    const p = prontosParaResgatar(d.prontos, g.vistosProntos || {}, agora);
    await chrome.storage.local.set({ vistosProntos: p.vistos });
    // um drop acabou de ficar pronto: volta daqui a ~30 s so para o resgatar
    if (p.proximo) chrome.alarms.create('resgate', { when: Math.max(p.proximo, Date.now() + 1000) + 500 });
    if (p.agora.length) {
      const r = await resgatar(gql, p.agora, dormir);
      resgatados = r.ok;
      // o botao do inventario so como plano B, e no maximo uma vez a cada 10 min
      if (r.falharam.length && agora - (g.botaoQuando || 0) > 10 * 60000) {
        await chrome.storage.local.set({ botaoQuando: agora });
        if (await resgatarNaPagina(inv.id) > 0) resgatados = resgatados.concat(r.falharam);
      }
      if (resgatados.length) {
        for (const x of resgatados) { x.resgatado = true; x.pronto = false; }
        d.prontos = d.prontos.filter(x => !resgatados.includes(x));
        await chrome.tabs.reload(inv.id);
        chrome.notifications.create({ type: 'basic', iconUrl: 'icone.png', title: 'Drops do Rust', message: `Resgatado: ${resgatados.map(x => x.nome).join(', ')}` });
      }
    }
    const { prog, parado } = acompanhar(g.progresso, d, agora, PARADO_MIN);
    if (parado) { evitar[d.canal] = agora + EVITAR_MIN * 60000; d.aviso = `${d.canal}: os minutos nao sobem ha ${PARADO_MIN} min, mudo de canal daqui a 2 min`; }
    await chrome.storage.local.set({ evitar, progresso: prog });

    const linhas = d.campanhas.map(c => `${c.nome}${c.canais ? ` (${c.canais.slice(0, 3).join(', ')})` : ''}: ` +
      c.drops.map(x => `${x.nome} ${x.resgatado ? 100 : Math.min(100, Math.round(100 * x.minutos / (x.precisa || 1)))}%${x.resgatado ? ' ✔' : x.pronto ? ' 🎁' : x.bloqueado ? ' 🔒' : ''}`).join(', ')).join('\n');
    const avisos = [
      resgatados.length ? `🎁 resgatado agora: ${resgatados.map(x => x.nome).join(', ')}` : '',
      d.prontos.length ? `🎁 pronto, resgato daqui a ~30 s: ${d.prontos.map(x => x.nome).join(', ')}` : '',
      d.semLigacao.length ? `⚠ a Twitch diz que a conta nao esta ligada em: ${d.semLigacao.join(', ')} (twitch.facepunch.com/connect)` : '',
    ].filter(Boolean).join('\n');

    // (so acaba quando ja nao ha nada por resgatar)
    if (d.fim && !d.prontos.length) {
      await chrome.storage.local.set({ ligado: false });
      await mostrar('FIM', '#1f7a3d', `Drops: todos a 100% (${d.total}/${d.total}).\n${avisos}\nConfirma no inventario que estao resgatados e liga a Twitch a Steam (twitch.facepunch.com/connect).`);
      chrome.notifications.create({ type: 'basic', iconUrl: 'icone.png', title: 'Drops do Rust: acabou',
        message: `Os ${d.total} drops estao a 100%. Confirma no inventario e liga a Twitch a Steam.` });
      return;
    }
    if (d.ir) { await chrome.tabs.update(stream.id, { url: d.ir }); await dormir(8000); }
    const video = d.canal ? await manterAVer(stream.id) : null;
    const cor = d.prontos.length ? '#9146ff' : '#1f7a3d';
    if (d.canal) await mostrar(`${d.feitos}/${d.total}`, cor, `Drops: a ver ${d.canal} (${d.alvo.join(', ')})${video && video.parado ? ' — o video esta parado: carrega no play' : ''}\n${d.aviso ? d.aviso + '\n' : ''}${avisos ? avisos + '\n' : ''}${linhas}`);
    else await mostrar('...', '#8a5a00', `Drops: ${d.aviso || 'a espera'}\n${avisos ? avisos + '\n' : ''}${linhas}`);
  } catch (e) {
    await mostrar('!', '#b3261e', `Drops: erro (${e.message})`);
  } finally { aCorrer = false; }
}

chrome.action.onClicked.addListener(async () => {
  const { ligado } = await guardado();
  await chrome.storage.local.set({ ligado: !ligado, evitar: {}, progresso: {} });
  if (ligado) await mostrar('', null, 'Drops: desligado (clica para ligar)');
  else { await mostrar('...', '#8a5a00', 'Drops: a comecar (abre o inventario e a stream)'); passo(); }
});
chrome.alarms.create('drops', { periodInMinutes: 2 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'drops' || a.name === 'resgate') passo(); });
chrome.runtime.onStartup.addListener(passo);
