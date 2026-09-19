# Histórico de alterações — Cyberduel

Novidades, correções e verificações realizadas no projeto. As entregas mais recentes aparecem primeiro.

## 2026-09-19

### Matchmaking por rank, apresentação e leaderboard

- Habilitada a opção “Partida aleatória” com fila autenticada, cancelamento e sorteio de adversários por proximidade de pontuação: faixa inicial de 200 pontos, ampliada em 100 a cada 15 segundos. Contas duplicadas, partidas ativas e decks inválidos são bloqueados; desconexão remove o jogador da fila.
- Partidas da fila são criadas no servidor com os decks salvos e mostram uma apresentação de quatro segundos com foto (ou iniciais), apelido e rank dos dois jogadores, separados por VS. O duelo começa automaticamente e o primeiro prazo reserva o tempo da apresentação. Salas casuais também exibem os perfis antes da transição.
- Adicionados pontos Elo (início em 1.000, fator 32), faixas Bronze/Prata/Ouro/Diamante e estatísticas persistentes de partidas, vitórias e derrotas. Apenas partidas da fila alteram o rank; combate concluído, desistência e recusa de retorno são contabilizados uma única vez. Placar e encerramento não são aceitos do cliente, e atalhos de resultado ficam desativados nas ranqueadas.
- Leaderboard simples em “Ranking de duelistas”, com os 20 primeiros por pontos, apelido, rank e vitórias/derrotas; incluídos estados de carregamento, lista vazia e erro. Identificação continua por conta e tokens, independentemente dos apelidos.
- `npm test` aprovado: sintaxe de 23 arquivos e 27 testes funcionais. Novos testes cobrem faixa/sorteio, fila, sessão, duplicação, cancelamento, apresentação, recusa, encerramento por combate, aplicação única dos pontos e persistência após reiniciar o servidor. Documentadas regras e limites no README.
- Validado no Chromium com duas contas, em desktop e celular: busca/cancelamento, apresentação com foto e apelidos, rank, entrada automática, desistência e leaderboard real. Sem erros JavaScript. Falhas por timeout da busca/cancelamento também cobertas nos testes do cliente; `git diff --check` sem erros.
- Filas e partidas em andamento continuam em memória; pontos e estatísticas persistem no arquivo de contas. A sincronização das ações de combate mantém o modelo existente do projeto, com estado de campo enviado pelos clientes.


### Revalidação do retorno e da identificação

- Reexecutados `node test/resume-match.test.js` e `node test/multiplayer.test.js`, ambos aprovados: escolhas do modal, derrota por recusa, bloqueio de retorno e apelidos separados da identificação. Implementação existente preservada; conferência visual no navegador continua pendente.

### Retorno à partida e apelidos na exibição

- Retorno à partida apresentado em modal central com opções “SIM” e “NÃO” e aviso de derrota definitiva ao recusar. As opções ficam bloqueadas durante o envio; falhas exibem mensagem e permitem tentar novamente.
- Recusar o retorno encerra a partida no servidor por desistência, concede a vitória ao adversário, preserva o placar das rodadas e invalida o retorno por token ou conta. O cliente limpa o token de retorno após a confirmação.
- A partida exibe os apelidos dos jogadores, incluindo retomada e espectadores. Apelidos ficam em campos próprios, apenas para apresentação; username e tokens continuam identificando as contas, mesmo com apelidos iguais.
- `npm test` aprovado: sintaxe de 22 arquivos e 25 testes funcionais. `git diff --check` sem erros. Testes de regressão cobrem escolhas do modal, falhas, limpeza do token, apelidos iguais com identidades distintas, derrota por recusa e bloqueio de retorno. Validação visual em navegador não realizada nesta alteração.

## 2026-09-18

### Ordem dos boosters e edição do perfil

- Revelação de boosters agora apresenta personagens em ordem crescente de nível, incluindo lendárias, seguidos pelo grupo de terrenos e depois pelo grupo de efeitos. Cartas de utilidade mostram “TERRENO” ou “EFEITO” em vez de um rótulo genérico.
- Botão PERFIL abre uma tela com apelido editável, usuário de login somente para leitura, prévia da foto, seleção de imagem, remoção e salvamento. Apelidos podem se repetir; o usuário único permanece inalterado.
- Apelido e foto persistidos na conta. Contas antigas recebem o usuário como apelido inicial e avatar vazio, sem alteração de saldo, coleção ou inventário. Menu exibe a foto e o apelido após fechar o perfil.
- Fotos JPG, PNG e WebP de até 5 MB são recortadas centralmente e convertidas em JPEG de 192×192 antes do envio; API autenticada valida apelido e formato/tamanho do avatar. Logout limpa os dados de perfil no cliente.
- `npm test` aprovado: sintaxe de 22 arquivos e 24 testes funcionais. Cobertas ordem de revelação, rótulos distintos, autenticação, apelido independente, usuário imutável, validação, remoção da foto, persistência após reinício e compatibilidade com contas antigas.
- Validado no Chromium em viewport móvel: acesso pelo menu, upload de PNG convertido, salvamento, avatar no menu, recarga mantendo apelido/foto, rejeição de arquivo inválido e remoção. Sem erros JavaScript; `git diff --check` sem erros.

