// A decisao, de 2 em 2 minutos (o resgate dos drops a 100% faz-se em fundo.js):
//   1. le as campanhas de drops do Rust e o teu progresso em cada drop;
//   2. um drop a 100% conta como feito (fica "pronto a resgatar");
//   3. escolhe o canal: um streamer com drop por fazer ao vivo (conta tambem para os
//      gerais), senao qualquer canal de Rust com drops; cada canal e confirmado com a
//      Twitch ("que campanhas se ganham aqui?");
//   4. quando todos os drops estao a 100%, diz "fim".
// As regras de "este drop pode ser ganho agora" seguem as do TwitchDropsMiner (DevilXD,
// licenca MIT, commit 22d0c61): campanha activa, janela do drop, pre-requisitos
// resgatados, canal na lista da campanha, a jogar o jogo, com a campanha disponivel.
export let JOGO = { slug: 'rust', nome: 'Rust' };
export let WEB = 'kimne78kx3ncx6brgo4mv6wki5h1ko';          // o identificador da pagina web da Twitch
// tempos do resgate: esperar que o drop esteja pronto ha X s; Y s entre resgates
export let RESGATE = { esperaSeg: 30, entreSeg: 5 };
export let CONSULTAS = {
  canal: ['VideoPlayerStreamInfoOverlayChannel', '198492e0857f6aedead9665c81c5a06d67b25b58034649687124083ff288597d'],
  diretorio: ['DirectoryPage_Game', '86bcceb4e8b1a51256ff8eed8bd8aae4acacf80d737efe904f84f3aeadf8cafd'],
  campanhas: ['ViewerDropsDashboard', 'c16bb890cc8ce7647a96ee69cd313d423a378a3dedadf630a1017cde18975feb'],
  detalhes: ['DropCampaignDetails', '039277bf98f3130929262cc7c6efd9c141ca3749cb6dca442fc8ead9a53f77c1'],
  inventario: ['Inventory', '8337eb8541b314040b0edde0c09c5c7a2783ba1960aa9edfbf3bac16d0fec404'],
  disponiveis: ['DropsHighlightService_AvailableDrops', '782dad0f032942260171d2d80a654f88bdd0c5a9dddc392e9bc92218a0f42d20'],
  resgatar: ['DropsPage_ClaimDropRewards', 'a455deea71bdc9015b78eb49f4acfbce8baa7ccbedd28e549bb025bd0f751930'],
};

// Substituir os codigos por uma config vinda de fora (a auto-correcao). So aceita se
// tiver as 6 consultas certas, cada uma com nome e um hash de 64 caracteres; senao,
// ficam os que a extensao ja tinha. Devolve true se aplicou.
export function aplicarConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  const c = cfg.consultas;
  if (!c || typeof c !== 'object') return false;
  const precisas = Object.keys(CONSULTAS);
  for (const k of precisas) {
    const v = c[k];
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || !/^[0-9a-f]{64}$/.test(v[1] || '')) return false;
  }
  CONSULTAS = Object.fromEntries(precisas.map(k => [k, [c[k][0], c[k][1]]]));
  if (cfg.jogo && cfg.jogo.slug && cfg.jogo.nome) JOGO = { slug: String(cfg.jogo.slug), nome: String(cfg.jogo.nome) };
  if (typeof cfg.web === 'string' && cfg.web) WEB = cfg.web;
  const r = cfg.resgate || {};
  if (Number.isFinite(r.esperaSeg) && r.esperaSeg >= 5 && r.esperaSeg <= 3600) RESGATE = { ...RESGATE, esperaSeg: r.esperaSeg };
  if (Number.isFinite(r.entreSeg) && r.entreSeg >= 2 && r.entreSeg <= 120) RESGATE = { ...RESGATE, entreSeg: r.entreSeg };
  return true;
}

