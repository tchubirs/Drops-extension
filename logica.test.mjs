// A decisao da extensao contra uma Twitch falsa, de 2 em 2 minutos ate ao fim.
// A extensao nao resgata: aqui "tu" resgatas quando ela diz que ha drops prontos.
// Nao prova que a Twitch verdadeira aceita tudo.
import assert from 'assert';
import { canalDe, criarGql, decidir, plano, acompanhar, aplicarConfig, CONSULTAS, resgatar, prontosParaResgatar, RESGATE } from './logica.js';

const rust = { id: '263490', name: 'Rust', slug: 'rust' };
function criarMundo() {
  return {
    noAr: { grande: rust, pequeno: rust, semdrops: rust, toast: null },
    semCampanhas: new Set(['semdrops']),                 // ao vivo no Rust, mas sem drops ligados
    campanhas: [
      { id: 'geral', name: 'Rust Isles', canais: null, drops: [{ id: 'd1', name: 'Large Wood Box', precisa: 60 }, { id: 'd2', name: 'Auto Turret', precisa: 120 }] },
      { id: 'st', name: 'Rust Isles: DisguisedToast', canais: ['toast'], drops: [{ id: 'd3', name: 'SAR', precisa: 60 }] },
      { id: 'fort', name: 'Fortnite', game: { name: 'Fortnite', slug: 'fortnite' }, canais: null, drops: [{ id: 'f1', name: 'Picareta', precisa: 30 }] },
    ],
    min: {}, resgatados: new Set(), pedidos: [],
  };
}
let mundo = criarMundo();
const pedir = async corpo => {
  const v = corpo.variables, n = corpo.operationName;
  mundo.pedidos.push(n);
  const ok = data => ({ estado: 200, corpo: { data } });
  if (n === 'VideoPlayerStreamInfoOverlayChannel') { const g = mundo.noAr[v.channel]; return ok({ user: { id: 'id-' + v.channel, login: v.channel, stream: g ? { id: 's' } : null, broadcastSettings: { game: g } } }); }
  if (n === 'DropsHighlightService_AvailableDrops') {
    const login = v.channelID.replace('id-', '');
    const cs = mundo.semCampanhas.has(login) ? [] : mundo.campanhas.filter(c => !c.game && (!c.canais || c.canais.includes(login))).map(c => ({ id: c.id }));
    return ok({ channel: { id: v.channelID, viewerDropCampaigns: cs } });
  }
  if (n === 'DirectoryPage_Game') {
    assert.deepStrictEqual(v.options.systemFilters, ['DROPS_ENABLED']);
    return ok({ game: { streams: { edges: ['semdrops', 'grande', 'pequeno'].filter(l => mundo.noAr[l] === rust).map(l => ({ node: { broadcaster: { login: l } } })) } } });
  }
  if (n === 'ViewerDropsDashboard') return ok({ currentUser: { dropCampaigns: mundo.campanhas.map(c => ({ id: c.id, name: c.name, status: 'ACTIVE', game: c.game || rust })) } });
  if (n === 'DropCampaignDetails') {
    assert.strictEqual(v.channelLogin, '42');
    const c = mundo.campanhas.find(x => x.id === v.dropID);
    return ok({ user: { dropCampaign: { id: c.id, name: c.name, self: { isAccountConnected: true }, allow: c.canais ? { isEnabled: true, channels: c.canais.map(name => ({ id: 'i', name })) } : null,
      timeBasedDrops: c.drops.map(d => ({ id: d.id, name: d.name, requiredMinutesWatched: d.precisa, startAt: d.startAt, endAt: d.endAt,
        preconditionDrops: d.pre ? d.pre.map(id => ({ id })) : null, benefitEdges: [{ benefit: { id: 'b' + d.id, name: d.name } }] })) } } });
  }
  if (n === 'Inventory') return ok({ currentUser: { inventory: {
    dropCampaignsInProgress: mundo.campanhas.map(c => ({ id: c.id, timeBasedDrops: c.drops.map(d => ({ id: d.id, self: { currentMinutesWatched: mundo.min[d.id] || 0,
      isClaimed: mundo.resgatados.has(d.id), dropInstanceID: (mundo.min[d.id] || 0) >= d.precisa ? 'inst-' + d.id : null } })) })),
    gameEventDrops: [] } } });
  return { estado: 400, corpo: { errors: [{ message: n }] } };
};
const gql = criarGql(pedir);