### Garantia lendária aplicada à abertura do inventário

- Validado no Chromium com backend isolado: comprar sem garantia, recarregar, executar o comando e abrir o pacote guardado revelou uma lendária com cut-in; fluxo sem erros JavaScript.

- Corrigido `garantelendaria()`: a garantia agora acompanha a próxima abertura, incluindo pacotes antigos guardados, em vez da próxima compra. Comprar não consome a garantia; falhas permitem repetir a abertura.
- Servidor de teste substitui uma carta apenas quando o pacote fechado ainda não contém lendária. Preservados cinco itens, coleção sem duplicação, retorno idempotente e ausência de nova cobrança. Fora do modo de teste, a abertura forçada é recusada sem consumir o pacote.
- Atualizados mensagem do console, instruções e versões dos scripts. Testes `legendary-debug`, `booster-inventory` e `booster-ui` aprovados, incluindo pacote comprado sem garantia, compra entre comando e abertura, proteção fora de debug, uso único e repetição da abertura. Sintaxe do servidor e `git diff --check` aprovados.

### Inventário persistente e abertura de boosters em tela inteira

- Compra agora desconta o saldo e guarda um pacote fechado no inventário da conta. As cartas são definidas e persistidas no servidor na compra, permanecem ocultas no inventário e entram na coleção somente ao abrir.
- Adicionado inventário por facção, acessível pela loja e por “Suas cartas → Abrir boosters”. “ABRIR BOOSTER” abre uma tela que ocupa todo o viewport, com lacre arrastável, alternativa por botão, revelação individual e retorno ao inventário. A loja continua dedicada à compra.
- Mantidos ordem de raridade, dica discreta na primeira carta, cut-in lendário e `garantelendaria()` aplicado ao próximo pacote comprado. Corrigido o arraste nativo de imagens que interferia no gesto de passar cartas com mouse.
- Compra identificada evita cobrança duplicada ao repetir a mesma requisição; abertura repetida retorna as mesmas cartas sem concedê-las novamente. Pacotes permanecem após recarga e reinicialização do backend; abrir um pacote já pago não exige saldo.
- Contas antigas recebem inventário vazio sem alterar coleção ou saldo. Mantido o endpoint anterior para clientes antigos; documentada publicação do backend antes do frontend. Nenhuma migração destrutiva dos dados existentes.
- `npm test` aprovado: 22 arquivos com sintaxe válida e 23 testes funcionais. Cobertos persistência, conta antiga, isolamento entre usuários, requisições concorrentes, cobrança única, abertura única e garantia lendária.
- Fluxo completo validado no Chromium com backend isolado: compra, recarga, inventário, abertura ocupando 1100×820, cinco cartas por gesto, lendária e retorno; validado também viewport 390×844 com risco e passagem de carta por toque emulado, sem erros JavaScript. `git diff --check` sem erros.

### Recarga ainda ativa na instância do Live Server

- Usuário confirmou acesso pela porta 5500. Reproduzida novamente mensagem WebSocket `reload` nessa instância ao criar arquivo temporário em `server/data`, apesar da configuração de exclusão presente no workspace.
- Conferido que a porta 3000 entrega o HTML sem o script de recarga do Live Server. Atualizado README para priorizar acesso direto a `http://127.0.0.1:3000/`, incluindo inicialização de debug com `.env`.
- Não reiniciada a extensão do VS Code nesta sessão; a instância existente da porta 5500 continua exigindo reinício para aplicar a configuração. Nenhuma conta foi modificada pela verificação.

### Atalho `garantelendaria()` para testar boosters

- Adicionado comando de console `garantelendaria()`, que arma a garantia para a próxima compra bem-sucedida da conta conectada. Falhas preservam a garantia para nova tentativa.
- Servidor aceita a garantia apenas com `CYBERDUEL_DEBUG=1` (`npm run dev`); substitui uma das cinco cartas por uma lendária da facção, ignorando o mínimo de partidas e o peso de lendárias somente nessa compra. Mantidos preço e persistência da coleção.
- Facção sem lendárias ou servidor fora do modo de teste recusa a garantia sem cobrar. Documentados uso e inicialização com `.env`; atualizadas versões dos scripts no HTML.
- Testes `legendary-debug`, `booster-ui` e `debug-shortcuts` aprovados, incluindo uso único, falha, recusa fora de debug, lendária com zero partidas e peso zero, cinco cartas, saldo e retorno ao sorteio normal. Sintaxe do servidor e `git diff --check` aprovados.

### Orientação para dependência ausente no backend local

- Conferido que `socket.io` está declarado nas dependências do projeto. Para o erro `MODULE_NOT_FOUND` relatado na máquina de Marcos, orientada a instalação com `npm ci` na raiz antes de iniciar o backend com `--env-file=.env`.
- Instalação e execução na máquina remota não verificadas nesta sessão.

### Dica discreta na primeira carta e configuração do ambiente