// `pedir(corpo)` manda uma consulta ao GQL da Twitch e devolve { estado, corpo }
export function criarGql(pedir) {
  return async function gql(qual, variables) {
    const [operationName, sha256Hash] = CONSULTAS[qual];
    const { estado, corpo: d } = await pedir({ operationName, variables, extensions: { persistedQuery: { version: 1, sha256Hash } } });
    if (estado === 401) throw new Error('a Twitch pediu login: entra na Twitch neste Chrome');
    if (estado !== 200 || !d || (d.errors && d.errors.length)) throw new Error(`Twitch ${operationName}: ${estado} ${JSON.stringify((d && d.errors) || d).slice(0, 150)}`);
    return d.data;
  };
}

const doJogo = g => !!g && [g.slug, g.name, g.displayName].filter(Boolean).some(x => x.toLowerCase() === JOGO.slug || x === JOGO.nome);
const dentro = (agora, ini, fim) => (!ini || Date.parse(ini) <= agora) && (!fim || agora < Date.parse(fim));

// o canal que um endereco da Twitch mostra (twitch.tv/<canal>), ou null
export function canalDe(url) {
  const m = /^https:\/\/(www\.)?twitch\.tv\/([A-Za-z0-9_]{2,25})\/?(\?|$)/.exec(url || '');
  const reservados = ['directory', 'drops', 'settings', 'search', 'videos', 'downloads', 'subscriptions', 'wallet', 'inventory', 'p', 'u'];
  return m && !reservados.includes(m[2].toLowerCase()) ? m[2].toLowerCase() : null;
}

// As campanhas do Rust com o teu progresso. Cada drop:
//   { id, nome, minutos, precisa, resgatado, pronto (100% e por resgatar), feito (100%),
//     bloqueado (falta resgatar um anterior), activo (dentro da janela), porVer }
export async function campanhas(gql, utilizador, agora = Date.now()) {
  const todas = ((await gql('campanhas', { fetchRewardCampaigns: false })).currentUser || {}).dropCampaigns || [];
  const doRust = todas.filter(c => c.status === 'ACTIVE' && doJogo(c.game));
  const inv = ((await gql('inventario', { fetchRewardCampaigns: false })).currentUser || {}).inventory || {};
  const meu = {};
  for (const c of inv.dropCampaignsInProgress || []) for (const d of c.timeBasedDrops || []) if (d.self) meu[d.id] = d.self;
  const ganhos = new Set((inv.gameEventDrops || []).map(b => b.id));
  const out = [];
  for (const c of doRust) {
    const det = ((await gql('detalhes', { channelLogin: String(utilizador), dropID: c.id })).user || {}).dropCampaign;
    if (!det) continue;
    const a = det.allow;
    const canais = a && a.isEnabled !== false && a.channels && a.channels.length ? a.channels.map(x => String(x.name || x.login).toLowerCase()) : null;
    const eu = det.self || c.self || {};
    const drops = (det.timeBasedDrops || []).map(d => {
      const s = meu[d.id] || d.self || {};
      const beneficios = (d.benefitEdges || []).map(b => b.benefit && b.benefit.id).filter(Boolean);
      const resgatado = !!s.isClaimed || (beneficios.length > 0 && beneficios.every(b => ganhos.has(b)));
      const minutos = s.currentMinutesWatched || 0, precisa = d.requiredMinutesWatched || 0;
      return { id: d.id, nome: d.name || ((d.benefitEdges || [])[0] || {}).benefit?.name || 'drop', minutos, precisa, resgatado,
        pronto: !resgatado && precisa > 0 && minutos >= precisa, feito: resgatado || minutos >= precisa, instancia: s.dropInstanceID || null,
        activo: dentro(agora, d.startAt || det.startAt, d.endAt || det.endAt),
        pre: (d.preconditionDrops || []).map(p => p.id), beneficios: beneficios.length };
    });
    for (const d of drops) {
      d.bloqueado = d.pre.some(id => { const p = drops.find(x => x.id === id); return p && !p.resgatado; });
      // (como no DevilXD: um drop sem premio so conta se for pre-requisito de outro)
      const temSentido = d.beneficios > 0 || drops.some(x => x.pre.includes(d.id));
      d.porVer = !d.feito && d.activo && !d.bloqueado && d.precisa > 0 && temSentido;
    }
    out.push({ id: c.id, nome: det.name || c.name, canais, ligada: eu.isAccountConnected !== false, drops });
  }
  return out;
}