// 2 minutos a ver um canal: a Twitch soma aos drops que esse canal da
function verDoisMinutos(canal) {
  if (!canal || mundo.noAr[canal] !== rust || mundo.semCampanhas.has(canal)) return;
  for (const c of mundo.campanhas) {
    if (c.game || (c.canais && !c.canais.includes(canal))) continue;
    for (const d of c.drops) {
      if (d.pre && d.pre.some(p => !mundo.resgatados.has(p))) continue;          // bloqueado ate resgatares o anterior
      if (d.endAt && Date.parse(d.endAt) < Date.now()) continue;                   // fora do horario
      mundo.min[d.id] = Math.min(d.precisa, (mundo.min[d.id] || 0) + 2);
    }
  }
}
async function correr({ resgatar = false, eventos = {} } = {}) {
  let url = 'https://www.twitch.tv/directory/category/rust', passos = 0, fim = null;
  const historia = [], avisos = [];
  for (; passos < 300; passos++) {
    if (eventos[passos]) eventos[passos]();
    const d = await decidir({ gql, utilizador: '42', urlAtual: url });
    if (d.aviso) avisos.push(d.aviso);
    if (resgatar) for (const x of d.prontos) mundo.resgatados.add(x.id);   // "tu" resgatas no inventario
    if (d.fim) { fim = d; break; }
    if (d.ir) url = d.ir;
    historia.push(canalDe(url));
    verDoisMinutos(canalDe(url));
  }
  return { fim, passos, historia, avisos };
}

assert.strictEqual(canalDe('https://www.twitch.tv/Grande'), 'grande');
assert.strictEqual(canalDe('https://www.twitch.tv/drops/inventory'), null);
console.log('ok   le o canal do endereco (e ignora paginas que nao sao canais)');

// 1. do inicio ao fim, sem resgatar nada
let r = await correr({ eventos: { 20: () => { mundo.noAr.toast = rust; }, 25: () => { mundo.noAr.grande = null; } } });
assert.ok(r.fim, 'chegou ao fim');
assert.strictEqual(mundo.resgatados.size, 0, 'a extensao nao resgata nada');
assert.deepStrictEqual([mundo.min.d1, mundo.min.d2, mundo.min.d3], [60, 120, 60], 'todos a 100%');
assert.strictEqual(mundo.min.f1, undefined, 'nao mexe no Fortnite');
assert.strictEqual(r.historia[0], 'grande', 'salta o canal ao vivo sem drops; comeca no de mais gente que da drops');
assert.ok(!r.historia.includes('semdrops'), 'nunca ve um canal sem drops ligados');
assert.strictEqual(r.historia[20], 'toast', 'o streamer entrou ao vivo: passa para ele');
assert.ok(r.historia.slice(20, 50).every(c => c === 'toast'), 'fica no streamer ate o drop dele estar a 100%');
assert.ok(r.passos <= 62, `acabou em ${r.passos * 2} min (o maior drop e de 120 min)`);
assert.strictEqual(r.fim.feitos, 3);
assert.deepStrictEqual(r.fim.prontos.map(x => x.nome).sort(), ['Auto Turret', 'Large Wood Box', 'SAR'], 'diz-te o que tens para resgatar');
console.log(`ok   do inicio ao fim sem resgatar: gerais, o streamer quando entra ao vivo, canal sem drops ignorado; todos a 100% em ${r.passos * 2} min`);

// 2. um drop que so comeca depois de resgatares o anterior
mundo = criarMundo();
mundo.campanhas = [{ id: 'geral', name: 'Rust Isles', canais: null, drops: [{ id: 'd1', name: 'Box', precisa: 10 }, { id: 'd2', name: 'Pants', precisa: 10, pre: ['d1'] }] }];
r = await correr({ eventos: { 30: () => mundo.resgatados.add('d1') } });
assert.ok(r.avisos.some(a => /resgata no inventario o drop anterior a "Pants"/.test(a)), 'avisa para resgatares o anterior');
assert.ok(r.fim && mundo.min.d2 === 10, 'depois de resgatares, continua ate ao fim');
console.log('ok   pre-requisito: avisa "resgata o anterior" e continua quando resgatas');

// 3. drop fora do horario (ja acabou) nao conta; campanha vazia nao faz nada
mundo = criarMundo();
mundo.campanhas = [{ id: 'geral', name: 'Rust Isles', canais: null, drops: [{ id: 'd1', name: 'Velho', precisa: 60, endAt: '2020-01-01T00:00:00Z' }, { id: 'd2', name: 'Novo', precisa: 4 }] }];
r = await correr();
assert.ok(r.fim && !mundo.min.d1 && mundo.min.d2 === 4, 'o drop que ja acabou nao prende a extensao');
assert.strictEqual(plano([]).fim, false);
console.log('ok   um drop fora do horario nao conta; sem campanhas nao faz nada');