- Adicionada indicação pequena e estática “↑ arraste para cima” sobre a primeira carta revelada, sem bloquear gestos. A dica sai junto com essa carta.
- Documentado que `.env` deve ficar na raiz e que o backend local precisa ser iniciado com `node --env-file=.env server/server.js`; `npm start` não carrega o arquivo automaticamente.
- Corrigido no Docker Compose o nome da variável `BOOSTER_LEGENDARY_MIN_GAMES`, antes enviado com um prefixo incorreto. Documentado que `CYBERDUEL_PORT` não é usado pelo Compose atual.
- Validados o teste de boosters, a sintaxe de `title-ui.js`, `git diff --check` e o carregamento do valor 3 do exemplo pelo Node com `--env-file`. Não reiniciado o backend em execução.

### Correção do refresh durante a compra de boosters

- Identificada recarga automática do Live Server ao persistir saldo e coleção em `server/data`: uma gravação temporária nessa pasta reproduziu a mensagem WebSocket `reload` na instância local da porta 5500.
- Adicionada configuração de workspace em `.vscode/settings.json` para ignorar `server/data/**`, preservando as exclusões padrão do Live Server. Documentada no README a necessidade de parar e iniciar uma instância já aberta para carregar a configuração.
- Validado com o módulo instalado do Live Server, em diretório temporário: gravação e renomeação atômica de contas não geram recarga; mudanças no HTML continuam gerando recarga. Dados reais das contas preservados.
- Validada no Chromium a abertura pelo gesto e a passagem pelas cinco cartas até o cut-in lendário, com resposta de compra simulada e animações reais. Testes `booster-ui` e `server-url` aprovados; `git diff --check` sem erros. A instância do Live Server já aberta ainda precisa ser reiniciada para aplicar a exclusão.

### Abertura de boosters por gesto e revelação por raridade

- Adicionado lacre que abre ao riscar horizontalmente com mouse ou toque, mantendo botão e teclado como alternativas. Compra bloqueada durante a abertura.
- Cartas aparecem empilhadas com o verso à frente; a primeira vira automaticamente. Deslizar para cima, rolar para cima ou usar o botão revela a próxima, com saída da anterior.
- Ordenação crescente: utilidade, baixa, média, alta e lendária, preservando cartas repetidas e uma única compra por pacote.
- Lendárias recebem cut-in dourado antes da revelação. Artes específicas podem ser registradas em `window.CYBERDUEL_LEGENDARY_CUTINS`, por nome da carta; esses assets ainda não foram fornecidos.
- Incluídos bloqueios de avanço durante animações, anúncio da carta atual, suporte a movimento reduzido e atualização das versões de CSS e JavaScript no HTML.
- Validações: `npm test` aprovado (22 arquivos com sintaxe válida e 20 testes existentes); novo `node test/booster-ui.test.js` aprovado, cobrindo ordem, duplicatas, revelação, lendária, compra única, reinício e falha de compra. `git diff --check` sem erros. Aparência e gestos ainda não foram validados em navegador real.

## 2026-09-16

### Apenas uma carta levantada na mão

- Corrigida a restauração do gesto, que reaplicava a posição elevada da carta anteriormente selecionada ao soltar o toque em outra carta.
- Selecionar ou começar a arrastar uma carta restaura imediatamente posição, escala, ângulo e profundidade das demais cartas da mão, antes de levantar a nova. Eliminada a sobreposição de animações de seleção.
- Acrescentadas regressões para a posição antiga guardada pelo gesto e para troca com animação pendente. `npm test`: 22 arquivos com sintaxe válida e 20 testes aprovados. Alternância repetida entre duas cartas validada no Chromium com mouse e toque emulado, sempre com somente a selecionada levantada. `git diff --check` sem erros.

### Seleção da mão por clique ou toque

- Primeiro clique/toque seleciona e levanta a carta da mão; segundo clique na mesma carta abre os detalhes. Selecionar outra carta abaixa a anterior, e sair com o ponteiro mantém a seleção.
- Clicar em um espaço do campo joga a carta selecionada usando as validações e animações existentes, respeitando turno, fase, ocupação e seletores de efeitos.
- Removida a abertura automática de detalhes ao passar o mouse pela mão. A seleção também impede o hover do campo de abrir um modal durante a escolha do destino.
- Preservado o arraste, sem abrir detalhes ao soltá-lo; o gesto de restauração da mão não abaixa a carta selecionada. Atualizada a versão do script no HTML.
- `npm test` aprovado: sintaxe de 22 arquivos e 20 testes funcionais, incluindo seleção, troca de carta, segundo clique e bloqueios de jogada. Fluxo de selecionar, abrir detalhes e jogar no campo validado no Chromium com mouse e toque emulado; arraste também conferido. `git diff --check` sem erros.

### Invocações consecutivas do oponente

