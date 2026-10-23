const $ = s => document.querySelector(s);
const el = (tag, cls, texto) => { const e = document.createElement(tag); if (cls) e.className = cls; if (texto != null) e.textContent = texto; return e; };

function status(ligado, e) {
  const box = $('#status');
  box.replaceChildren();
  let txt = '';
  if (!ligado) txt = e.fim ? `🎉 ${T.fim}` : T.pausado;
  else if (e.erro === 'login') txt = T.login;
  else if (e.erro) txt = T.reconectando;
  else if (e.comecando || !e.quando) txt = T.comecando;
  else if (e.parado) txt = `↻ ${T.trocando}`;
  else if (!e.canal) txt = `⏳ ${T.procurando}`;
  if (txt) return box.append(el('span', null, txt));
  box.append(el('span', null, `▶ ${T.assistindo} `), el('b', null, e.canal));
  if ((e.resgatados || []).length) box.append(el('div', null, `🎁 ${T.resgatado}: ${e.resgatados.join(', ')}`));
}

function lista(e) {
  const box = $('#lista');
  box.replaceChildren();
  for (const c of e.campanhas || []) {
    box.append(el('div', 'camp', c.nome));
    for (const d of c.drops) {
      const item = el('div', 'item');
      const mini = el('img', 'mini');
      if (d.imagem) mini.src = d.imagem;
      mini.alt = '';
      const valor = d.resgatado ? '✓' : d.pronto ? '🎁' : d.falta ? `${d.pct}% · ${tempo(d.falta)}` : `${d.pct}%`;
      const l1 = el('div', 'linha1');
      l1.append(el('span', 'nome', d.nome), el('span', 'pct' + (d.resgatado ? ' ok' : ''), valor));
      const barra = el('div', 'barra'), i = el('i', d.resgatado ? 'ok' : '');
      i.style.width = `${d.pct}%`;
      barra.append(i);
      item.append(mini, l1, barra);
      box.append(item);
    }
  }
}

// os jogos com drops agora: clica para ligar/desligar cada um
function jogos(e, escolhidos) {
  const box = $('#jogos');
  box.replaceChildren();
  const ligado = j => (escolhidos ? escolhidos.includes(j.slug) : j.ativo);
  const lista = (e.jogos || []).slice().sort((a, b) => ligado(b) - ligado(a));
  $('#secJogos').hidden = !lista.length;
  const nomes = lista.filter(ligado).map(j => j.nome);
  $('#jogosTit').textContent = `🎮 ${T.jogos}: ${nomes.slice(0, 2).join(', ') || '—'}${nomes.length > 2 ? ` +${nomes.length - 2}` : ''}`;
  for (const j of lista) {
    const on = ligado(j);
    const b = el('button', 'chip' + (on ? ' on' : ''), j.nome);
    b.onclick = async () => {
      const atuais = escolhidos || lista.filter(x => x.ativo).map(x => x.slug);
      const novos = on ? atuais.filter(s => s !== j.slug) : [...atuais, j.slug];
      await chrome.storage.local.set({ jogos: novos });
      chrome.runtime.sendMessage({ tipo: 'agora' }).catch(() => {});
    };
    box.append(b);
  }
}

// espaco de patrocinio: vem da configuracao publicada (so texto, imagem e link https)
function anuncio(cfg) {
  const a = cfg && cfg.anuncio;
  const ok = a && typeof a.texto === 'string' && /^https:\/\//.test(a.link || '');
  $('#anuncio').hidden = !ok;
  if (!ok) return;
  $('#anuncio').href = a.link;
  $('#anuncioTxt').textContent = a.texto;
  $('#patroc').textContent = T.patrocinado;
  const img = $('#anuncioImg');
  img.hidden = !/^https:\/\//.test(a.imagem || '');
  if (!img.hidden) img.src = a.imagem;
}

async function render() {
  const { ligado, estado = {}, jogos: escolhidos, config } = await chrome.storage.local.get(['ligado', 'estado', 'jogos', 'config']);
  $('#discTit').textContent = `🔔 ${T.discord}`;
  $('#webhook').placeholder = T.discordDica;
  $('#discPassos').textContent = T.discordPassos;
  jogos(estado, Array.isArray(escolhidos) ? escolhidos : null);
  anuncio(config);
  $('#nome').textContent = NOME;
  const b = $('#botao');
  b.textContent = ligado ? T.pausar : T.ligar;
  b.classList.toggle('ligar', !ligado);
  $('#conta').textContent = estado.total
    ? `· ${estado.feitos} ${T.de} ${estado.total} ✓${estado.faltaTotal ? ` · ⏱ ${tempo(estado.faltaTotal)}` : ''}` : '';
  status(!!ligado, estado);
  lista(estado);
  $('#steamTxt').textContent = T.steam;
  $('#steam').hidden = !(estado.semLigacao || []).length;
}

$('#botao').onclick = async () => {
  $('#botao').disabled = true;
  try { await chrome.runtime.sendMessage({ tipo: 'alternar' }); } finally { $('#botao').disabled = false; render(); }
};
chrome.storage.local.get('webhook').then(({ webhook }) => { $('#webhook').value = webhook || ''; if (webhook) $('#disc').open = false; });
$('#webhook').onchange = async () => {
  await chrome.storage.local.set({ webhook: $('#webhook').value.trim() });
  const s = $('#salvo'); s.textContent = `✓ ${T.salvo}`; s.hidden = false; setTimeout(() => { s.hidden = true; }, 1500);
};
chrome.storage.local.get('avisoPc').then(({ avisoPc }) => { $('#avisoPc').checked = avisoPc !== false; });
$('#avisoPcTxt').textContent = T.avisoPc;
chrome.storage.local.get('aceitar18').then(({ aceitar18 }) => { $('#aceitar18').checked = aceitar18 !== false; });
$('#aceitar18Txt').textContent = T.aceitar18;
$('#aceitar18').onchange = () => chrome.storage.local.set({ aceitar18: $('#aceitar18').checked });
$('#avisoPc').onchange = () => chrome.storage.local.set({ avisoPc: $('#avisoPc').checked });
chrome.storage.onChanged.addListener(render);
render();