// o resumo: o que falta ver, o que esta pronto a resgatar, o que espera por um resgate
export function plano(lista) {
  const todos = lista.flatMap(c => c.drops.map(d => ({ ...d, campanha: c.nome })));
  const porVer = lista.filter(c => c.drops.some(d => d.porVer));
  const bloqueados = todos.filter(d => !d.feito && d.bloqueado && d.activo);
  return { porVer, prontos: todos.filter(d => d.pronto), bloqueados, total: todos.length, feitos: todos.filter(d => d.feito).length,
    fim: lista.length > 0 && !porVer.length && !bloqueados.length };
}

// um canal: esta ao vivo no Rust? que campanhas (das que queremos) se ganham la?
export async function campanhasNoCanal(gql, login, queremos) {
  const u = (await gql('canal', { channel: login })).user;
  if (!u || !u.stream || !doJogo(u.broadcastSettings && u.broadcastSettings.game)) return [];
  const ch = (await gql('disponiveis', { channelID: String(u.id) })).channel;
  const ids = new Set(((ch && ch.viewerDropCampaigns) || []).map(c => c.id));
  return queremos.filter(c => ids.has(c.id) && (!c.canais || c.canais.includes(login)));
}

async function candidatosDoDiretorio(gql, evitar) {
  const d = await gql('diretorio', { limit: 30, slug: JOGO.slug, imageWidth: 50, includeCostreaming: false, sortTypeIsRecency: false,
    options: { broadcasterLanguages: [], freeformTags: null, includeRestricted: ['SUB_ONLY_LIVE'], recommendationsContext: { platform: 'web' },
      sort: 'VIEWER_COUNT', systemFilters: ['DROPS_ENABLED'], tags: [], requestID: 'JIRA-VXP-2397' } });
  return ((d.game && d.game.streams && d.game.streams.edges) || []).map(e => e.node).filter(n => n && n.broadcaster)
    .map(n => n.broadcaster.login.toLowerCase()).filter(l => !evitar.includes(l));
}

// O passo todo: para onde vai o separador da stream (ir: null = fica), e o resumo.
export async function decidir({ gql, utilizador, urlAtual, evitar = [], agora = Date.now() }) {
  const lista = await campanhas(gql, utilizador, agora);
  const p = plano(lista);
  const base = { total: p.total, feitos: p.feitos, prontos: p.prontos, bloqueados: p.bloqueados, fim: p.fim, campanhas: lista,
    semLigacao: lista.filter(c => !c.ligada && c.drops.some(d => d.porVer)).map(c => c.nome) };
  if (!lista.length) return { ...base, ir: null, canal: null, aviso: 'nao ha campanhas de drops do Rust activas agora' };
  if (!p.porVer.length) return { ...base, ir: null, canal: null,
    aviso: p.bloqueados.length ? `resgata no inventario o drop anterior a "${p.bloqueados[0].nome}" para ele comecar` : null };
  const atual = canalDe(urlAtual);
  const deStreamer = p.porVer.filter(c => c.canais), gerais = p.porVer.filter(c => !c.canais);
  const aqui = atual && !evitar.includes(atual) ? await campanhasNoCanal(gql, atual, p.porVer) : [];
  // 1. ja estou num canal de um streamer com drop por fazer: fico
  if (aqui.some(c => c.canais)) return { ...base, ir: null, canal: atual, alvo: aqui.map(c => c.nome) };
  // 2. um streamer com drop por fazer ao vivo? vai para la (conta tambem para os gerais)
  const vistos = new Set([atual]);
  for (const c of deStreamer) for (const login of c.canais.slice(0, 10)) {
    if (vistos.has(login) || evitar.includes(login)) continue;
    vistos.add(login);
    const la = await campanhasNoCanal(gql, login, p.porVer);
    if (la.length) return { ...base, ir: `https://www.twitch.tv/${login}`, canal: login, alvo: la.map(x => x.nome), saiu: atual };
  }
  // 3. os gerais: fico se o canal actual os da; senao, o primeiro do diretorio que os de
  if (gerais.length) {
    if (aqui.length) return { ...base, ir: null, canal: atual, alvo: aqui.map(c => c.nome) };
    for (const login of (await candidatosDoDiretorio(gql, [...evitar, ...(atual ? [atual] : [])])).slice(0, 5)) {
      const la = await campanhasNoCanal(gql, login, p.porVer);
      if (la.length) return { ...base, ir: `https://www.twitch.tv/${login}`, canal: login, alvo: la.map(x => x.nome), saiu: atual };
    }
  }
  return { ...base, ir: null, canal: null, aviso: 'os canais que faltam estao offline; volto a ver daqui a 2 min' };
}