- Cartas de invocações pendentes ficam ocultas no campo desde a entrada na fila. Cada carta aparece somente no impacto da própria animação, evitando a antecipação da segunda invocação.
- Redesenhos e substituições de estado preservam a ocultação; cartas pendentes não executam a animação genérica de entrada. Encerrar a camada restaura também as cartas que aguardavam na fila. Atualizadas as versões dos scripts no HTML.
- Acrescentadas regressões para duas invocações recebidas juntas ou em atualizações separadas, substituição de instâncias e encerramento da camada. `npm test` aprovado: sintaxe de 22 arquivos e 19 testes funcionais.
- Validada no Chromium uma jogada do bot com duas invocações: ambas inicialmente ocultas, revelação individual e redesenho imediato durante a fila. Não realizada nova partida online no navegador nesta correção.


### Botão de retorno mais próximo do centro

- Subido o botão “VOLTAR AO MENU” da tela final para junto do resultado. A posição reserva espaço quando há carta de destaque e fica mais central quando não há carta.
- O aviso de retorno automático acompanha o botão. Atualizada a versão do script no HTML.
- Validados a sintaxe de `jogo.js` e `git diff --check`, sem erros. Não realizada nova conferência visual no navegador para este ajuste.


### Revisão dos problemas de habilidades, espectador e tela móvel

- Aura verde passa a atualizar a visibilidade no próprio objeto, sem animação de pulso ou dependência de redesenho: aparece somente na fase de habilidades, na vez do jogador, para cartas com habilidade disponível e alvos válidos. Permanece oculta durante colocação, após uso e para espectadores.
- Corrigida a mão do anfitrião no modo espectador: os dois leques usam `fundoCarta`, sem nomes, estatísticas ou arraste. Cartas ocultas do anfitrião no campo também não abrem detalhes; o campo identifica o nome do jogador em vez de “VOCÊ”.
- Ampliadas as cartas de efeito apresentadas no centro da mesa, tanto na conjuração local quanto na apresentação remota, preservando o desaparecimento após o efeito e a ausência do painel superior.
- Criado um contêiner compartilhado para o canvas e os menus, dimensionado pela área visível do navegador. Barras móveis, teclado e rotação atualizam tamanho e posição; o Phaser recebe as novas dimensões antes de recalcular a escala, evitando o uso do tamanho anterior e o corte da imagem. Mantida a resolução configurada de 720 × 1480.
- Confirmadas as correções já existentes: Extintor bloqueia bônus durante a colocação seguinte e só expira após a pontuação dessa rodada; Dieh’go acumula caveiras por toque, sem diminuir a seleção e respeitando PA/reserva; Neoanalista usa vídeo WebM com alfa e escala uniforme. Versionado o endereço do vídeo transparente e atualizados os scripts/CSS no HTML para invalidar cache.

### Validações da revisão

- `npm test` aprovado: sintaxe de 22 arquivos e 19 testes funcionais. Acrescentadas regressões para aura entre fases, mãos do espectador e viewport com barras, teclado, deslocamento, rotação e fallback sem VisualViewport. Regressões do Extintor, distribuição de dano, animações e sincronização aprovadas.
- Conferidos no Chromium três navegadores em uma sala: mãos com verso normal nos dois lados e bloqueio da consulta de carta oculta do anfitrião. Conferidos seis danos cumulativos por cliques no seletor do Dieh’go, limite por PA e mudança de aura sem redesenhar o tabuleiro.
- Decodificado e verificado o Neoanalista: 480 × 480 com transparência, sem pixels verdes opacos no frame amostrado; exibição no jogo com escala igual nos dois eixos. Não foi necessário regenerar o asset.
- Canvas e menu conferidos em retrato, paisagem e área visual reduzida, nos perfis alto e móvel. `git diff --check` sem erros. Samsung Internet foi apenas simulado pelo user-agent no Chromium; permanece pendente a conferência em dispositivo físico com esse navegador.


### Animações das ações do oponente

- Corrigida a apresentação na camada independente de efeitos: invocações do oponente voam da mão até o campo e viram a carta; conjurações exibem a carta no centro; habilidades destacam a carta de origem. Mantida a remoção do painel superior de anúncios.
- Contornos dos alvos, mudanças de poder, sons e vídeos começam após o impacto da carta. A fila aguarda a apresentação antes de avançar, sem duplicar eventos recebidos novamente pela rede.
- Durante a invocação, a carta estática fica oculta e reaparece na aterrissagem, inclusive se o campo for redesenhado durante o voo. Encerrar a camada também restaura sua visibilidade.
- Preservado o sigilo das cartas ocultas, sem expor nome ou arte. Animações locais já existentes não são duplicadas; espectadores acompanham as apresentações dos dois lados.
- Atualizada a versão do script no HTML. `npm test` aprovado: 21 arquivos com sintaxe válida e 17 testes funcionais, incluindo nova regressão de invocação, conjuração sem alvos, habilidade, fila, redesenho, sigilo e perspectiva. `git diff --check` sem erros.
- Conferidos no Chromium o bot colocando carta e usando efeito, além de invocação, conjuração e habilidade em dois navegadores online. Validadas atualizações durante o voo e ausência de repetição de eventos, sem erros JavaScript. Não realizada conferência em dispositivo móvel físico.


### Loja de boosters, abertura animada e dinheiro administrativo

