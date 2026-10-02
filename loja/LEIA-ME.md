# Pôr a extensão na Chrome Web Store

Tudo o que a loja pede já está pronto. Tu só fazes os passos que exigem a tua conta.

## Os teus passos (cerca de 15 min, uma vez)

1. Abre https://chrome.google.com/webstore/devconsole e entra com a tua conta Google.
2. Paga a taxa única de registo de programador (o valor aparece no ecrã) e aceita o acordo.
3. **New item** → carrega `drops-extensao-3.8.zip` (do repositório
   https://github.com/tchubirs/Drops-extension, pasta `loja/`).
4. Preenche cada separador com os textos abaixo (copiar e colar).
5. **Submit for review**. A Google revê e aprova ou recusa por e-mail. O prazo é decidido por eles.

## Separador "Store listing"

- **Nome:** Drops Auto-Claim (vem do manifest)
- **Categoria:** Entertainment
- **Idioma:** Portuguese (Brazil)
- **Descrição curta** (vem do manifest): Drops do Rust na Twitch sem esforco: ve o canal certo, resgata cada drop a 100% e passa ao proximo ate ter todos.
- **Descrição:**

```
Ganha os drops do Rust na Twitch sem ficar a mudar de canal.

Clica no ícone uma vez e a extensão:
• abre o teu inventário de drops e uma stream de Rust com a campanha;
• dá prioridade aos drops de streamers específicos (os gerais contam ao mesmo tempo);
• muda de canal sozinha se o streamer sair do ar ou o progresso parar;
• resgata cada drop quando chega a 100% e avisa-te com uma notificação;
• pára quando tens todos.

O ícone mostra quantos drops já tens (ex.: 3/6). Passa o rato por cima para ver cada um.

No fim, liga a Twitch à Steam em twitch.facepunch.com para os itens chegarem ao jogo.

Privacidade: usa a tua sessão da Twitch neste Chrome, não vê nem guarda a tua password, só fala com a Twitch. Sem anúncios, sem rastreio.

Código aberto: github.com/tchubirs/Drops-extension
Não é uma extensão oficial da Twitch nem da Facepunch.
```

- **Ícone da loja (128×128):** `icone.png`
- **Captura de ecrã (1280×800):** `loja/captura.png`
- **Mosaico pequeno (440×280):** `loja/mosaico.png`
- **Site oficial:** https://tchubirs.github.io/drops/
- **Suporte:** https://github.com/tchubirs/Drops-extension/issues

## Separador "Privacy"

- **Single purpose (finalidade única):**
  Ganhar e resgatar automaticamente os drops do Rust na Twitch do próprio utilizador: escolhe a stream que dá progresso, acompanha o progresso e resgata cada drop terminado.

- **Justificação de cada permissão:**
  - `tabs`: abrir e reutilizar os dois separadores da extensão (inventário de drops e stream) e mudar a stream de canal.
  - `alarms`: verificar o progresso de 2 em 2 minutos e resgatar um drop 30 segundos depois de chegar a 100%.
  - `storage`: guardar no navegador se a extensão está ligada, o progresso e os canais a evitar.
  - `cookies`: ler o cookie de login de twitch.tv do próprio utilizador para pedir à Twitch o progresso dos drops e resgatá-los em nome dele.
  - `scripting`: ler o progresso e o código de verificação que a própria página do inventário da Twitch gera, carregar no play se o vídeo parar e aceitar o aviso de conteúdo para maiores.
  - `notifications`: avisar quando um drop é resgatado e quando estão todos.
  - `contextMenus`: menu do ícone com "Como funciona e privacidade".
  - Acesso a `twitch.tv`, `gql.twitch.tv` e `id.twitch.tv`: são os sites dos drops, da API que dá o progresso e da sessão do utilizador.
  - Acesso a `raw.githubusercontent.com`: descarregar a cada 6 horas o ficheiro público `config.json` (só dados: os códigos das consultas da Twitch), para continuar a funcionar quando a Twitch os muda.

- **Remote code (código remoto):** **No, I am not using remote code.** O `config.json` só tem dados (nomes e hashes de consultas, tempos de espera); nenhum código é descarregado nem executado.

- **Data usage (uso de dados):** marca só **Authentication information** (o cookie de sessão da Twitch, usado só para falar com a Twitch). Marca as três certificações:
  - não vendo nem transfiro dados a terceiros;
  - não uso nem transfiro dados para fins sem relação com a finalidade única;
  - não uso nem transfiro dados para avaliar crédito ou conceder empréstimos.

- **Privacy policy URL:** https://tchubirs.github.io/drops/privacidade.html

## Separador "Distribution"

- **Visibility:** Public
- **Regiões:** todas

## Riscos a saber

- **O teu nome já não aparece na extensão, mas a ligação a ti continua visível.** O código
  está em `github.com/tchubirs/...`, a página em `tchubirs.github.io` e a loja mostra o nome
  e o e-mail da conta de programador. Quem procurar chega a ti. Como és parceiro da
  Facepunch, decide antes de publicar: usar contas separadas (GitHub e Google) para a
  extensão, ou não publicar e usá-la só tu.

- Ver streams de forma automática pode ir contra as regras da Twitch. A Google também pode
  recusar a extensão por isso; se recusar, o e-mail diz a razão.
- Quando a Twitch muda as consultas, corrige-se o `config.json` (sem nova versão na loja).
  Uma mudança de código obriga a enviar uma versão nova para revisão.
