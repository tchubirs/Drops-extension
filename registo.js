const lista = document.getElementById('lista');
async function mostrar() {
  const { registo = [] } = await chrome.storage.local.get('registo');
  lista.replaceChildren(...registo.slice().reverse().map(r => {
    const li = document.createElement('li'), t = document.createElement('time');
    t.textContent = new Date(r.t).toLocaleString('pt-PT');
    li.append(t, r.texto);
    return li;
  }));
  if (!registo.length) lista.textContent = 'Ainda sem entradas.';
}
document.getElementById('limpar').onclick = async () => { await chrome.storage.local.set({ registo: [] }); mostrar(); };
mostrar();