- Refeito o menu de boosters com seleção de facção, pacote ilustrado em destaque, saldo, preço e estados de compra. A abertura anima o rompimento do lacre e revela as cartas em sequência, com cores por raridade e respeito à preferência de movimento reduzido.
- Cada booster entrega exatamente **5 cartas** no servidor, mantendo o preço de 100 tijolinhos e as regras de sorteio por facção. Repetições aparecem como cartas individuais na revelação; a coleção do Deck Forge é sincronizada após a compra.
- Adicionado o botão **ADMIN · + SALDO** na loja e a seção **Adicionar dinheiro** no painel administrativo. A API valida conta, valor inteiro de 1 a 1.000.000, limite seguro de saldo e o token administrativo configurado, seguindo a política dos demais comandos de admin. Créditos são persistidos sem alterar a coleção.
- Bloqueados cliques duplicados e fechamento durante a abertura; adicionados estados de erro, saldo insuficiente e retorno para escolher outro pacote. Fechar a loja ou o painel atualiza o saldo no menu principal.
- Documentado o fluxo no README e atualizadas as versões dos arquivos no HTML.

### Validações dos boosters

- `npm test` aprovado: sintaxe de 21 arquivos e 16 testes funcionais. Testes de contas ampliados e aprovados para cinco cartas nas cinco facções, crédito persistido, token ausente/incorreto, valores inválidos, conta inexistente e preservação da coleção.
- Verificadas compras concorrentes: com 500 tijolinhos, somente cinco compras são aceitas, entregando 25 cartas, com saldo final zero; tentativas adicionais não concedem cartas.
- Conferidos no Chromium automatizado compra, animação, cinco revelações, clique duplicado, erro de servidor com nova tentativa, crédito pelo botão de admin, saldo insuficiente e movimento reduzido. Conferida a ausência de transbordamento horizontal em viewport de 320 × 568 e capturas da loja em 390 × 844, sem erros JavaScript.
- `git diff --check` sem erros. Não realizada conferência em dispositivo móvel físico.


### Atalhos de teste para x1 e final da partida

- Adicionados os comandos globais `irParaX1()` e `irParaFinal("vitoria" | "derrota" | "empate")`, disponíveis no console após o carregamento inicial.
- X1 abre diretamente contra o bot, sem login ou vídeo de transição, usando o deck salvo ou um deck temporário válido. Sai da sala online anterior e não altera o deck persistido nem registra a partida de teste na conta.
- Final solo cancela callbacks, efeitos pendentes e modais antes de mostrar o resultado. Reinícios recriam o vídeo de fundo, e o fechamento imediato do detalhe evita callbacks sobre a tela final.
- Final online é resolvido no servidor e transmitido aos jogadores e espectadores com a perspectiva correta. Disponível apenas com `npm run dev` ou `CYBERDUEL_DEBUG=1`; espectadores, resultados inválidos e partidas já encerradas são recusados. Finais de teste não chamam o registro de partida da conta.
- Documentados os comandos no README e atualizadas as versões dos scripts no HTML.
- `npm test` aprovado: sintaxe de 21 arquivos e 16 testes funcionais, incluindo recusa do atalho no servidor normal, sincronização online, restrições a espectadores e os três resultados. `git diff --check` sem erros.
- Conferidos no Chromium automatizado o x1 sem login, os três resultados, reinício, modal aberto e preservação do deck salvo. Final online validado em dois navegadores: vitória do jogador 2 e derrota do jogador 1, sem erros JavaScript.


### Remoção do painel de ações

- Removida a faixa superior que anunciava nome, ação e descrição das cartas durante os eventos da partida, incluindo as ações do oponente. Mantidos os efeitos sobre as cartas, animações e sons.
- Removido o gerador de resumos usado exclusivamente pela faixa e atualizada a versão do script no HTML.
- Validados a sintaxe de `efeitos.js`, o teste de eventos de efeitos e `git diff --check`, sem erros. Não realizada nova conferência visual no navegador para esta remoção.

### Adaptação à resolução 720 × 1480

- Preservados `GW = 720` e `GH = 1480` em `jogo.js`. Separadas as dimensões de saída das unidades de desenho: campo, mão, HUD, modais, carregamento e efeitos compartilham um layout proporcional, convertido pela câmera em todos os perfis de qualidade.
- Corrigidas as coordenadas de ponteiro usadas nos gestos da mão, rolagem de descrições e movimento do zoom das cartas, considerando a escala da câmera.
- Tela inicial e Deck Forge acompanham a proporção configurada. Vídeo de transição cobre a tela sem deformação e só recebe tamanho após carregar o primeiro frame. Atualizadas as versões dos arquivos alterados no HTML.

### Validações e limitações

