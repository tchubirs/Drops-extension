const lista = document.getElementById('lista');
document.title = `${NOME}: ${T.registoTit}`;
document.getElementById('tit').textContent = T.registoTit;
document.getElementById('desc').textContent = T.registoDesc;
document.getElementById('limpar').textContent = T.limpar;
async function mostrar() {
  const { registo = [] } = await chrome.storage.local.get('registo');
  lista.replaceChildren(...registo.slice().reverse().map(r => {
    const li = document.createElement('li'), t = document.createElement('time');
    t.textContent = new Date(r.t).toLocaleString();
    li.append(t, r.texto);
    return li;
  }));
  if (!registo.length) lista.textContent = T.semEntradas;
}
document.getElementById('limpar').onclick = async () => { await chrome.storage.local.set({ registo: [] }); mostrar(); };
mostrar();