// Os minutos estao a subir no canal que estou a ver? Soma de todos os drops (limitada a
// 100% de cada um: assim nunca desce quando um drop acaba). Se o mesmo canal ficar
// `paradoMin` minutos sem subir, devolve parado: true (e altura de mudar).
export function acompanhar(anterior, d, agora, paradoMin = 8) {
  const soma = d.campanhas.flatMap(c => c.drops).reduce((n, x) => n + Math.min(x.minutos, x.precisa), 0);
  const a = anterior || {};
  if (!d.canal || d.ir || a.canal !== d.canal || soma > a.soma) return { prog: { canal: d.ir ? null : d.canal, soma, desde: agora }, parado: false };
  if (agora - a.desde >= paradoMin * 60000) return { prog: {}, parado: true };
  return { prog: a, parado: false };
}

// Resgatar os drops a 100%: primeiro pela consulta da Twitch; devolve os que falharam
// (para o fundo.js carregar no botao do inventario). A Twitch responde ELIGIBLE_FOR_ALL
// (resgatado) ou DROP_INSTANCE_ALREADY_CLAIMED.
export async function resgatar(gql, prontos, dormir = ms => new Promise(r => setTimeout(r, ms))) {
  const ok = [], falharam = [];
  for (const [i, d] of prontos.entries()) {
    if (i > 0) await dormir(RESGATE.entreSeg * 1000);
    if (!d.instancia) { falharam.push(d); continue; }
    try {
      const r = await gql('resgatar', { input: { dropInstanceID: d.instancia } });
      const estado = r && r.claimDropRewards && r.claimDropRewards.status;
      if (['ELIGIBLE_FOR_ALL', 'DROP_INSTANCE_ALREADY_CLAIMED'].includes(estado)) ok.push(d); else falharam.push(d);
    } catch { falharam.push(d); }
  }
  return { ok, falharam };
}

// Quais dos prontos ja podem ser resgatados: so os que estao prontos ha pelo menos
// esperaSeg segundos (a Twitch so liberta o botao a 100%; nao resgatar no primeiro segundo).
// `vistos` = { idDoDrop: quando o vi pronto pela 1a vez }. Devolve { agora, vistos, proximo }
// (proximo = quando o proximo ficar maduro, para marcar o despertador).
export function prontosParaResgatar(prontos, vistos = {}, agora = Date.now(), esperaSeg = RESGATE.esperaSeg) {
  const novos = {};
  for (const d of prontos) novos[d.id] = Number.isFinite(vistos[d.id]) ? vistos[d.id] : agora;
  const espera = esperaSeg * 1000;
  const verdes = prontos.filter(d => agora - novos[d.id] < espera).map(d => novos[d.id] + espera);
  return { agora: prontos.filter(d => agora - novos[d.id] >= espera), vistos: novos, proximo: verdes.length ? Math.min(...verdes) : null };
}