- `npm test` aprovado: sintaxe de 19 arquivos e 15 testes funcionais. Regressão de resolução cobre 720 × 1480, 1080 × 2160 e 720 × 1280, nos perfis alto e móvel, verificando limites do campo/mão, câmera, ponteiro e proporção HTML.
- Conferidos no Chromium automatizado a tela inicial, o tabuleiro e o modal de carta; cliques reais nas cartas abriram o modal nos dois perfis, sem erros JavaScript. Confirmados canvas de 720 × 1480 em qualidade alta e 480 × 987 no perfil móvel, mantendo o mesmo mundo lógico de 1080 × 2220.
- `git diff --check` sem erros. Não realizada partida multiplayer entre dispositivos físicos nem conferência manual de todas as habilidades e gestos de toque.

## 2026-09-15

### Live Server sem Docker

- Unificado o endereço da API de contas e do Socket.IO: nas portas estáticas 5500, 5501, 4173, 5173 e 8080, ambos usam o backend Node da mesma máquina na porta 3000. No acesso direto ao Node ou ao Docker em porta padrão, preservada a origem da página.
- O parâmetro `?server=` agora configura também a API de contas; `CYBERDUEL_SERVER_URL` continua com prioridade. Atualizadas as versões dos scripts alterados no HTML.
- API aceita requisições entre portas do mesmo host e entre endereços de loopback, com resposta a OPTIONS e cabeçalhos CORS para JSON e autenticação.
- Documentado no README o uso de `npm start` junto do Live Server, portas alternativas e acesso pela rede local. Login, coleção e multiplayer continuam exigindo o backend em execução.

### Validações e limitações

- Substituído o diretório `node_modules` vazio, pertencente a root, pela instalação local das dependências com `npm ci`.
- `npm test` aprovado: sintaxe de 19 arquivos e 14 testes funcionais, incluindo resolução compartilhada de endereços e CORS da API. `git diff --check` sem erros.
- Não realizada conferência interativa no navegador nem execução do Docker nesta sessão.

## 2026-09-11

### Fases, Extintor e efeitos visuais

- Aura verde de habilidade disponível permanece estável, restrita à fase de habilidades. Transições multiplayer redesenham o campo também ao perder a vez e ao mudar de fase; contornos de eventos usam azul para não parecerem habilidades disponíveis durante a colocação.
- Extintor bloqueia bônus até a pontuação da próxima rodada, cobrindo a próxima colocação de cartas. O prazo é preservado na sincronização, e a descrição da habilidade informa a duração atualizada.
- Dieh’go acumula uma caveira do asset por ponto de dano sobre o alvo, sem controles de mais/menos. Após distribuir o primeiro ponto, tocar no fundo não cancela a seleção. Mantidos limites por PA, reserva total, alvos únicos e confirmação parcial.
- Neoanalista usa um novo vídeo WebM com transparência, derivado do MP4 original por chroma key, recorte central e redução para 480 × 480. A exibição dos vídeos de efeito preserva a proporção original.
- Atualizadas as versões dos scripts no HTML para invalidar o cache das alterações.

### Validações e limitações

- Sintaxe dos 18 arquivos JavaScript e os 12 testes funcionais existentes aprovados. Novo teste de interface aprovado para acúmulo de caveiras, limites, confirmação, cancelamento e transições de fase.
- Regressão do Extintor cobre a rodada seguinte, sincronização, bloqueio de carta de efeito durante a colocação e expiração após a pontuação seguinte.
- Conferidos visualmente frames do Neoanalista antes/depois e verificados dimensões e canal alfa do vídeo gerado. Não realizada conferência interativa no navegador nesta sessão.
- Dependências usadas em diretório temporário para executar a suíte, pois o `node_modules` local não permite escrita pelo usuário atual.

## 2026-09-10

### Conferência de personagens restantes

- Comparados os 38 personagens de `Cartas e boosters.md` com `POOL_CARTAS_MONSTRO`: todos estão no catálogo implementado; **nenhum personagem faltante** no documento atual.

### Catálogo completo das artes prontas

- Integradas todas as artes de cartas referenciadas em `Cartas e boosters.md`: **54 cartas disponíveis, sendo 38 personagens, 9 terrenos e 7 efeitos**.
- Implementadas as seis cartas que faltavam da HumbaNet:

  | Carta | PA | Efeito implementado |
  | --- | ---: | --- |
  | IA de treinamento | 4 | Aliados adjacentes na horizontal ou vertical recebem +4 PA enquanto a IA estiver em campo. |
  | HAL 9001 | 5 | Desabilita os efeitos de uma carta inimiga, inclusive terreno. Mantém um alvo por HAL; trocar o alvo ou remover a fonte libera a carta anterior. |
  | H.A.R.V.I.S | 5 | Compra uma carta do baralho ao ser invocado. |
  | Replicantes | 7 | Recebe +3 PA por terreno presente nos dois campos. |
  | DeepClaude ChatGemini | — | Habilidade de terreno: descarta a mão e compra a mesma quantidade, limitada às cartas restantes no baralho, uma vez por turno. |
  | Bug na Matrix | — | Concede +2 PA a todos os personagens aliados. |

- Integradas as artes definitivas de **Juggernaut, HumbaBrain e CyberUnidades de Emergência**. Juggernaut pertence à HumbaNet.
- Geradas texturas WebP a partir das artes existentes, preservando os PNGs originais. O catálogo de texturas usado pela partida ocupa aproximadamente **5,52 MiB**.

