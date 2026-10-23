// O que corre por tras. Clicas no icone e ela faz o resto, de 2 em 2 minutos, numa aba so,
// a da STREAM (sem som e na qualidade mais baixa, para gastar o minimo de internet e PC):
// poe-na no canal certo, carrega no play se o video parar, aceita o aviso "+18", e muda
// de canal quando o canal acaba, deixa de dar drops, ou os minutos param de subir 8 min.
// Resgata sozinha os drops a 100% (pela consulta da Twitch; se falhar, abre o inventario
// so para carregar no botao e fecha-o). O icone mostra a skin que esta a farmar.
// Usa a tua sessao da Twitch deste Chrome (cookie "auth-token"); nao ve a password.
import './textos.js';
import { criarGql, decidir, acompanhar, aplicarConfig, resgatar, prontosParaResgatar, canalDe, campanhasNoCanal, WEB } from './logica.js';
const DIRETORIO = 'https://www.twitch.tv/directory/category/rust';

const CONFIG_URL = 'https://raw.githubusercontent.com/tchubirs/Drops-extension/main/config.json';
const CONFIG_HORAS = 6;

const INVENTARIO = 'https://www.twitch.tv/drops/inventory';
const PARADO_MIN = 8, EVITAR_MIN = 30;
const guardado = () => chrome.storage.local.get(['ligado', 'tabInv', 'tabStream', 'evitar', 'progresso', 'recarregado', 'config', 'configQuando', 'vistosProntos', 'botaoQuando', 'canalNosso', 'jogos', 'webhook', 'avisouLogin']);
const mostrar = async (texto, cor, titulo) => {
  await chrome.action.setBadgeText({ text: texto });
  if (cor) await chrome.action.setBadgeBackgroundColor({ color: cor });
  if (titulo) await chrome.action.setTitle({ title: titulo.slice(0, 2000) });
};
const dormir = ms => new Promise(ok => setTimeout(ok, ms));
// registo visivel (menu do icone -> "Ver registo"): so o que a extensao fez, guardado neste Chrome
const registar = async texto => {
  const { registo = [] } = await chrome.storage.local.get('registo');
  registo.push({ t: Date.now(), texto });
  await chrome.storage.local.set({ registo: registo.slice(-100) });
};
// modo repouso: sem campanha activa nos jogos escolhidos, verifica de hora a hora em vez de 2 em 2 min
const periodo = async min => {
  const a = await chrome.alarms.get('drops');
  if (!a || a.periodInMinutes !== min) { await chrome.alarms.create('drops', { periodInMinutes: min }); await registar(min > 2 ? T.repouso : T.ativo); }
};
// o que o painel (painel.html) mostra: le-o do storage e actualiza-se sozinho
const pct = x => x.resgatado ? 100 : Math.min(100, Math.round(100 * x.minutos / (x.precisa || 1)));
// minutos que faltam: os drops sobem todos ao mesmo tempo, por isso o total e o maior que falta
const falta = x => x.resgatado || x.feito ? 0 : Math.max(0, (x.precisa || 0) - (x.minutos || 0));
const faltaTotal = d => Math.max(0, ...d.campanhas.flatMap(c => c.drops).filter(x => x.activo !== false).map(falta));
const guardarEstado = (d, extra = {}) => chrome.storage.local.set({ estado: {
  quando: Date.now(), canal: d && d.canal || null, feitos: d ? d.feitos : 0, total: d ? d.total : 0,
  faltaTotal: d ? faltaTotal(d) : 0,
  campanhas: d ? d.campanhas.map(c => ({ nome: c.nome, drops: c.drops.map(x => ({ nome: curto(x.nome, c.nome), imagem: x.imagem, pct: pct(x), falta: falta(x), resgatado: x.resgatado, pronto: x.pronto })) })) : [],
  semLigacao: d ? d.semLigacao : [], jogos: d ? d.jogos : [], ...extra } });

// avisos no Discord (e por ele no celular): so se a pessoa colar o webhook dela no painel.
// Vai como formulario, que o Discord aceita sem permissao extra da extensao.
async function avisar(texto) {
  const { webhook } = await chrome.storage.local.get('webhook');
  if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(webhook || '')) return;
  const f = new FormData();
  f.append('payload_json', JSON.stringify({ username: NOME, content: texto }));
  await fetch(webhook, { method: 'POST', mode: 'no-cors', body: f }).catch(() => {});
}

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

