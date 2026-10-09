# Drops Auto-Claim

Extensão do Chrome para os drops da Twitch (Rust). Tu clicas no ícone; ela faz o resto:
vê o canal certo, resgata os drops a 100% e passa ao próximo até estarem todos.

## Registo e repouso

- Botão direito no ícone → **Ver registo**: lista o que a extensão fez (canal, resgates, erros).
- Sem campanha do Rust ativa, ela verifica de hora a hora em vez de 2 em 2 minutos.
- O `config.json` só pode trocar os códigos (hashes) das 7 consultas conhecidas.

## Instalar (uma vez)

1. Carrega em **Code → Download ZIP** (nesta página) e descomprime numa pasta fixa,
   por exemplo `Documentos\drops-extensao`.
2. No Chrome, abre `chrome://extensions` e liga **Modo de programador**.
3. **Carregar sem compactação** → escolhe essa pasta.
4. Fixa o ícone (peça de puzzle → pionés) e clica nele.

## Atualizar (sem reinstalar, sem perder nada)

1. Descarrega o ZIP outra vez e **substitui** os ficheiros na mesma pasta.
2. Em `chrome://extensions`, carrega no **↻** da "Drops Auto-Claim".

Os códigos da Twitch e os tempos do resgate (`config.json`) atualizam-se sozinhos a
cada 6 horas; só código novo precisa destes 2 passos.

## Ficheiros

- `manifest.json`, `fundo.js`, `logica.js`, `cabecalhos-twitch.js`, `registo.html`, `registo.js`, `icone.png` — a extensão.
- `config.json` — códigos das consultas da Twitch e tempos (a extensão lê-o daqui).
- `logica.test.mjs` — testes (`node logica.test.mjs`).

As consultas à Twitch e as regras de "este drop conta agora" vêm do TwitchDropsMiner
(DevilXD, licença MIT), reescritas em JavaScript para correrem no Chrome.
- `loja/` — tudo para a Chrome Web Store: o pacote `drops-extensao-3.10.zip`, as imagens e
  os textos a colar (`loja/LEIA-ME.md`). Página e privacidade: https://tchubirs.github.io/drops/
