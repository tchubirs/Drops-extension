# DropGo

Seus drops da Twitch no piloto automático. Clique no ícone, depois em **Ligar**:
o DropGo escolhe uma live que dá o drop (primeiro os exclusivos de um canal), deixa
a live numa aba sem som e na menor qualidade, mostra o progresso de cada item e
resgata quando chega a 100%. Funciona com Rust e com outros jogos que você escolher.

## O que aparece

- **Janelinha (clique no ícone):** a miniatura de cada skin, a %, o tempo que falta,
  o total e o botão Ligar/Pausar. Também: escolha de jogos e avisos no Discord (webhook).
- **Botão direito no ícone:** "Como funciona e privacidade" e "Ver histórico"
  (o que a extensão fez, guardado só no seu Chrome).
- **Idioma:** português, espanhol ou inglês, pela língua do Chrome.
- Sem drops ativos nos jogos escolhidos, ela confere de hora em hora em vez de a cada 2 minutos.

## Instalar (uma vez)

1. **Code → Download ZIP** (nesta página) e descompacte numa pasta fixa.
2. No Chrome, abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. **Carregar sem compactação** → escolha essa pasta.
4. Fixe o ícone (peça de quebra-cabeça → alfinete).

## Atualizar

Baixe o ZIP de novo, substitua os arquivos na mesma pasta e clique em **↻** no DropGo
em `chrome://extensions`. O `config.json` (códigos das consultas da Twitch e o espaço
patrocinado) atualiza sozinho a cada 6 horas; ele só pode trocar os códigos das 7
consultas conhecidas e nunca contém código.

## Arquivos

- `manifest.json`, `fundo.js`, `logica.js`, `cabecalhos-twitch.js`, `textos.js`,
  `painel.html/js`, `registo.html/js`, `_locales/`, `icone.png`: a extensão.
- `config.json`: códigos das consultas da Twitch, tempos do resgate e espaço patrocinado.
- `loja/`: material da versão 3.10 para a Chrome Web Store (histórico; a 3.10 tem a tag `v3.10`).

As consultas à Twitch e as regras de "este drop conta agora" vêm do TwitchDropsMiner
(DevilXD, licença MIT), reescritas em JavaScript para rodar no Chrome.

Página e privacidade: https://tchubirs.github.io/drops/ · Projeto independente, não afiliado à Twitch.