// as consultas vao de dentro da aba da stream, com os mesmos cabecalhos que a propria
// pagina usa (o "Client-Integrity" que ela gera; guardado por cabecalhos-twitch.js)
// (podeRecarregar = false quando a aba e da pessoa: nunca recarregamos a aba dela)
function pedirPelaAba(tabId, token, podeRecarregar = true) {
  return async corpo => {
    for (let tentativa = 0; ; tentativa++) {
      let r;
      try {
        [{ result: r }] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', args: [corpo, token, WEB],
          func: async (corpo, token, id) => {
            // espera ate 15 s que a pagina faca o primeiro pedido dela (com a verificacao)
            for (let i = 0; i < 30 && !(window.__twitchCabecalhos || {})['client-integrity']; i++) await new Promise(ok => setTimeout(ok, 500));
            const c = window.__twitchCabecalhos || {};
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
      if (falhou && tentativa < 2 && podeRecarregar) { await chrome.tabs.reload(tabId); await dormir(8000); continue; }
      if (falhou) throw new Error('a Twitch recusou a verificacao (Client-Integrity). Recarrega o separador do inventario e espera 2 min');
      return r;
    }
  };
}

// se o resgate pela consulta falhar: abrir o inventario em segundo plano, carregar nos
// botoes "Resgatar" e fechar
async function resgatarNaPagina() {
  const tab = await chrome.tabs.create({ url: INVENTARIO, active: false });
  await chrome.tabs.update(tab.id, { muted: true }).catch(() => {});
  await dormir(9000);
  const n = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
    const botoes = [...document.querySelectorAll('button')].filter(b =>
      /claim-button/i.test(b.getAttribute('data-test-selector') || '') ||
      /^(resgatar|resgatar agora|reivindicar|reclamar|obter|claim|claim now)$/i.test(b.textContent.trim()));
    botoes.forEach(b => b.click());
    return botoes.length;
  } }).then(r => (r[0] && r[0].result) || 0).catch(() => 0);
  await dormir(3000);
  await chrome.tabs.remove(tab.id).catch(() => {});
  return n;
}

// manter a stream a correr: aceitar o aviso +18, carregar no play, sem som e na qualidade
// mais baixa (uma vez por canal; a escolha de qualidade nao fica guardada para as tuas
// outras abas da Twitch)
async function manterAVer(tabId) {
  await chrome.tabs.update(tabId, { muted: true }).catch(() => {});
  return chrome.scripting.executeScript({ target: { tabId }, func: async () => {
    const espera = ms => new Promise(ok => setTimeout(ok, ms));
    for (const b of document.querySelectorAll('button')) {
      const alvo = b.getAttribute('data-a-target') || '';
      if (/mature-accept|start-watching/i.test(alvo) || /^(start watching|começar a assistir|comecar a assistir|iniciar transmissão)$/i.test(b.textContent.trim())) b.click();
    }
    const v = document.querySelector('video');
    if (v) { v.muted = true; if (v.paused) v.play().catch(() => {}); }
    if (v && window.__dropsQualidade !== location.pathname) {
      const antes = localStorage.getItem('video-quality');
      const menu = document.querySelector('[data-a-target="player-settings-button"]');
      if (menu) {
        menu.click(); await espera(400);
        const q = document.querySelector('[data-a-target="player-settings-menu-item-quality"]');
        if (q) {
          q.click(); await espera(400);
          const opcoes = [...document.querySelectorAll('input[name="player-settings-submenu-quality-option"]')];
          const menor = opcoes[opcoes.length - 1];
          if (menor) { (menor.closest('label') || menor).click(); window.__dropsQualidade = location.pathname; }
        }
        await espera(300);
        if (document.querySelector('[data-a-target="player-settings-menu"]')) menu.click();
        setTimeout(() => { if (antes === null) localStorage.removeItem('video-quality'); else localStorage.setItem('video-quality', antes); }, 2000);
      }
    }
    return { video: !!v, parado: v ? v.paused : null };
  } }).then(r => r[0] && r[0].result).catch(() => null);
}