### Atualização das regras do documento

- **RaspCorp:** CyberVendedor usa Venda Casada uma vez por turno, inclusive em si mesmo; Estagiário concede +3 PA e perde 1; GRPH retira 2 e concede 4; CryptoAcionistas tem 50% de chance de ganhar +2 PA no início do turno.
- **NeoAnalista:** reduz as fases de colocação e habilidades em 15 segundos por cópia, com mínimo de 20 segundos em cada fase, inclusive no cronômetro do servidor.
- **EchoSsystem:** O Rato começa com 2 PA; O Cão aplica -3 PA à próxima invocação inimiga de personagem; O Porco pode perder bônus, mas mantém o piso de 6 PA enquanto seu efeito estiver ativo; Galo concede +3 e +2 PA.
- **HumbaNet:** Você Parece Sozinho concede +5 PA ao alvo isolado. Humbatrix também bloqueia habilidades de terrenos, incluindo DeepClaude.
- **Remanescentes:** Povo da Areia conta cartas de efeito usadas, personagens destruídos e terrenos removidos nos dois lados desde sua invocação; descartes da mão não contam. Ferreira concede +2 a até dois aliados; Feio ganha +5 quando está entre Bom e Mau e concede +3 a ambos; Saloon concede +3 na mesma linha. Removido o antigo bônus de Dieh'Go para a carta atrás dele.
- **Sindicato:** NeoMedicânico recupera todo o PA perdido até o limite de recuperação; Influenciador concede ou retira 2 PA; vínculo do CyberPolítico concede +6; NeoPalhoça concede +3 às cartas do Sindicato.
- Atualizadas as descrições e a verificação de PA contra o documento.

### Efeitos, interface e obtenção de cartas

- HAL suspende habilidades ativas, passivas, efeitos contínuos, veneno, investimentos e redução de tempo. A liberação restaura os efeitos e preserva os estados necessários para sua continuidade.
- Desativação e restauração geram eventos compartilhados com a origem e os alvos. A carta afetada exibe **EFEITO BLOQUEADO**, e seus detalhes identificam quem causou o bloqueio.
- Corrigida a interação entre o bônus de adjacência da IA e o trio do Feio, evitando ativar o trio sem Bom e Mau nas posições exigidas.
- Veneno registra cada fonte ativa; uma Cobra bloqueada deixa de causar dano até seu efeito ser restaurado.
- O vínculo da Aranha é preservado quando o HAL suspende Override, inclusive após sincronização e inversão de perspectiva. Ao encerrar o bloqueio, a Aranha volta a controlar o alvo se ainda cumprir a condição de PA.
- As seis cartas novas podem ser concedidas individualmente, junto de todas as disponíveis ou por facção no painel administrativo. A lista do painel contém as **54 cartas**.
- Loja com boosters de RaspCorp, EchoSsystem, HumbaNet, Remanescentes e Sindicato, todos com **4 cartas por pacote**. Corrigido o texto dos botões que ainda anunciava um deck de 20 cartas.
- A concessão administrativa por facção entrega o catálogo disponível para HumbaNet, Remanescentes e Sindicato; a montagem do deck segue as regras do Deck Forge.
- Corrigida a abertura dos detalhes de cartas no renderizador Canvas, reutilizando o tratamento de máscaras compatível com Canvas e WebGL.

### Validações

- Testes de artes prontas, PA e descrições; habilidades dos 38 personagens; perspectivas dos dois jogadores; supressão e restauração; terreno ativável; Faro após sincronização; bônus do trio; contagem do Povo; recuperação e novo cronômetro.
- API verificada para concessão individual das novas cartas, concessão por facção e abertura de boosters com exatamente quatro cartas das facções correspondentes.
- Navegador em Canvas e WebGL: 54 opções no painel, cinco boosters na loja, novas texturas carregadas, seleção do terreno pelo HAL e ativação de DeepClaude, sem erros de execução nos fluxos verificados.

- Verificação final da continuação: **18 arquivos JavaScript verificados e 12 testes funcionais aprovados**; `git diff --check` sem erros.
- Imagem Docker do servidor construída; catálogo, carregamento do runtime, endpoint de saúde e resolução de rodada com HAL, IA de treinamento e terreno verificados.

## 2026-09-09

### Revisão dos efeitos e do catálogo