// 4. minutos parados: ao fim de 8 min no mesmo canal sem subir, e para mudar
const d = { canal: 'grande', ir: null, campanhas: [{ drops: [{ minutos: 10, precisa: 60 }, { minutos: 60, precisa: 60 }] }] };
let a = acompanhar(null, d, 0);
a = acompanhar(a.prog, d, 4 * 60000); assert.strictEqual(a.parado, false);
a = acompanhar(a.prog, d, 8 * 60000); assert.strictEqual(a.parado, true, '8 min sem subir: muda');
const sobe = { ...d, campanhas: [{ drops: [{ minutos: 12, precisa: 60 }, { minutos: 60, precisa: 60 }] }] };
a = acompanhar(acompanhar(null, d, 0).prog, sobe, 8 * 60000); assert.strictEqual(a.parado, false, 'a subir: fica');
console.log('ok   minutos parados 8 min no mesmo canal: muda; a subir: fica (um drop a acabar nao conta como parado)');

// 5. auto-correcao: aceita uma config boa; rejeita lixo e mantem os codigos anteriores
const h64 = '0'.repeat(64);
const boa = { jogo: { slug: 'rust', nome: 'Rust' }, consultas: Object.fromEntries(Object.keys(CONSULTAS).map(k => [k, ['Op' + k, h64]])) };
assert.strictEqual(aplicarConfig(boa), true);
assert.strictEqual(CONSULTAS.inventario[1], h64, 'passou a usar o hash novo');
const antes = CONSULTAS.canal[1];
assert.strictEqual(aplicarConfig({ consultas: { canal: ['x', 'curto'] } }), false, 'hash invalido: rejeita');
assert.strictEqual(aplicarConfig({ consultas: { canal: ['Op', h64] } }), false, 'faltam consultas: rejeita');
assert.strictEqual(aplicarConfig(null), false);
assert.strictEqual(CONSULTAS.canal[1], antes, 'depois de rejeitar, ficam os codigos que ja tinha');
console.log('ok   auto-correcao: aceita uma config completa e valida; rejeita lixo e mantem os codigos de reserva');

// 6. resgatar: a consulta da Twitch; o que falhar volta (para carregar no botao do inventario)
{
  const vistos = [];
  const g = criarGql(async c => {
    vistos.push(c.variables.input.dropInstanceID);
    const est = { i1: 'ELIGIBLE_FOR_ALL', i2: 'DROP_INSTANCE_ALREADY_CLAIMED', i3: 'NOT_ELIGIBLE' }[c.variables.input.dropInstanceID];
    return { estado: 200, corpo: { data: { claimDropRewards: { status: est } } } };
  });
  const pausas = [];
  const r = await resgatar(g, [{ nome: 'A', instancia: 'i1' }, { nome: 'B', instancia: 'i2' }, { nome: 'C', instancia: 'i3' }, { nome: 'D', instancia: null }], async ms => pausas.push(ms));
  assert.deepStrictEqual(pausas, [5000, 5000, 5000], 'um de cada vez, 5 s entre cada');
  assert.deepStrictEqual(r.ok.map(x => x.nome), ['A', 'B']);
  assert.deepStrictEqual(r.falharam.map(x => x.nome), ['C', 'D']);
  assert.deepStrictEqual(vistos, ['i1', 'i2', 'i3'], 'sem instancia nao pede');
  console.log('ok   resgatar: aceita ELIGIBLE_FOR_ALL e ALREADY_CLAIMED; o resto fica para o botao do inventario');
}

// 7. nao resgatar no primeiro segundo: so depois de estar pronto ha 30 s
{
  const d = [{ id: 'x', nome: 'X' }];
  let p = prontosParaResgatar(d, {}, 0);
  assert.strictEqual(p.agora.length, 0, 'acabou de ficar pronto: espera');
  assert.strictEqual(p.proximo, 30000, 'marca o despertador para daqui a 30 s');
  p = prontosParaResgatar(d, p.vistos, 20000);
  assert.strictEqual(p.agora.length, 0, '20 s: ainda espera');
  p = prontosParaResgatar(d, p.vistos, 30000);
  assert.deepStrictEqual(p.agora.map(x => x.id), ['x'], '30 s: resgata');
  assert.strictEqual(p.proximo, null);
  assert.deepStrictEqual(prontosParaResgatar([], p.vistos, 40000).vistos, {}, 'o que ja foi resgatado sai da memoria');
  assert.strictEqual(RESGATE.esperaSeg, 30);
  console.log('ok   espera: so resgata quando o drop esta pronto ha 30 s (com despertador); um de cada vez com 5 s entre cada');
}