// o icone e sempre a logo (versoes de teste trocavam-no pela skin)
const iconeNormal = () => chrome.action.setIcon({ path: 'icone.png' }).catch(() => {});
iconeNormal();

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
    // versoes antigas deixavam a aba do inventario aberta: ja nao e precisa
    if (g.tabInv) {
      const velha = await chrome.tabs.get(g.tabInv).catch(() => null);
      if (velha && /twitch\.tv\/drops\/inventory/.test(velha.url || '')) await chrome.tabs.remove(velha.id).catch(() => {});
      await chrome.storage.local.set({ tabInv: null });
    }
    // As abas da Twitch abertas. A "nossa" e so a que a extensao abriu; se a pessoa mudar de
    // canal nela, passa a ser dela e nunca mais mexemos nessa aba.
    const abas = await chrome.tabs.query({ url: 'https://www.twitch.tv/*' });
    let nossa = g.tabStream ? abas.find(t => t.id === g.tabStream) || null : null;
    // (um "raid" da Twitch tambem muda o canal da aba sozinho: esse nao conta como a pessoa;
    //  e uma aba de versao antiga num canal sem registo de qual era: fica para a pessoa)
    const mudou = nossa && canalDe(nossa.url) && (g.canalNosso ? canalDe(nossa.url) !== g.canalNosso : true);
    if (mudou && !/referrer=raid/.test(nossa.url || '')) {
      nossa = null;
      await chrome.storage.local.set({ tabStream: null, canalNosso: null });
    }
    if (nossa && nossa.discarded) { await chrome.tabs.reload(nossa.id).catch(() => {}); await dormir(6000); }
    const canalInicio = nossa ? canalDe(nossa.url) : null;
    const dela = abas.filter(t => (!nossa || t.id !== nossa.id) && canalDe(t.url));
    // para as consultas basta qualquer aba da Twitch; so abrimos a nossa se nao houver nenhuma
    if (!nossa && !abas.some(t => !t.discarded)) {
      nossa = await separador(null, DIRETORIO, false);
      await chrome.storage.local.set({ tabStream: nossa.id, canalNosso: null });
    }
    if (nossa) await chrome.tabs.update(nossa.id, { muted: true, autoDiscardable: false }).catch(() => {});
    const abaGql = nossa || abas.find(t => !t.discarded);
    let gql = criarGql(pedirPelaAba(abaGql.id, s.token, !!nossa && abaGql.id === nossa.id));
    const d = await decidir({ gql, utilizador: s.utilizador, urlAtual: nossa ? nossa.url : null, evitar: Object.keys(evitar), jogos: Array.isArray(g.jogos) ? g.jogos : null });
    // A nossa aba nunca e fechada pela extensao (se a pessoa quiser, fecha ela). Se a pessoa a
    // fechou e ja esta a ver, numa aba dela, um canal que conta: nao abrimos outra por cima.
    let sua = null;
    if (!nossa) {
      const queremos = d.campanhas.filter(c => c.drops.some(x => x.porVer));
      if (queremos.length) for (const t of dela.slice(0, 6)) {
        const la = await campanhasNoCanal(gql, canalDe(t.url), queremos).catch(() => []);
        if (la.length) {
          sua = canalDe(t.url);
          // as consultas seguintes (resgates) vao pela aba dela, sem nunca a recarregar
          if (!t.discarded) gql = criarGql(pedirPelaAba(t.id, s.token, false));
          break;
        }
      }
      if (sua) {
        if (d.canal !== sua) await registar(`👤 ${T.assistindo} ${sua}`);
        d.canal = sua; d.ir = null;
      }
    }
    if (g.avisouLogin) await chrome.storage.local.set({ avisouLogin: false });

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
        if (await resgatarNaPagina() > 0) resgatados = resgatados.concat(r.falharam);
      }
      if (resgatados.length) {
        for (const x of resgatados) { x.resgatado = true; x.pronto = false; }
        const ids = new Set(resgatados.map(x => x.id));
        for (const c of d.campanhas) for (const x of c.drops) if (ids.has(x.id)) { x.resgatado = true; x.pronto = false; x.feito = true; }
        d.prontos = d.prontos.filter(x => !resgatados.includes(x));
        chrome.notifications.create({ type: 'basic', iconUrl: 'icone.png', title: NOME, message: `🎁 ${T.resgatado}: ${resgatados.map(x => curto(x.nome, x.campanha || '')).join(', ')}` });
        avisar(`🎁 ${T.resgatado}: ${resgatados.map(x => curto(x.nome, x.campanha || '')).join(', ')}`);
      }
    }
    await periodo(d.campanhas.length ? 2 : 60);
    if (resgatados.length) await registar(`🎁 ${T.resgatado}: ${resgatados.map(x => curto(x.nome, x.campanha || '')).join(', ')}`);
    if (d.ir) await registar(`▶ ${T.assistindo} ${d.ir.split('/').pop()}`);
    await chrome.storage.local.set({ ultimoErro: '' });
    const { prog, parado } = acompanhar(g.progresso, d, agora, PARADO_MIN);
    if (parado && !sua) { await registar(`↻ ${d.canal}: ${T.trocando}`); evitar[d.canal] = agora + EVITAR_MIN * 60000; d.aviso = `${d.canal}: os minutos nao sobem ha ${PARADO_MIN} min, mudo de canal daqui a 2 min`; }
    await chrome.storage.local.set({ evitar, progresso: prog });

    // (so acaba quando ja nao ha nada por resgatar)
    if (d.fim && !d.prontos.length) {
      await chrome.storage.local.set({ ligado: false });
      await guardarEstado(d, { fim: true });
      await registar(`🎉 ${T.fim}`);
      await iconeNormal();
      await mostrar('✓', '#1f7a3d', titulo(d, [`🎉  ${T.fim}`]));
      chrome.notifications.create({ type: 'basic', iconUrl: 'icone.png', title: NOME, message: `🎉 ${T.fim}` });
      avisar(`🎉 ${T.fim}`);
      return;
    }
    // antes de mexer na nossa aba, confere de novo: se a pessoa trocou o canal entretanto, e dela
    if (nossa) {
      const agoraAba = await chrome.tabs.get(nossa.id).catch(() => null);
      if (!agoraAba || (canalDe(agoraAba.url) && canalDe(agoraAba.url) !== canalInicio && !/referrer=raid/.test(agoraAba.url || ''))) {
        nossa = null;
        await chrome.storage.local.set({ tabStream: null, canalNosso: null });
      }
    }
    if (d.ir) {
      if (nossa) await chrome.tabs.update(nossa.id, { url: d.ir });
      else { nossa = await chrome.tabs.create({ url: d.ir, active: false }); await chrome.tabs.update(nossa.id, { muted: true, autoDiscardable: false }).catch(() => {}); }
      await chrome.storage.local.set({ tabStream: nossa.id, canalNosso: canalDe(d.ir) });
      await dormir(8000);
    } else if (nossa && canalDe(nossa.url)) await chrome.storage.local.set({ canalNosso: canalDe(nossa.url) });
    if (d.canal && nossa && !sua) await manterAVer(nossa.id);
    await guardarEstado(d, { procurando: !d.canal, parado, resgatados: resgatados.map(x => curto(x.nome, x.campanha || '')) });
    const so = x => x.map(y => curto(y.nome, y.campanha || '')).join(', ');
    const status = [
      parado ? `↻  ${T.trocando}` : d.canal ? `▶  ${T.assistindo} ${d.canal}` : !d.campanhas.length ? T.nenhum :
        d.bloqueados.length && !d.prontos.length ? `🔒  ${T.anterior}` : `⏳  ${T.procurando}`,
      resgatados.length ? `🎁  ${T.resgatado}: ${so(resgatados)}` : '',
      d.prontos.length ? `🎁  ${T.resgatando}: ${so(d.prontos)}` : '',
      d.semLigacao.length ? `🔗  ${T.steam} twitch.facepunch.com/connect` : '',
    ];
    // o selo do Chrome so mostra ~4 caracteres: "2/6" cabe; "20/21" nao, e vira "20✓"
    const selo = `${d.feitos}/${d.total}`.length <= 4 ? `${d.feitos}/${d.total}` : `${d.feitos}✓`;
    await mostrar(d.canal ? selo : '…', d.prontos.length ? '#9146ff' : d.canal ? '#1f7a3d' : '#53535f', titulo(d, status));
  } catch (e) {
    const login = /entra|login|sessao/i.test(e.message);
    const { ultimoErro } = await chrome.storage.local.get('ultimoErro');
    if (ultimoErro !== e.message) { await registar(`⚠️ ${e.message}`); await chrome.storage.local.set({ ultimoErro: e.message }); }
    if (login) { const { avisouLogin } = await chrome.storage.local.get('avisouLogin'); if (!avisouLogin) { await chrome.storage.local.set({ avisouLogin: true }); avisar(`⚠️ ${T.login}`); } }
    await mostrar('…', '#53535f', `${NOME}\n${login ? T.login : T.reconectando}`);
    await chrome.storage.local.set({ estado: { quando: Date.now(), erro: login ? 'login' : 'tentar' } });
  } finally { aCorrer = false; }
}