- Invocações, habilidades, efeitos contínuos, veneno, recuperação e investimentos agora geram eventos explícitos na partida, compartilhados entre os dois jogadores.
- Cada evento mostra sua origem e os alvos afetados, incluindo efeitos que não alteram PA. Ativações repetidas continuam registradas mesmo quando a carta é removida logo depois.
- A apresentação usa uma camada independente: redesenhar o campo ou fechar uma seleção não apaga os efeitos. O relógio continua correndo, e a tela final aguarda a apresentação dos últimos eventos.
- Integrados os sons existentes de Estagiário, GRPH, NeoAnalista e CryptoAcionistas, além dos sons de ataque, Advogado e RaspClay. Habilidades aprendidas pelo Estudante preservam a apresentação da habilidade copiada.
- NeoAnalista exibe seu vídeo sobre a carta; DIPSP dispara energia azul; Dieh'Go mostra uma caveira por PA de dano; Advogado destaca o terreno eliminado. As apresentações aparecem tanto para quem joga quanto para o adversário.
- Cartas sem assets exclusivos usam a apresentação padrão. Os arquivos de som exclusivos de CyberVendedor e Sugestão Algorítmica citados no documento não estão no repositório; seus efeitos continuam visíveis com som padrão.
- Comparado o catálogo disponível com `Cartas e boosters.md`: Juggernaut ajustado para **10 PA**; CryptoAcionistas ajustado para **50% de chance de +1 PA no início de cada turno**; descrições completas atualizadas, incluindo DIPSP, Dieh'Go, O Bom, O Feio, Saloon e cartas de efeito.
- O texto da DIPSP explicita até dois alvos a uma coluna de distância. O alcance implementado já correspondia a essa distância e foi preservado.
- Corrigido o tabuleiro que podia permanecer transparente ao receber uma atualização durante a animação de entrada.
- Preservado o sigilo das cartas ocultas e do espaço da armadilha na apresentação; o histórico enviado a espectadores também oculta informações privadas.
- Validação automatizada dos **34 personagens e 23 habilidades ativáveis** do catálogo, incluindo inversão de perspectiva, habilidades aprendidas, bloqueio de PA, fontes removidas e efeitos contínuos.
- Verificação com dois navegadores: mesma sequência exibida uma única vez em cada lado, sons correspondentes e cinco caveiras para um ataque de 5 PA.
- Suíte final: **18 arquivos verificados e 11 testes aprovados**. Imagem Docker construída e validada com resolução de rodada e geração dos eventos de efeitos no servidor.

### Novas fases da partida

- Cada rodada segue esta sequência:

  | Etapa | Ação | Tempo |
  | --- | --- | --- |
  | 1 | Primeiro jogador coloca cartas | 40 segundos |
  | 2 | Segundo jogador coloca cartas | 40 segundos |
  | 3 | Primeiro jogador usa habilidades | 40 segundos |
  | 4 | Segundo jogador usa habilidades | 40 segundos |

- O primeiro jogador é sorteado no início da partida. Quem começa alterna a cada rodada.
- Colocação de cartas e ativação de habilidades ficam disponíveis nas respectivas fases, tanto no multiplayer quanto no modo solo.
- Cada NeoAnalista reduz em 10 segundos as duas fases do adversário, com mínimo de 15 segundos por fase.
- No multiplayer, o servidor controla o prazo e a passagem de fase. Abrir seleções, assistir a animações, desconectar ou recarregar a página não reinicia nem pausa o relógio.

### Retorno, espectadores e navegação

- O menu oferece **voltar à partida ativa** depois de recarregar a página, recuperando o estado e o prazo da fase.
- Nova opção **espectar sala** pelo código, sem controles para jogar. Mãos, baralhos e armadilhas são ocultados no estado enviado ao espectador.
- É possível consultar a própria mão e as cartas visíveis dos dois campos enquanto se aguarda o adversário.
- A tela de resultado tem botão **voltar ao menu** e retorno automático após 10 segundos.
- O resultado exibido ao espectador identifica o jogador vencedor, inclusive em desistências.

### Cartas, efeitos e interface

- CyberPolíticos recebe animação de morte com fragmentos e a mensagem **CONTRATO ROMPIDO**.
- Ativações, mudanças de PA e remoções são apresentadas ao adversário; a animação do Advogado Corporativo aparece sobre o terreno afetado.
- Advogado Corporativo pode usar a habilidade uma vez por turno, em vez de ficar bloqueado até o fim da partida.
- A animação de compra do adversário preserva o tamanho reduzido da carta.
- O indicador de armadilha aparece apenas para quem conjurou o efeito.
- Adicionar ou remover cartas no deck builder preserva a rolagem da coleção e da ficha de detalhes.
- Cada booster entrega **4 cartas sorteadas**, corrigindo a entrega indevida de um deck de 20 cartas.
- O modo solo reaproveita a apresentação de efeitos, compras e remoções nas novas fases.

### Servidor e validação

- A imagem Docker inclui o catálogo e os arquivos usados para resolver rodadas no servidor, corrigindo o erro de arquivo ausente em `/app/js/cartas.js`.
- Suíte automatizada concluída: **17 arquivos verificados e 10 testes aprovados**.
- Verificações no navegador: sequência das fases, espectador, retorno após recarregar, animações, tamanho da compra, expiração durante seleção, rolagem do deck builder e retorno automático ao menu.
- Imagem Docker construída e validada com carregamento do catálogo, resolução de rodada e resposta de saúde do servidor.
- As salas ativas ficam na memória do servidor: o retorno funciona após recarregar o navegador, mas não após reiniciar o servidor.

### Histórico do projeto

- Criado este `CHANGELOG.md` para documentar as entregas.
- Registrada em `AGENTS.md` a preferência de atualizar o changelog a cada pedido do usuário.