// o texto que aparece ao passar o rato no icone
const barra = p => '▰'.repeat(Math.round(p / 10)) + '▱'.repeat(10 - Math.round(p / 10));
// "Twitch Rivals Spooky Rug" na campanha "Twitch Rivals BI Generals" -> "Spooky Rug"
function curto(nome, campanha) {
  const a = String(nome).split(' '), b = String(campanha).split(' ');
  let i = 0;
  while (i < a.length - 1 && a[i] === b[i]) i++;
  return a.slice(i).join(' ');
}
function titulo(d, status) {
  const corpo = d.campanhas.map(c => [c.nome, ...c.drops.map(x => {
    const p = pct(x), nome = curto(x.nome, c.nome);
    return x.resgatado ? `   ✓  ${nome}` : `   ${barra(p)}  ${p}%  ${nome}${falta(x) ? `  (${tempo(falta(x))})` : ''}`;
  })].join('\n')).join('\n\n');
  return [`${NOME}  ·  ${d.feitos} ${T.de} ${d.total} ✓${faltaTotal(d) ? `  ·  ⏱ ${tempo(faltaTotal(d))}` : ''}`, ...status.filter(Boolean), '', corpo].join('\n');
}

async function alternar() {
  const { ligado } = await guardado();
  await chrome.storage.local.set({ ligado: !ligado, evitar: {}, progresso: {}, estado: { quando: Date.now(), comecando: !ligado } });
  await registar(ligado ? T.pausado : T.ligar);
  if (!ligado) await chrome.alarms.create('drops', { periodInMinutes: 2 });
  if (ligado) { await iconeNormal(); await mostrar('', null, `${NOME}\n${T.pausado}`); }
  else { await mostrar('…', '#53535f', `${NOME}\n${T.comecando}`); passo(); }
  return !ligado;
}
// ligar/pausar vem do botao da janelinha (painel.html)
chrome.runtime.onMessage.addListener((m, _de, responder) => {
  if (m && m.tipo === 'alternar') { alternar().then(ligado => responder({ ligado })); return true; }
  if (m && m.tipo === 'agora') { passo(); responder({}); }
});
chrome.alarms.get('drops').then(a => { if (!a) chrome.alarms.create('drops', { periodInMinutes: 2 }); });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'drops' || a.name === 'resgate') passo(); });

// menu do icone (botao direito): a pagina de ajuda e privacidade, e o registo
const AJUDA = 'https://tchubirs.github.io/drops/';
async function menu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'ajuda', title: T.menuAjuda, contexts: ['action'] });
  chrome.contextMenus.create({ id: 'registo', title: T.menuRegisto, contexts: ['action'] });
}
chrome.contextMenus.onClicked.addListener(i => {
  if (i.menuItemId === 'ajuda') chrome.tabs.create({ url: AJUDA });
  if (i.menuItemId === 'registo') chrome.tabs.create({ url: chrome.runtime.getURL('registo.html') });
});
chrome.runtime.onStartup.addListener(() => { menu(); passo(); });
chrome.runtime.onInstalled.addListener(() => { menu(); passo(); });
