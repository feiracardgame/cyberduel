# Histórico de alterações — Cyberduel

Novidades, correções e verificações realizadas no projeto. As entregas mais recentes aparecem primeiro.

## 2026-10-06

### Carteirinha de jogador e partidas do Clube pela apresentação

- Substituída a opção do Clube por uma carteirinha com foto, apelido, identificação da conta, facção, partidas e vitórias contra jogadores e dentro do Clube. O acesso aparece como liberado a partir de 3 vitórias contra jogadores ou bloqueado com o requisito para liberar; a carteirinha abre também sem acesso e sem deck salvo, para apresentar ao segurança.
- Trocadas as imagens entre a carteirinha e “Entrar por código” e removida a opção “Sala híbrida”. Retirados os botões de criar/entrar em salas do Clube da antiga janela; o duelo comum por código continua no menu de partidas.
- A identificação de partidas do Clube agora vem das salas criadas pelo fluxo de `/apresentacao`, no servidor. Salas comuns ignoram a antiga marcação `club` enviada pelo cliente. Partidas concluídas entre contas distintas nessa apresentação registram partidas e vitórias do Clube uma única vez, junto às estatísticas contra jogadores, e persistem na conta. Preservadas as regras existentes de entrada por QR code na apresentação; a carteirinha informa o acesso para conferência presencial.
- Contadores específicos do Clube começam em zero nas contas existentes: não há registro antigo suficiente para reconstruir quais partidas ocorreram em apresentações. Renovado o cache do CSS e dos scripts alterados.
- Aprovados os testes de tutorial, menu, cliente de conta, cliente de apresentação, multiplayer e apresentação, incluindo rejeição da classificação de Clube pelo cliente, sala comum sem contagem de Clube e apresentação com estatísticas persistidas. Sintaxe dos scripts alterados e `git diff --check` aprovados.
- Playwright confirmou a abertura pelo menu real sem deck salvo, identidade e contadores corretos, acesso liberado/bloqueado, troca das imagens, ausência de “Sala híbrida” e retorno ao menu, em celular e computador, sem transbordamento horizontal ou erros JavaScript. Capturas inspecionadas e script em `/tmp/cyberduel-playwright/player-card.cjs`; sem deploy.

### ElenAI visível e apresentação vinculada à conta após o login

- Corrigido o enquadramento dos diálogos: a personagem ocupa o espaço acima da caixa de texto, sem ficar encoberta nas falas longas. A caixa permite rolagem quando necessário em telas menores; o ajuste compartilhado também atende aos diálogos do treino.
- A primeira abertura sem sessão exibe diretamente o login, sem esperar a consulta de partidas pelo multiplayer. A apresentação começa após autenticar uma conta nova e salva seu progresso na conta; removida a dependência do registro da introdução no navegador. Outra conta nova no mesmo navegador recebe sua própria apresentação, enquanto contas antigas com facção mantêm o acesso direto ao menu.
- Atualizadas as versões do CSS e dos scripts de tutorial e título para renovar o cache. Aprovados os testes de tutorial, menu e apresentação, incluindo regressão para login antes da história, ausência de repetição na mesma conta e introdução independente para outra conta nova; sintaxe e `git diff --check` aprovados.
- Playwright confirmou a personagem acima da fala longa da imagem em 490 × 870, 390 × 844, 360 × 640 e 1280 × 900, sem sobreposição ou transbordamento horizontal; capturas inspecionadas. Confirmados login na primeira abertura, introdução após autenticação mesmo com o antigo registro local, outra conta nova no mesmo navegador, ausência de repetição ao recarregar ou restaurar a mesma conta em navegador limpo e entrada direta de conta antiga, sem erros JavaScript. Script e capturas em `/tmp/cyberduel-playwright/`; sem deploy.

### Como testar o tutorial

- Conferidos o atalho `? TUTORIAL` no menu, a inicialização com `npm run dev` em `http://localhost:3000` por padrão e o login local de desenvolvimento. Para testar a apresentação inicial, é necessário usar um navegador sem o registro local da introdução e uma conta nova; revisitar o tutorial não reinicia a escolha salva nem as falas de progresso.
- Confirmado o comando `node test/tutorial.test.js` para validar roteiro, alcance, persistência, ordem dos eventos e regras de ranking, Conselho e Clube.

### Tutorial interativo e história da ElenAI

- Implementado o roteiro de `Tutorial.md` (com T maiúsculo): apresentação de NeoFloripa, apelido, escolha “sim”/“não”, explicação das facções e despedida. Extraídas as 17 poses da folha original em WebP transparente, preservando a ordem indicada; os diálogos do menu escurecem o fundo e escondem as cartas.
- Criado treino no campo real com Estagiário de Machine Learning, Tigre contra CyberVendedor e Agente da DIPSP contra Rato. Os espaços, a conclusão da jogada e as cartas de habilidade recebem destaque; o motor normal valida alcance e dano. O treino funciona antes da coleção inicial, sem adversário automático, limite de tempo, consumo da coleção, contagem de partidas ou recompensas. Adicionada opção para revisitar e sair do tutorial.
- Escolha inicial e progresso persistidos na conta, com validação da API. As falas de 3 partidas, Clube, Conselho e 10 partidas respeitam o caminho escolhido, aparecem somente no menu e são apresentadas uma vez, em sequência, deixando 10 partidas por último. Contas que já tinham facção preservam o acesso ao menu, com tutorial disponível para revisitar e caminho amigável como padrão para as falas antigas sem escolha registrada.
- Conforme confirmado: ranking exige 5 partidas e 3 vitórias contra jogadores, o top 10 forma o Conselho e 3 vitórias liberam o Clube Secreto. Criar e entrar em salas do Clube reutiliza o duelo por código/QR e exige o desbloqueio dos participantes no servidor. Registrada a primeira entrada no Conselho, mesmo que a posição mude posteriormente.
- Separadas estatísticas contra jogadores das partidas solo; partidas contra bot não liberam ranking, Conselho ou Clube. Migração utiliza as estatísticas ranqueadas já existentes: o histórico antigo não fornece vitórias de salas amistosas para reconstruir esses totais.
- Aprovados testes de tutorial, contas, perfil, autenticação local, recompensas solo, matchmaking, multiplayer, apresentação, menu, habilidades, passagem de turno, sincronização, deck, seleção da mão, assets, desempenho da cena e retorno à partida. Playwright confirmou no celular as duas versões dos diálogos de progresso, a ordem dos eventos, a persistência após recarregar, o caminho “não” e a escolha de facção com a pose 11. Também aprovado no Playwright o treino completo no celular, com invocações e habilidades reais, retorno ao menu e nenhuma chamada de registro de partida ou recompensa. No computador, aprovado o fluxo de conta nova desde o apelido e escolha “sim” até treino, facção, despedida, recarregamento sem repetição e opção de revisitar/sair; saldo inicial e zero partidas preservados, sem erros JavaScript ou HTTP locais. Capturas e scripts em `/tmp/cyberduel-playwright/`.
- Limitação da suíte existente: `card-modal-layer.test.js` falha porque seu mock não implementa `scene.bringToTop`; a mesma falha foi reproduzida usando `js/cenas/jogo.js` do HEAD anterior a estas alterações. Sem deploy.

### Reprodução mais leve do POW do Juggernaut

- Otimizado o próprio `efeito-juggernaut-alpha.webm`: removido o segundo transparente inicial e o restante não utilizado, reduzida a resolução de 452 × 328 para 340 × 246 e mantidos os 25 quadros por segundo e a transparência. O arquivo passou de 138.987 para 58.265 bytes; preservada a fonte MP4.
- Removidos avanço em 16×, salto de tempo e espera por quadros do trecho vazio. O WebM toca diretamente desde o início, na velocidade normal, mantendo POW antes do dano aos 300 ms e saída da carta aos 650 ms. Renovadas as versões dos scripts e a URL do vídeo para substituir o asset em cache.
- Aprovados os testes de apresentação, assets e preload de vídeos. Playwright confirmou quatro cenários com início entre 142 e 195 ms, avanço do vídeo, pixels visíveis, PA antigo antes do dano e saída ao final, sem erros JavaScript ou HTTP locais. Sintaxe e `git diff --check` aprovados; sem deploy.
- Reprodução isolada no Chromium apresentou os 25 quadros do arquivo, na velocidade normal, sem descartar quadros. Limitação da validação: com o tabuleiro completo e renderização por software, a medição ainda apresentou perdas variáveis de quadros; não foi confirmada ausência de travadas em todos os ambientes.

### Início mais rápido do POW do Juggernaut

- Removida a animação de preparação da fonte antes do POW. O trecho inicial transparente do WebM avança em velocidade 16× quando não é possível saltá-lo imediatamente; ao chegar ao desenho, a reprodução retorna à velocidade normal. Mantidos o PA anterior antes do dano, a apresentação do dano após 300 ms e a saída da carta ao final dos 650 ms.
- `opponent-animation.test.js` aprovado: entrada acelerada, retorno à velocidade normal e ausência de espera pela preparação, além da sequência POW/dano/remoção. Atualizada a versão do script no HTML; sintaxe e `git diff --check` aprovados.
- Playwright confirmou quatro cenários nos dois campos, com início do desenho entre 170 e 444 ms no navegador de teste, mantendo POW antes do dano e a remoção ao final. Sem erros JavaScript ou HTTP locais; mantida a reprodução direta de `efeito-juggernaut-alpha.webm`, sem deploy.

### POW do Juggernaut antes da apresentação do dano

- Durante os primeiros 300 ms do POW, o alvo mantém a imagem e o PA anteriores ao ataque. Depois são apresentados o dano, o brilho e o novo PA; cartas eliminadas permanecem com 0 PA até sair ao final dos 650 ms. Preservada a reprodução direta do WebM e a ocultação das cartas viradas para baixo. A resolução das regras no motor permanece imediata; a sequência visual acompanha o impacto.
- `opponent-animation.test.js` aprovado: POW antes da mensagem de dano, PA anterior preservado, atualização aos 300 ms, saída aos 650 ms, alvos sobreviventes/eliminados e duas perspectivas. Atualizada a versão do script no HTML.
- Playwright confirmou quatro cenários com a habilidade real: Rato eliminado e Tigre sobrevivente nos dois campos, POW visível com PA antigo antes do dano e mudança somente depois. Conferidos pixels opacos e avanço do WebM, sem erros JavaScript ou HTTP locais. Sintaxe e `git diff --check` aprovados; capturas em `/tmp/cyberduel-playwright/`, sem deploy.

### Juggernaut pula o início transparente do WebM

- Identificada a causa do efeito invisível: o primeiro segundo de `efeito-juggernaut-alpha.webm` não contém pixels opacos; a reprodução de 650 ms terminava antes de aparecer o desenho. O vídeo solicita o salto para 1 segundo e só inicia os 650 ms quando um quadro desse trecho foi decodificado, inclusive quando o navegador não consegue saltar imediatamente. Mantidas a reprodução direta do mesmo arquivo e a saída da carta ao final. Atualizada a versão do script no HTML.
- `opponent-animation.test.js` aprovado com regressões para o ponto inicial da reprodução e a espera pelo quadro visível. A validação anterior verificava avanço do vídeo, mas não a presença de pixels visíveis; reforçado o teste do navegador para conferir também o desenho.
- Playwright confirmou o desenho com mais de 20 mil pixels opacos, avanço da animação e carta visível até o final nos dois campos, sem erros JavaScript ou HTTP locais. Conferida a captura do impacto visível; sintaxe e `git diff --check` aprovados.

### Juggernaut reproduz diretamente o WebM transparente

- Refeito o efeito para carregar e reproduzir `assets/efeitos/efeito-juggernaut-alpha.webm` diretamente sobre o alvo, sem imagem fixa nem folha de quadros. Mantidos os 650 ms, contados por temporizador real a partir do início da reprodução, e a saída conjunta da carta ao encerrar o vídeo. Removida a folha de quadros gerada na tentativa anterior; preservado o WebM original.
- Aprovados os testes de apresentação, assets e preload de vídeo, incluindo reprodução atrasada, erro e timeout sem prender a fila. Playwright confirmou o arquivo exato, avanço do tempo do vídeo, carta visível durante a reprodução e remoção ao final nos dois campos, sem erros JavaScript ou HTTP locais. Atualizadas as versões dos scripts; sintaxe e `git diff --check` aprovados, sem deploy.

### Juggernaut com animação durante os 650 ms

- Substituída a imagem fixa por 20 quadros extraídos da animação original, com transparência, reproduzidos em 650 ms sobre o alvo. A carta eliminada permanece visível durante a animação e desaparece ao final. Atualizado o carregamento da folha de quadros e as versões dos scripts no HTML.
- Aprovados `opponent-animation.test.js`, `game-assets.test.js` e `preload-video.test.js`: avanço dos quadros, duração, remoção sincronizada e carregamento do asset. Playwright confirmou a habilidade real nos dois campos, com vários quadros distintos, carta visível durante toda a animação e saída no final, sem erros JavaScript ou HTTP locais. Sintaxe e `git diff --check` aprovados; capturas em `/tmp/cyberduel-playwright/`, sem deploy.

### Impacto do Juggernaut ampliado para 650 ms

- Aumentada de 200 para 650 ms a duração do impacto. A carta eliminada continua visível até desaparecer junto com o fim do efeito. Atualizada a versão do script no HTML para renovar o cache.
- `opponent-animation.test.js` aprovado: duração de 650 ms, saída da carta ao final, alvos sobreviventes, sigilo e duas perspectivas. `git diff --check` aprovado.

### Impacto do Juggernaut antes da remoção, limitado a 200 ms

- Substituído o vídeo longo por um flash transparente extraído do próprio efeito, exibido sobre o alvo por 200 ms. A carta eliminada permanece visualmente no slot durante a preparação e o impacto; desaparece junto com o fim do flash, sem começar a animação de saída antes disso. A duração do áudio não prolonga o efeito.
- Preservados os alvos sobreviventes, a orientação no modo mesa e o verso de cartas ocultas. O motor continua resolvendo o dano normalmente; ajustada apenas a apresentação. Atualizadas as versões dos scripts para renovar o cache.
- Aprovados `opponent-animation.test.js`, `game-assets.test.js` e `preload-video.test.js`. Regressão verifica carta removida e sobrevivente nas duas perspectivas, permanência antes do impacto, saída no final e duração exata de 200 ms mesmo com áudio de cinco segundos.
- Playwright confirmou a habilidade real eliminando o Rato nos dois campos: imagem da carta ainda visível sob o impacto, temporizador de 200 ms e desaparecimento conjunto ao final. Conferidas transparência e orientação do flash, sem erros JavaScript ou HTTP locais. Capturas antes/depois em `/tmp/cyberduel-playwright/`; sintaxe e `git diff --check` aprovados.

### Mensagem de restauração do Boi

- Alterada para “PA restaurado” a mensagem que o efeito do Boi exibia como “PA protegido”. Mantidas as mensagens de proteção das demais cartas e os números de PA quando há variação. Teste de apresentação aprovado para o Boi e o Porco; Playwright confirmou a nova mensagem durante a habilidade real do Boi, sem erros JavaScript ou HTTP locais.

### Booster da RaspCorp azul

- Alterada a cor compartilhada do booster da RaspCorp para azul (`#4da6ff`), utilizada na loja, no inventário e na abertura. Atualizada a versão do script no HTML para renovar o cache.
- `booster-ui.test.js` e `booster-inventory.test.js` aprovados. Playwright confirmou a cor e a apresentação da loja em desktop e celular.

### Efeitos visuais conforme Cartas e boosters

- Implementados sprite 14 da IA de treinamento no canto da tela, cadeado persistente do HAL sobre a carta silenciada e contornos verdes nos terrenos dos dois jogadores enquanto os Replicantes estão ativos.
- Adicionados popup animado dos CryptoAcionistas somente ao ganhar PA e vídeo do Juggernaut sobre o alvo atingido. Preparadas versões transparentes dos arquivos existentes, preservando os originais; vídeos mantêm proporção e aguardam sua conclusão junto com o áudio, com liberação da fila em caso de erro ou bloqueio de reprodução.
- Ajustados brilhos azul/vermelho e alvos de CyberVendedor, Estagiário, GRPH e DIPSP; Cobra brilha ao aplicar veneno e pinta o símbolo nos turnos de dano. Refinadas as três garras do Tigre e o encaixe da armadilha privada do Macaco no slot. Cavalo também faz tremer a carta eliminada antes de desaparecer. Reutilizados os efeitos existentes das demais cartas descritas.
- Preparada a arte completa do Dragão para o evento de despertar, junto do rugido. O gatilho de despertar continua desativado no motor conforme a alteração anterior; validado apenas por prévia do evento, sem reativar a regra.
- Aprovados os testes de animação, assets, boosters, preload de vídeos, habilidades, apresentação, espectador, título, seleção da mão e desempenho da cena. Playwright conferiu 18 cenários com eventos do motor e a prévia do Dragão, além do sprite em celular, sem erros JavaScript ou HTTP locais. Testes cobrem gatilhos, perspectivas, sigilo, marcadores persistentes e limpeza da fila. Sintaxe dos scripts alterados e `git diff --check` aprovados. Usados conta e dados temporários; capturas em `/tmp/cyberduel-playwright/`, sem deploy.

### Reciclagem restaura o PA e os efeitos originais da carta

- Reproduzido no Playwright o problema com uma carta morta ao lado da IA de treinamento: Reciclagem devolvia o Tigre com 0 PA e o registro antigo de +4; ao reinvocar, ele era removido novamente. Conferidas 152 combinações de cartas novas em slots adjacentes nos dois campos, sem transferência de dano entre cartas distintas.
- Reciclagem agora recria a carta com o mesmo ID, PA base e características originais do catálogo, eliminando dano, bônus antigos, veneno e estados temporários da passagem anterior pelo campo. Preservado o bloqueio de habilidades já usadas uma vez na partida. Bônus contínuos são aplicados conforme a nova posição: Tigre volta com 9 PA e recebe 13 ao lado da IA. Atualizada a versão do motor no HTML para renovar o cache.
- Aprovados `humbanet.test.js`, `new-cards.test.js`, `echossystem-effects.test.js` e `state-sync.test.js`, incluindo morte por habilidade, reposição por outra carta, recuperação dentro/fora da área da IA, recálculos repetidos e serialização com troca de perspectiva. O teste novo falhou antes da correção com 0 em vez de 9 PA. Sintaxe do motor e do teste aprovada.
- Playwright confirmou a recuperação corrigida no motor carregado pelo navegador e a reinvocação por cliques na mão e no slot: 9 PA na mão, bônus antigo zerado e 13 PA nos dados e no selo exibido, permanecendo em campo, sem erros JavaScript. Usados servidor, conta e dados temporários; artefatos em `/tmp/cyberduel-playwright/`, sem deploy. `git diff --check` aprovado.
- Limitação preexistente: `effect-events.test.js` falha pela divergência entre a descrição de “O Bom” no catálogo e no documento de cartas. Confirmada a mesma falha com o motor original do Git; essa descrição não foi alterada neste pedido. A sincronização foi validada pelos testes do codec, sem sessão online com dois navegadores.

## 2026-10-05

### Seleção visual, proteção do kit inicial e comissão do mercado

- As quantidades recebidas no kit inicial da facção agora ficam protegidas contra anúncios, mesmo após sair do deck salvo. Cópias extras da mesma carta continuam vendáveis, respeitando também as cópias do deck. Registrada a coleção inicial ao escolher a facção; contas antigas sem esse registro adotam as quantidades do kit padrão. Ao iniciar o servidor, anúncios antigos que deixavam a coleção abaixo dessa proteção são cancelados e suas cartas devolvidas.
- Substituído o seletor de texto por uma galeria com artes, busca, quantidade possuída, cópias vendáveis e indicação das cartas bloqueadas. Escolher uma carta abre a prévia e o formulário; “Trocar carta” retorna à galeria. Mantida a identidade visual do deck builder e o layout para celular.
- O comprador continua pagando o total anunciado. Ao concluir a compra, o vendedor recebe 80% do total do lote, arredondados para baixo em tijolinhos inteiros; o restante é a taxa do mercado. Cálculo inteiro evita imprecisão numérica. Publicar/cancelar não cobra taxa nem paga comissão. O formulário e os próprios anúncios mostram o valor líquido.
- Aprovados `player-market.test.js`, `booster-inventory.test.js`, `account-client.test.js` e `title-ui.test.js`: proteção em contas novas/antigas, cancelamento de anúncios antigos, cópias extras, comissão, preços baixos, arredondamento por lote, persistência, concorrência e recuperação após falha de gravação. Playwright verificou galeria, busca, carta inicial desabilitada, seleção/troca, prévia de 120 para oferta de 150, compra, saldo do vendedor de 620, cancelamento e coleção em desktop/celular. Sintaxe e `git diff --check` aprovados. Atualizados README e versões dos arquivos no HTML; usados dados temporários, sem deploy.

### Mercado com a identidade visual do montador de deck

- Aplicadas as skills `redesign-existing-projects` e `matrix` ao mercado existente: tela ampla com os mesmos tokens do deck builder, superfícies escuras, verde moderado, título Rushblade e textos/valores monoespaçados. Reorganizados cabeçalho, saldo, abas, busca e contagem de anúncios; destacados arte vertical, quantidade, vendedor, preço por cópia e total de cada oferta.
- Tela de anúncio agora apresenta a carta escolhida ao lado do formulário, com atualização da arte e das cópias livres ao selecionar outra carta. No celular, a galeria usa duas colunas e a prévia/formulário se empilham; mantidos estados vazios, carregamento, erros, foco visível e redução de movimento. Preservados reserva, compra, cancelamento e sincronização da coleção.
- `title-ui.test.js`, sintaxe de `js/title-ui.js` e `git diff --check` aprovados. Playwright validou anúncios, busca, compra, cancelamento, saldo e coleção com duas contas, em desktop e celular; conferida também a largura de 320 pixels sem overflow horizontal. Capturas de galeria e formulário em `/tmp/cyberduel-playwright/`, sem erros JavaScript ou HTTP locais. Atualizadas versões de CSS e JavaScript no HTML; nenhum deploy realizado.

### Mercado de cartas entre jogadores

- Ativados “Anunciar cartas” e “Visualizar anúncios” no menu Mercado. Jogadores podem publicar lotes de 1 a 99 cópias com preço inteiro por cópia em tijolinhos, buscar por carta/vendedor, comprar pelo total exibido e cancelar seus próprios anúncios. Interface adaptada a desktop e celular, com artes, saldo e mensagens de resultado; botão “Atualizar” consulta novas ofertas e vendas.
- Cartas anunciadas ficam reservadas fora da coleção e retornam ao cancelar. Cópias utilizadas no deck salvo não podem ser anunciadas; limite de 100 anúncios ativos por jogador. Compra transfere o lote e os tijolinhos sem taxa, usando o preço registrado pelo servidor. Bloqueadas compra própria, cancelamento por terceiros, falta de saldo, preços/quantidades inválidos e valores fora do limite numérico seguro.
- Anúncios, coleções e saldos são persistidos juntos no arquivo de contas existente. Operações são concluídas sem espera intermediária entre validação e gravação; compras concorrentes têm apenas um vencedor. Falha de persistência desfaz as alterações em memória, preserva o anúncio e retorna erro, sem cobrança ou transferência parcial. Atualizados README e versões dos arquivos no HTML.
- Aprovados `player-market.test.js`, `title-ui.test.js`, `account-client.test.js` e `booster-inventory.test.js`: reserva, deck protegido, permissões, preço do servidor, compra/cancelamento, repetição, concorrência, falha de gravação e persistência após reinício. Playwright confirmou o fluxo real com dois jogadores em desktop/celular, busca, compra, saldo do vendedor ao atualizar, cancelamento e coleção, sem erros JavaScript ou HTTP locais. Capturas em `/tmp/cyberduel-playwright/`; sintaxe dos arquivos alterados e `git diff --check` aprovados. Usados somente dados temporários, sem deploy.

### Povo da Areia considera apenas o próprio jogador

- Corrigido o cálculo de “Por Aqueles que Ainda Virão”: o bônus usa apenas personagens perdidos, terrenos removidos e cartas de efeito utilizadas pelo dono do Povo da Areia desde sua invocação. Removida a soma dos contadores do oponente no motor compartilhado pelo solo e pelo online; compras e descartes da mão continuam sem gerar bônus.
- Aprovados `echossystem-effects.test.js`, `humbanet.test.js` e `new-cards.test.js`. A regressão cobre o Povo em ambos os campos, ações próprias e adversárias, recálculo sem acúmulo, serialização, troca de perspectiva e rodada do motor online. Sintaxe de `js/main.js` e `git diff --check` aprovados. Atualizada a versão do script para renovar o cache.

### Despertar do Dragão reservado para implementação futura

- Removido o gatilho que despertava o Dragão das Comunicações Móveis pela habilidade do Boi e concedia +3 PA por rodada. O Boi mantém apenas seu efeito normal; não emite evento nem som de despertar. O áudio permanece carregado e associado ao evento futuro, sem gatilho ativo no motor.
- Teste `humbanet.test.js` aprovado: Dragão aliado e adversário permanecem adormecidos após o Boi, sem evento de despertar nem ganho por rodada, inclusive após serialização/troca de perspectiva e no motor online. Sintaxe de `js/main.js` e `git diff --check` aprovados. Atualizada a versão do script para renovar o cache; preservados os demais sons implementados.

### Sons das cartas e despertar do Dragão

- Implementadas as nove associações de áudio disponíveis: habilidade do CyberVendedor, invocação da IA de treinamento, habilidade do HAL 9001, invocação do H.A.R.V.I.S, ganho de PA dos Replicantes por terrenos, despertar do Dragão das Comunicações Móveis, habilidade do DeepClaude ChatGemini, invocação do Bug na Matrix e conjuração de Você Parece Sozinho. Para Replicantes, cujo gatilho não está especificado no documento, adotado o ganho positivo de PA pelo efeito contínuo; perda do bônus não reproduz a voz.
- Compra agora usa `compra_carta.mp3`. Habilidade do Tigre reproduz investida e garras, mantendo a voz existente; garras tocam uma vez por efeito, mesmo com vários alvos. Mantidos volume configurável, proteção da identidade de cartas ocultas e controle de eventos para evitar repetição. A fila aguarda a duração dos áudios, e o prazo de recuperação do servidor foi ajustado para as vozes mais longas.
- Implementado o despertar secreto do Dragão quando a habilidade do Boi reseta seu PA no próprio campo: voz apenas no primeiro despertar e ganho de +3 PA no início de cada rodada. Estado preservado na serialização, troca de perspectiva e motor online; desabilitação pelo HAL suspende o ganho até a restauração do efeito.
- Aprovados testes de Humbanet/Dragão, animações e áudio de jogadores/espectadores, assets, encerramento de turno com mão visível, Echossystem, novas cartas, avisos de batalha e multiplayer; sintaxe dos arquivos alterados e `git diff --check` aprovados. Playwright confirmou eventos reais do motor, reprodução WebAudio completa dos nove sons e das variações do Tigre, novo som de compra e volume configurado, sem erros JavaScript ou HTTP locais. Relatório e captura em `/tmp/cyberduel-playwright/`; não houve avaliação auditiva humana nem deploy.
- Pendente o som de Sugestão Algorítmica: o arquivo `som-sugestao` ainda não está disponível.

### Conferência dos sons prontos e ainda não associados às cartas

- Comparado `Cartas e boosters.md` com `assets/sons/`, o preload e os gatilhos da cena de efeitos. Identificadas nove associações pendentes com arquivo disponível: CyberVendedor, IA de treinamento, HAL 9001, H.A.R.V.I.S, Replicantes, Dragão das Comunicações Móveis, DeepClaude ChatGemini, Bug na Matrix e Você Parece Sozinho. O CyberVendedor usa som genérico; `interacao.mp3` já é carregado/usado na interface, mas não na invocação da IA; os outros oito arquivos específicos não estão no preload.
- O documento não especifica o momento de reprodução dos Replicantes. `som-sugestao` é citado para Sugestão Algorítmica, mas o arquivo não está disponível. Encontrados ainda `compra_carta.mp3` e `som-tigreataque.mp3` sem referências no JavaScript; `som-tigregarra.mp3` é carregado e ligado ao atributo legado `somAtaque`, sem consumidor de reprodução no fluxo atual de efeitos.
- `ffprobe` confirmou streams de áudio e durações válidas nos nove arquivos pendentes e nesses três extras. Conferência de código/assets; não houve reprodução ouvida por uma pessoa nem implementação de novos sons neste pedido. Preservadas as alterações locais existentes.

### Novo montador de deck e controle dos avisos de batalha

- Aplicadas as skills `redesign-existing-projects` e `matrix` ao montador existente: tela ampla no desktop com coleção e deck lado a lado, artes verticais, fonte Rushblade no título, tipografia monoespaçada, superfícies escuras e destaque verde. Simplificados os textos, o contador de composição e a ação “Salvar deck”; mantidos busca, filtros, facções, ficha, limites de coleção, sugestão, aleatório e builds salvas.
- No celular, preservadas as abas de cartas/deck e ajustados cabeçalho, resumo e controles. Retirada a regra compartilhada que forçava o montador à largura vertical do canvas; mantido o ajuste ao viewport visível. Coleção e deck são atualizados juntos após edição, evitando painel desatualizado ao mudar a largura da tela.
- Configurações agora oferecem “Pular avisos de início e de turno”, desativado por padrão, persistido no aparelho e desativado novamente ao restaurar os padrões. No solo elimina textos, vozes e espera de abertura/fase; no online o jogador ativo pode antecipar o relógio pelo servidor, preservando sua duração e sincronizando a sala. Servidor recusa espectadores, adversário, fases antigas e pedidos antes da abertura; repetir skip não renova o prazo. Vitória e derrota continuam com seus avisos.
- Removido o recolhimento automático da mão durante avisos e efeitos, preservando os bloqueios de interação necessários. Uma nova invocação, conjuração ou habilidade remove o título da fase antes da apresentação da jogada e impede seu retorno em redesenhos daquela fase.
- Aprovados testes de configurações/persistência, avisos solo/online, mão, animações, montador, menu, assets, apresentação/espectador e fluxo multiplayer com autorização e sincronização do skip; sintaxe dos arquivos alterados e `git diff --check` aprovados. Playwright verificou busca vazia, edição, sugestão, salvamento, builds e ficha em desktop/celular, skip solo e online com passagem de turno, mão visível durante o aviso e remoção do título após inserir uma carta pelo motor do jogo. Conferidos cabeçalhos em 390 e 320 pixels sem sobreposição/overflow; capturas revisadas, sem erros JavaScript ou HTTP locais nas execuções finais. Artefatos em `/tmp/cyberduel-playwright/`; nenhum deploy realizado.

### Roteiro de testes manuais das entregas do dia

- Conferidas as alterações de hoje e preparado roteiro para login local, avisos e áudios da batalha, início dos timers, resultados e orientação das cartas/PA na apresentação.
- A conferência manual pelo usuário continua pendente; os testes automatizados e no Playwright estão registrados nas respectivas entregas abaixo.

### Acesso local sem conta Google

- `npm run dev` agora oferece “ENTRAR LOCALMENTE” na tela de login: basta um nome de teste de 3 a 18 caracteres. A conta recebe username com prefixo `local_`, mantém progresso ao repetir o nome e usa os fluxos existentes de facção, deck, coleção e salas. Contas locais têm acesso ao admin e aos atalhos de desenvolvimento.
- Dados de desenvolvimento ficam por padrão em `server/data-dev/`, ignorado pelo Git; `DATA_DIR` explícito mantém prioridade. O servidor desse modo escuta somente em `127.0.0.1`. A API valida endereço da conexão, Host, Origin e nome; recusa colisão com contas Google e não vincula identidades.
- Fora do modo de desenvolvimento, a rota de login local é bloqueada e as sessões locais são recusadas. Mantido o login Google no modo normal. Atualizados README, versões dos scripts e nota do perfil local.
- Validações aprovadas: teste de acesso local com persistência após reinício, validação de entrada, bloqueio de origem/Host externos, colisão Google, facção/deck, privilégios dev e recusa em produção; regressão do login Google; testes do cliente de contas e do menu. Playwright confirmou entrada pela interface sem carregar o Google, recebimento do deck e partida online com duas contas locais. Usados apenas servidores e diretórios temporários; nenhum dado real ou container alterado.

### Orientação das cartas e do PA na apresentação

- Na tela de apresentação, arte, verso, PA e demais indicadores das cartas do campo superior ficam voltados ao jogador do topo (180°); o campo inferior mantém a orientação do jogador de baixo (0°), independentemente de quem está no turno.
- A rotação é aplicada ao conteúdo da carta, preservando a orientação durante animações no container externo. Corrigidas também a orientação da frente/verso na invocação e habilidade, da imagem de saída e dos números de PA nos efeitos da apresentação. Demais modos mantêm sua orientação anterior.
- Ampliado o teste de animações para verificar os dois lados, carta oculta, posição do PA e textos dos efeitos, dentro e fora da apresentação. Aprovados testes de animações, layout da apresentação e interface do espectador, sintaxe dos 25 arquivos JavaScript de `js`, `server` e `scripts` e `git diff --check`.
- Playwright com cenário visual definido na apresentação verificou os ângulos e a posição do PA nas duas fileiras, antes e depois de mudar o jogador ativo/fase. Capturas desktop (1440 × 1000) e viewport de celular (390 × 844) revisadas, sem erros JavaScript ou HTTP locais na execução final; arte e números do campo superior legíveis para o jogador do topo. Relatório e capturas em `/tmp/cyberduel-playwright/`.

### Validação da batalha no Playwright

- Executado Playwright com Chromium/WebGL em desktop (1440 × 1000) e celular emulado (390 × 844), usando servidor, contas Google e dados temporários. Conferidos abertura, posicionamento, habilidade, fonte Rushblade, bloqueio de interação durante os avisos e início da contagem somente depois do evento de conclusão dos áudios.
- Verificadas três sessões online: ambos os jogadores e um espectador. Só o jogador ativo recebe o aviso e a voz da fase; o outro jogador e o espectador não recebem essas vozes. Confirmados resultados de vitória e derrota, uma reprodução por resultado e identificação do vencedor/perdedor sobre o campo vencedor.
- Nenhum erro JavaScript ou recurso/API local com HTTP de erro na execução completa. Capturas de tela e relatórios guardados em `/tmp/cyberduel-playwright/`; Playwright instalado somente em `/tmp`, sem adicionar dependências ao projeto.
- Corrigido o título final do espectador que encostava nas bordas: agora mostra “VITÓRIA”, mantendo os apelidos no aviso sobre o campo. Cenário online repetido no Playwright com sucesso, sem erros JavaScript ou HTTP locais; teste funcional de resultado/desistência e sintaxe JavaScript também aprovados após o ajuste.
- Validação sonora feita por reprodução e eventos do WebAudio no navegador automatizado; celular físico e saída sonora ouvida por uma pessoa não foram testados. Dados reais, ambiente e containers de produção preservados; nenhum deploy realizado.

### Avisos e áudios da batalha

- Adicionados “Hora do Cyberduelo”, “Turno de posicionamento” e “Turno de habilidade” em Rushblade, usando os MP3 enviados. A abertura antecede o aviso do primeiro turno; avisos de fase aparecem e tocam somente para o jogador ativo, sem exibição ou reprodução para o oponente e os espectadores.
- Relógios solo e online começam a contar depois das janelas dos anúncios, dimensionadas pela duração dos MP3 com pequena margem. O servidor bloqueia jogadas e passagem de turno durante essas janelas, preserva as reduções de tempo das cartas e sincroniza a pausa dos efeitos. Atualizações e redesenhos não repetem os áudios; reconexões seguem o horário da fase.
- Tela final mostra “VITÓRIA” ou “DERROTA” na fonte do jogo e toca o áudio correspondente uma única vez. Espectadores veem os nomes do vencedor e do perdedor com os dois resultados acima do campo vencedor e ouvem vitória; empate mantém seu resultado sem essas vozes.
- Atualizados preload, versões dos scripts no HTML e cópia do novo arquivo compartilhado na imagem Docker do servidor. Preservadas as entradas anteriores deste histórico.
- Validações aprovadas: sintaxe dos 25 arquivos JavaScript de `js`, `server` e `scripts`, `git diff --check` e 16 testes funcionais relacionados, incluindo anúncios, assets, passagem de turno, resultado/desistência, animações, habilidade, interface de espectadores, apresentação, sincronização, desempenho, retorno à partida, multiplayer e matchmaking. Testes de servidor usam dados temporários; confirmados bloqueio durante anúncio, tempo integral, pausa de efeitos e conclusão das partidas.
- Limitações: reprodução sonora e aparência não verificadas manualmente em navegador; durações configuradas devem acompanhar uma eventual troca dos MP3. Nenhum deploy ou reconstrução de container realizado.

## 2026-10-01

### Recompensas dobradas no matchmaking e em salas

- Matchmaking e partidas por sala agora creditam 2.000 tijolinhos à conta vencedora e 400 à perdedora, com zero por empate. O crédito ocorre no encerramento pelo servidor, junto da contagem da partida, uma única vez; os saldos são persistidos. Mantidas as recompensas solo de 1.000/200.
- Desistência em salas passa pelo mesmo encerramento do servidor, registrando vitória, derrota e recompensas. Mantido o aviso de desistência ao adversário; chamadas repetidas não pagam novamente. Espectadores, finais de teste e partidas com a mesma conta nos dois lugares não recebem bônus. O saldo respeita o limite de inteiro seguro.
- Atualizado README. Validações aprovadas: sintaxe dos três arquivos JavaScript alterados, `git diff --check` e seis testes funcionais (`matchmaking`, `multiplayer`, `presentation`, `resume-match`, `solo-rewards` e `surrender-screen`). Verificados valores para ambos os jogadores, desistência em sala, pagamento único, persistência do matchmaking, espectador sem poder de encerramento e ausência de recompensa em finais de debug.
- Testes executados com contas e dados temporários. Nenhum `.env`, conta local ou container de produção alterado; publicação no servidor continua pendente.

### Administradores por conta e recompensa das partidas solo

- O servidor identifica administradores pelos usernames únicos de contas Google já cadastradas, configurados em `ADMIN_USERNAMES` (separados por vírgula, sem distinguir maiúsculas). Lista vazia bloqueia todos; remover um username e reiniciar revoga o acesso mesmo com a sessão anterior. Removido o acesso pelo token compartilhado e corrigido o acesso administrativo aberto quando esse token não existia.
- Todas as rotas `/api/admin/` exigem sessão autenticada de admin. Botões de admin das configurações e do mercado ficam ocultos para usuários comuns; o painel deixa de pedir token. Atalhos de teste e concessão de lendária exigem admin; ações de teste online e lendárias continuam exigindo modo de desenvolvimento.
- Partidas solo normais registradas por contas autenticadas concedem 1.000 tijolinhos por vitória, 200 por derrota e zero por empate. O servidor define os valores, verifica o dono do ID, rejeita resultados conflitantes e impede crédito/contagem duplicados em chamadas concorrentes ou após reiniciar. A tela final mostra o crédito confirmado; em falha de comunicação, permite repetir e pausa o retorno automático. Partidas com atalhos de teste não recebem bônus.
- Partidas online continuam sem esse bônus; sua contagem passa a ocorrer uma vez no servidor, usando as contas autenticadas dos jogadores e preservando o cálculo de ranking. Atualizados `.env.example`, repasse no Docker Compose, README e versões dos scripts no HTML.
- Limitação: o motor solo ainda executa no navegador e o servidor recebe o resultado do cliente; não há validação completa do combate contra manipulação. São mantidos os últimos 100 registros solo por conta; IDs removidos são recusados.
- Validações: sintaxe JavaScript e `git diff --check` aprovados; 37 dos 39 testes funcionais aprovados. Permanecem as duas falhas já registradas em `card-modal-layer.test.js` (mock sem `scene.bringToTop`) e `effect-events.test.js` (descrição de O Bom divergente). Testes cobrem permissões de todas as rotas administrativas, configuração vazia, revogação, valores fixos, dono da partida, repetição, concorrência, persistência, resultado inválido/conflitante, limite de saldo, atalhos e contagem online sem bônus.
- Chromium/Playwright em desktop (1440 × 1000) e celular (390 × 844): painel visível apenas ao admin, ausência de campo de token, concessão usando sessão, usuário comum bloqueado pela API e pelos atalhos, tela solo com créditos de 1.000/200 e nova tentativa após HTTP 503 simulado aprovados, sem erros JavaScript. Atalho de final não concedeu recompensa. Testes usaram contas e dados temporários; `.env` real, contas locais e backend existente preservados. Nenhum container reconstruído ou servidor remoto atualizado neste pedido.

### Uso do arquivo de ambiente no servidor Docker

- Conferido que `docker-compose.yml` repassa `GOOGLE_CLIENT_ID`, `PUBLIC_URL` e os parâmetros de boosters pelo bloco `environment`; o backend Docker recebe essas variáveis sem precisar copiar `.env` para a imagem.
- Consultada a documentação oficial do Docker Compose e orientado manter `.env` no servidor, junto de `docker-compose.yml`, preenchendo os valores e recriando o serviço com `docker compose --env-file .env up -d --force-recreate server`. A cópia do modelo deve preservar um `.env` já existente.
- Nenhum arquivo de ambiente modificado, container recriado ou servidor remoto acessado neste pedido.

### Username único e apelido separado no cadastro Google

- O primeiro acesso agora pede username único de 3 a 24 caracteres (letras, números, ponto, hífen ou sublinhado) e apelido/display name de 1 a 32 caracteres. O servidor rejeita usernames já ocupados com HTTP 409, sem distinguir maiúsculas de minúsculas; apelidos podem repetir e continuam sendo exibidos no jogo e no ranking.
- Username é escolhido uma vez e aparece como `@username` no perfil; o apelido continua editável. O cadastro obrigatório bloqueia o jogo até preencher ambos e mantém a mensagem de conflito e os campos para nova tentativa, sem permitir pular com Escape.
- Contas Google com identificador automático passam a escolher o username, preservando apelido, coleção, deck, saldo, rating, facção e sessões. Mantida a chave interna da conta; consultas administrativas e resultados de partidas usam a busca pelo username escolhido. Builds locais são copiadas para a nova identificação quando não existe um histórico nesse destino, mantendo o histórico anterior.
- Atualizados README, versões dos scripts no HTML e testes. As contas de teste usam chaves internas diferentes de seus usernames para verificar consultas administrativas, matchmaking e persistência.
- Validações: sintaxe de 63 arquivos JavaScript e `git diff --check` aprovados; 36 dos 38 testes funcionais aprovados, com as mesmas duas falhas preexistentes em `card-modal-layer.test.js` e `effect-events.test.js`. O teste Google cobre formato, campos obrigatórios, colisão sem distinguir maiúsculas, cadastros concorrentes, apelidos repetidos, username imutável, conclusão de cadastro existente, persistência e builds locais.
- Chromium/Playwright em desktop (1440 × 1000) e celular (390 × 844), com Google simulado e JWT assinado: dois campos, erro de username ocupado, apelido repetido, perfil com `@username`, limites da tela, Escape, restauração, segundo login sem recadastro e facção separada aprovados, sem erros JavaScript. Nenhum dado local real alterado, backend existente não reiniciado e login externo real não executado neste pedido.

### Exclusão manual de contas antigas no servidor

- Adicionado `server/delete-password-accounts.js`: usa `DATA_DIR` ou `server/data`, remove contas sem `googleSub` e sessões órfãs, mantendo os dados das contas Google. Valida os arquivos antes de alterar os dados e grava por arquivo temporário; repetir o comando sem contas antigas não regrava os arquivos.
- Documentados no README os comandos para Docker Compose e Node, com backend parado e cópia prévia dos arquivos de dados. O script está incluído na imagem pelo `COPY server` existente; a exclusão ocorre somente quando o comando é executado.
- Teste em diretório temporário aprovado: exclusão de conta/sessão de senha, preservação de coleção, deck, saldo, rating e sessão Google, repetição e recusa de JSON inválido sem alterar as contas.
- Nenhuma conta local ou de produção foi apagada. O backend local em execução não foi reiniciado; a imagem Docker e o login Google real não foram validados neste pedido.

### Acesso às contas somente pelo Google

- Removidos formulário, estilos e métodos do cliente para login/cadastro por senha, além do código de derivação e verificação de senhas no servidor. As rotas antigas retornam HTTP 410 com orientação para entrar pelo Google, inclusive quando o provedor não está configurado.
- Sessões persistidas de contas sem vínculo Google deixam de ser restauradas, bloqueando seu uso pela API e pelo matchmaking. Os dados dessas contas permanecem até a exclusão manual.
- Atualizados os textos do perfil, retirado o fluxo de facção exclusivo de contas por senha, renovadas as versões dos recursos no HTML e adaptados os testes de contas, perfil, boosters, ranking, multiplayer e apresentação para preparar contas Google em diretórios temporários.
- Validações: sintaxe de 63 arquivos JavaScript e `git diff --check` aprovados. Teste Google aprovado com assinatura real de JWT, bloqueio das rotas antigas e sessões legadas, persistência Google e interface sem opção por senha mesmo em caso de erro do provedor. Dos 38 testes funcionais, 36 aprovados; continuam as duas falhas preexistentes em `card-modal-layer.test.js` (mock sem `scene.bringToTop`) e `effect-events.test.js` (descrição de O Bom divergente), cujos arquivos envolvidos não foram alterados neste pedido.

### Diagnóstico de origem não autorizada no login Google

- Identificado na captura enviada o erro `400: origin_mismatch`, com o jogo aberto em `http://127.0.0.1:5500`. Consultada a documentação oficial: a origem do navegador precisa estar cadastrada nas origens JavaScript autorizadas do cliente OAuth utilizado.
- Conferido que o backend aceita origens locais `localhost` e `127.0.0.1`; essa permissão local não substitui o cadastro da origem no Google Cloud. Orientado cadastrar o endereço exato do Live Server ou acessar `localhost` com a porta já autorizada.
- Nenhuma configuração do Google Cloud alterada e nenhum login real validado neste pedido; a resolução depende de salvar a origem no cliente correto e repetir o acesso.

### Publicação do exemplo de ambiente

- Conferido o conteúdo atual de `.env.example`: contém parâmetros do jogo e um Client ID OAuth do Google, sem Client Secret, senha ou token. O Client ID é usado no navegador pela integração Google Identity Services.
- Adicionado `.env` ao `.gitignore`, que ainda não protegia esse arquivo. Preservados o exemplo de ambiente e os valores locais do usuário.
- Rechecadas as variáveis do exemplo após nova consulta: continuam restritas a parâmetros do jogo e `GOOGLE_CLIENT_ID`. Confirmados `.env` ignorado pelo Git e ausência desse arquivo entre os arquivos rastreados.
- Nenhum `.env` existente neste momento; nenhum segredo rotacionado e nenhuma alteração publicada no repositório remoto.

### Uso do exemplo de ambiente para ativar o login Google

- Conferidos `.env.example`, a ausência de `.env` e os comandos documentados para carregar o ambiente no servidor Node.
- Esclarecido que `.env.example` serve de modelo: a configuração local deve ficar em `.env`, com o Client ID real em `GOOGLE_CLIENT_ID`, e ser carregada com `node --env-file=.env server/server.js`.
- Nenhum arquivo `.env` criado, credencial preenchida ou login real executado neste pedido.

### Orientação para configurar OAuth no Google Cloud

- Conferidos o exemplo de ambiente, o login por callback do Google Identity Services, a validação no backend e o repasse de `GOOGLE_CLIENT_ID` pelo Docker Compose. Confirmada a ausência de `.env` local.
- Consultada a documentação oficial do Google para orientar a tela de consentimento, público externo, usuários de teste, cliente Web e origens JavaScript autorizadas. O fluxo atual dispensa Client Secret e URI de redirecionamento.
- Nenhuma credencial criada e nenhum login real executado neste pedido; a ativação depende da configuração no Google Cloud, do preenchimento de `GOOGLE_CLIENT_ID` em `.env` e do reinício do servidor.

### Orientação para testar o login Google localmente

- Conferidos os comandos de inicialização e a configuração `GOOGLE_CLIENT_ID` no README e no exemplo de ambiente. Confirmados Node.js 26.10.0 disponível e ausência de `.env` local.
- Orientado o teste em `http://localhost:3000`, com Client ID OAuth Web, origem autorizada e carregamento explícito de `.env`; o primeiro acesso pede nickname e os seguintes recuperam o perfil.
- Nenhuma credencial criada ou configurada e nenhum novo login real executado neste pedido; a configuração no Google Cloud continua necessária.

### Login Google e nickname no primeiro acesso

- Implementado login com Google via Google Identity Services e validação do ID token no backend pela biblioteca oficial `google-auth-library`. Verificados assinatura, destinatário, emissor, expiração e nonce; tentativas expiram em dez minutos e são de uso único, com limite de tentativas pendentes e restrição de origem.
- Novas contas Google pedem somente nickname de 1 a 32 caracteres, sem senha, foto ou facção no cadastro. A escolha é obrigatória e é retomada ao recarregar; salvar o nickname libera o menu. Facção e deck inicial são escolhidos separadamente ao abrir opções do jogo.
- Acessos seguintes recuperam nickname, coleção e sessão persistida. Contas Google são identificadas pelo `sub`, sem armazenar nome, email ou tokens do provedor e sem vincular contas antigas automaticamente. Mantido o login por senha das contas anteriores, com cadastro por senha removido da tela.
- Adicionados `GOOGLE_CLIENT_ID` ao exemplo de ambiente e ao Docker Compose, instruções no README e versões dos recursos no HTML para invalidar o cache. Perfil e menu mostram nickname e identificação da conta Google em vez do identificador interno.

### Validações e limitações

- Aprovado o novo teste executável `test/google-auth.test.js`, usando JWTs realmente assinados e a validação oficial, substituindo somente a obtenção dos certificados. Cobertos tokens forjados, assinatura incorreta, destinatário/emissor incorretos, nonce divergente, expiração, reuso, configuração ausente, origem recusada, nickname inválido, contas distintas, persistência após reinício, logout e interface com um único campo.
- Sintaxe dos 23 arquivos JavaScript e `git diff --check` aprovados. Executados os 37 testes funcionais: 35 aprovados e duas falhas preexistentes, em `card-modal-layer.test.js` (mock sem `scene.bringToTop`) e `effect-events.test.js` (descrição de O Bom divergente). Confirmado que os arquivos envolvidos nessas falhas não foram alterados por este pedido.
- Chromium/Playwright em 1440 × 1000 e 390 × 844: fluxo Google simulado com JWT assinado, primeiro acesso somente com nickname, bloqueio de Escape, limites da tela, restauração após recarga, segundo login sem repetir o cadastro e facção separada aprovados, sem erros JavaScript.
- Login externo com uma conta Google real e Docker não executados. Para ativar, falta configurar um Client ID OAuth Web e cadastrar as origens do frontend no Google Cloud. Tentativas em andamento ficam em memória e precisam ser repetidas se o servidor reiniciar; contas e sessões concluídas são persistidas.

## 2026-09-30

### Efeitos em ambas as fases do jogador

- Cartas de efeito agora podem ser arrastadas e usadas tanto na fase de colocar cartas quanto na fase de habilidades; personagens continuam restritos à fase de invocação.
- Corrigido o travamento ao usar Sugestão Algorítmica na fase de habilidades: a validação central aceitava o arraste, mas recusava a aplicação e deixava a seleção aberta.
- Renovadas as versões dos scripts no HTML.
- Validação: testes de regras e seleção aprovados; Playwright/Chromium usou Sugestão Algorítmica duas vezes em fases consecutivas, aguardando cada animação, sem erro JavaScript, seleção residual ou `travado` ativo. `git diff --check` e sintaxe aprovados.

### Visibilidade da mão durante efeitos

- A mão do jogador agora só é recolhida durante efeitos quando é o turno local; efeitos do adversário mantêm a mão visível.
- A mão permanece visível durante o evento da “Sugestão Algorítmica”.
- Efeitos de invocação também mantêm a mão visível.
- Durante a invocação, a mão e a consulta às cartas continuam interativas; novas jogadas e passagem de turno seguem aguardando o fim da fila.
- Validação: teste de passagem de turno ampliado para cobrir turno adversário, Sugestão Algorítmica, transições da mão, sintaxe e `git diff --check`; aparência em navegador não validada.

### Whoosh em toda troca de carta do menu

- Estendido o whoosh à navegação pelas cartas laterais e à troca de categoria, além do arraste já coberto. O clique permanece na carta central e nas ações, sem tocar junto do whoosh ao navegar.
- Navegação bloqueada nos limites e áudio desativado não produzem som. Renovada a versão do script do menu no HTML.
- Validação: testes do menu verificaram o arquivo de áudio disparado, navegação, arraste, limites, volume e limpeza; sintaxe e `git diff --check` aprovados. Sem nova avaliação auditiva ou execução de Playwright nesta alteração.

### Turnos, efeitos, áudio e builds salvas

- Finalizar jogada mantém a vez local até a confirmação do servidor e exibe “Confirmando jogada…”. Evitado o redesenho desnecessário que enviava outro estado antes de finalizar; recusas e respostas ausentes após 5 segundos liberam nova tentativa. O ACK inclui o estado confirmado como recuperação, sem reaplicar transições já recebidas; respostas antigas não retrocedem a fase.
- A confirmação de fim dos efeitos agora usa ACK e permite nova tentativa após falha. Durante animações e espera pelos efeitos remotos, a mão e os controles ficam ocultos e a entrada do campo fica bloqueada, com indicação de pausa no relógio.
- O Cão mantém somente uma penalidade pendente, inclusive ao consumir estados antigos com várias marcas. O texto da carta informa que o efeito não acumula.
- Restringido o consumo de cartas de efeito a cartas desse tipo realmente presentes na mão; perdas contabilizadas são de personagens e terrenos. Validados os gatilhos do bônus do Povo da Areia nos dois lados: morte de personagem, uso de carta de efeito e remoção de terreno; invocação, habilidade sem morte, compra, descarte da mão e recálculo não acionam seu bônus. Texto explicativo atualizado.
- Atualizações multiplayer filtram compras já presentes na mão; a simulação solo não reapresenta compras locais ao executar a IA.
- Aumentado o volume-base dos efeitos das cinco lendárias de 0,3 para 0,75, respeitando os controles gerais de áudio. Títulos e descrição da ficha lendária usam Arial. Restaurado o som `swipe-menu.mp3` ao concluir o arraste do carrossel.
- Deck Forge preserva a rolagem ao consultar cartas e adicionar/remover cópias, incluindo após ajustes de fonte; modal móvel fixado à janela. Adicionado menu “Decks salvos” com builds nomeadas, carregamento, exclusão com confirmação e suporte a rascunhos. As builds ficam neste navegador, separadas por conta; o deck ativo continua sendo definido ao selar o deck.
- Renovadas as versões dos recursos alterados no HTML. A voz do CyberVendedor foi retirada do escopo a pedido do usuário.
- Validação: 34 dos 36 arquivos de testes funcionais aprovados. As falhas de `card-modal-layer.test.js` (mock antigo da cena) e `effect-events.test.js` (descrição de O Bom divergente do documento) foram reproduzidas com os arquivos originais do HEAD. Sintaxe dos 23 arquivos JavaScript e `git diff --check` aprovados.
- Chromium/Playwright: desktop 1440×1000 e celular 390×844 mantiveram a rolagem em 800 px após abrir/fechar ficha e remover/adicionar carta; duas builds salvas e carregamento confirmado. Dois clientes concluíram 12 mudanças de fase e três rodadas, com seis animações de compras novas por cliente, sem repetição nas fases intermediárias. Outra partida confirmou mão oculta, input bloqueado e relógio em pausa durante efeito, seguida de quatro mudanças de fase. Nenhum erro JavaScript nesses fluxos.

### Tela de derrota após desistência

- Preservada a tela final quando chegam atualizações do servidor ou callbacks que tentam redesenhar o campo. A confirmação remota da desistência não apaga mais o aviso “VOCÊ PERDEU” já exibido localmente.
- Renovada a versão do script de jogo no HTML para atualizar o cache.
- Validação: novo teste de regressão verifica a derrota nas perspectivas dos jogadores 1 e 2, confirmação remota, redesenho tardio e ausência de duplicação do retorno automático. Testes de animações, sincronização e desempenho da cena aprovados, assim como sintaxe de `jogo.js` e `git diff --check`. Aparência em navegador não validada.

### Tiro azul do Agente da DIPSP

- Alterada para azul (`#3388ff`) a cor dos projéteis de plasma do Agente da DIPSP, incluindo sua habilidade quando aprendida por outra carta. O Juggernaut mantém seu plasma verde.
- Renovada a versão do script de efeitos no HTML para atualizar o cache.
- Validação: sintaxe de `efeitos.js`, testes de animações do oponente e `git diff --check` aprovados. Aparência em navegador não validada.

### Correção do bloqueio ao passar turno

- Impedido o envio de passagem de turno enquanto há animações locais/remotas ou o servidor aguarda a conclusão dos efeitos nos clientes.
- Uma passagem recusada no multiplayer agora restaura a vez, os controles e o timer com o prazo do servidor, permitindo tentar novamente. Respostas de outra fase ou cena não desbloqueiam a partida atual.
- Atualizadas as versões dos scripts no HTML para renovar o cache.
- Validação: teste de regressão de passagem de turno, animações do oponente, sincronização de estado e fluxo multiplayer aprovados; sintaxe de 23 arquivos e `git diff --check` aprovados. Utilizado Node 22.16.0 temporário em `/tmp`, pois Node não estava no PATH.
- Limitações: a suíte geral parou em `card-modal-layer.test.js` por ausência de `scene.bringToTop` no mock; reproduzido o mesmo erro com `jogo.js` original do HEAD. Interação em navegador não validada.

## 2026-09-29

### Espaçamento do nome no menu principal

- Aumentado em 3 px o espaçamento entre as letras de “CYBERDUEL” no menu principal, preservando a fonte e o contorno preto. Renovada a versão do CSS no HTML.
- Validação: conferida a regra CSS e aprovado `git diff --check`.

### Fundos alternados da batalha e contorno do menu

- Adicionado o vídeo de deserto ao preload. A primeira batalha escolhe cidade ou deserto aleatoriamente; as seguintes alternam sem repetir o último fundo na mesma sessão. Redesenhar o campo ou desligar/reativar a animação preserva o cenário da partida.
- Reforçado o contorno preto de “CYBERDUEL” no menu, com espessura proporcional e preenchimento preservado. Atualizadas as versões dos recursos no HTML.
- Validação: Playwright abriu duas batalhas consecutivas e confirmou deserto/cidade, vídeos reproduzindo sem áudio e ausência de erros JavaScript. Confirmado contorno preto nos dois trechos do nome (5,88 px na viewport de teste). Testes de desempenho da cena e assets, além de `git diff --check`, aprovados.

### Contorno preto no nome do jogo

- Aplicado traçado preto proporcional ao tamanho das letras no logotipo, identificação dos menus, arsenal e título da arena. O preenchimento fica acima do traçado para preservar a legibilidade e as cores atuais.
- Padronizado para preto puro o contorno já existente no nome da tela de carregamento. Renovadas as versões dos CSS e preload no HTML.
- Validação: Playwright confirmou contorno preto nos dois trechos do logotipo (4,25 px na viewport de teste), sem erros JavaScript; captura inspecionada. Teste de carregamento e `git diff --check` aprovados.

### Prioridades de interface, tempo, áudio, carregamento e fonte

- Reescritas instruções de seleção com quantidade de alvos, etapa da escolha e valores reais das habilidades (incluindo +3/+2 PA do Galo). Centralizados os painéis com quebra de linha e escala limitada; separados os avisos de cancelamento e contadores. Incluída a seleção de absorção no mesmo tratamento.
- Efeitos da fila visual agora pausam o relógio solo. No multiplayer, o servidor congela o restante, espera a conclusão nos dois clientes e recompõe o prazo; espectadores não podem liberar a pausa e existe limite de espera para evitar salas presas. Selecionar alvos continua consumindo tempo normalmente. Interface mostra “Efeitos • tempo pausado” e bloqueia novas ações durante a reprodução.
- Integrados sons existentes dos terrenos Torre/Beira/Nexus, Juggernaut, Dieh’Go, HumbaBrain e Professores, além de aquisição de alvo, interação e remoção. Auditados os 40 arquivos de som com decodificação FFmpeg sem erros; teste verifica existência dos assets e correspondência entre os perfis e o preload. Preservadas as alternativas `compra_carta.mp3`, `som-tigreataque.mp3` e `swipe-menu.mp3`; o menu mantém som de clique. Validação automatizada não substitui avaliação auditiva humana de volume e mixagem.
- As duas aberturas existentes são escolhidas aleatoriamente, evitando repetição consecutiva na mesma sessão, e alternam ao terminar. Corrigida a referência de transição para usar um vídeo existente em vez do arquivo ausente `transicaocerta.mp4`.
- Extraída a Rushblade do ZIP já presente no projeto, carregada localmente e aplicada aos títulos/botões e textos de destaque. Mantidas fontes legíveis para instruções e números; removida a dependência da fonte remota anterior. Atualizadas as versões dos recursos no HTML.
- Preservada a integração visual iniciada antes da repriorização: vídeos de HumbaBrain, Dieh’Go e Professores convertidos para WebM transparente, com os originais mantidos. A revisão geral dos efeitos visuais permanece para a próxima etapa, conforme solicitado.
- Playwright/Chromium: confirmados limites dos painéis, congelamento e retomada do relógio solo e de dois clientes online, alternância das aberturas inclusive após recarga, carregamento da fonte e acionamento dos sons de terrenos, HumbaBrain, Dieh’Go e Professores; os três vídeos novos reproduziram sem erros JavaScript ou HTTP. Usados cenários controlados com o motor real e decks de teste, servidor local na porta 3108 e dados isolados; sem publicação. Capturas e scripts em `/tmp/cyberduel-browser`.
- Validação: sintaxe aprovada e 32 dos 34 arquivos de teste aprovados. Permanecem as duas falhas preexistentes já documentadas (`card-modal-layer.test.js` e `effect-events.test.js`); os testes alterados de interface, assets, carregamento, sincronização e multiplayer passaram.

### Validação da Echossystem no navegador e correções visuais

- Instalados Playwright em `/tmp/cyberduel-browser` e Chromium no cache do usuário, sem adicionar dependências ao projeto. Executado servidor local na porta 3107 com dados isolados em `/tmp/cyberduel-browser/data`.
- Exercitados os 12 efeitos no Chromium headless com cenários controlados usando o motor e as cenas reais. Capturadas as perspectivas do dono, adversário (por inversão do estado sincronizado) e espectador; confirmadas face/PA visíveis para o dono e cartas adversárias viradas para baixo. Cliques reais confirmaram acesso à ficha própria e bloqueio da ficha inimiga oculta.
- Corrigido problema encontrado na captura: o emoji do coelho aparecia como caractere ausente. Substituído por um coelhinho desenhado com formas do Phaser, independente das fontes instaladas.
- Corrigidos os vídeos do Boi e da Aranha para dispararem somente na habilidade. Elevados os cortes de garra e os textos de PA acima dos símbolos para preservar sua visibilidade.
- Removido o fundo verde do vídeo original do Boi com FFmpeg (`colorkey=0x008000:0.18:0.08`), gerando `assets/efeitos/efeito-boi-alpha.webm` com canal alfa. Preservado o MP4 original; preload atualizado e transparência confirmada em captura do navegador.
- Confirmados reprodução dos vídeos da Aranha/Boi, acionamento dos sons, símbolos nos alvos, marca persistente da Aranha e plantio privado/disparo público do Macaco. As execuções completas dos cenários e da conferência final não registraram erros JavaScript nem respostas HTTP de falha. Capturas e scripts de automação mantidos em `/tmp/cyberduel-browser`; não foi realizada uma partida multiplayer entre dois navegadores nem avaliação auditiva humana.
- Aprovados os testes de animações (incluindo novo caso contra vídeos na invocação), eventos Echossystem, sincronização e assets (incluindo vídeo transparente), além de sintaxe dos scripts alterados e `git diff --check`. Renovadas as versões dos scripts no HTML. As duas falhas preexistentes da suíte registradas abaixo permanecem fora desta alteração; publicação não realizada.

### Toca do Coelho por perspectiva e visuais da Echossystem

- A Toca agora conserva face, PA e acesso à carta para seu dono, com borda rosa suave e um coelhinho; adversários e espectadores continuam vendo o verso das cartas ocultas. Atualizada a descrição em `Cartas e boosters.md` para registrar essa distinção.
- Substituída a apresentação genérica dos símbolos da Echossystem por revelação progressiva com respingos de tinta sobre os alvos, brilhos vermelhos e sons próprios. Rato destaca origem/alvo, Cabra destaca a troca, Cão marca a carta penalizada, Cobra marca o dano periódico e Galo marca os aliados beneficiados.
- Adicionados três cortes de garra nos alvos do Tigre, tremor nas cartas atingidas pelo Cavalo, vídeo transparente da Aranha em tela cheia e vídeo do Boi. A Aranha mantém seu símbolo sobre a carta enquanto o vínculo estiver ativo; a Toca exibe seu símbolo central ao entrar.
- A armadilha do Macaco usa o símbolo no espaço escolhido somente para seu autor; ao disparar, um evento público mostra a carta do Macaco após a invocação atingida. A Casca Grossa emite indicação visual/sonora quando impede uma redução abaixo do piso, inclusive com perda parcial de PA. Acrescentados os dados necessários aos eventos sincronizados, sem alterar os valores de dano.
- A resolução local deixa a animação de dano e remoção para a camada de eventos quando ela está disponível, evitando sobrepor o dano genérico aos efeitos específicos. Renovadas as versões dos scripts no HTML.
- Validação: 32 arquivos de teste aprovados na execução individual da suíte de 34, incluindo os novos casos de perspectiva da Toca, pichação, vídeos, sons, tremor, marcadores, armadilhas e proteção parcial do Porco. Duas falhas preexistentes reproduzidas com fontes do HEAD: `card-modal-layer.test.js` (mock sem `scene.bringToTop`) e `effect-events.test.js` (descrição de “O Bom” divergente do documento). Sintaxe dos scripts alterados e `git diff --check` aprovados. Usado Node temporário fora do repositório; reprodução visual/sonora em navegador e publicação não realizadas.

### Conferência das regras implementadas da Echossystem

- Comparados os 12 efeitos do Booster 2 em `Cartas e boosters.md` com os dados de `js/cartas.js` e a resolução em `js/main.js`. Nenhuma regra de jogo foi alterada nesta revisão.
- Confirmadas divergências numéricas: Cavalo causa 3 PA em vez dos 4 descritos; Macaco reduz 2 PA em vez de 5, com a redução também fixada diretamente em `Campo.adicionarCarta`.
- Identificadas diferenças e condições não especificadas: Tigre alcança toda a frente inimiga quando está na frente e aceita apenas um alvo; Cabra não troca com terrenos; Macaco exige espaço vazio e não dispara em terrenos; Aranha perde o vínculo se deixar de superar o PA do alvo; Boi reaplica auras após restaurar o PA e respeita bloqueios de aumento/redução.
- Conferidos por leitura os fluxos de roubo real de PA do Rato, penalidade na próxima invocação de personagem do Cão, piso de 6 PA do Porco, veneno acumulado por fonte da Cobra, bônus +3/+2 do Galo e ocultação da Toca. A Toca exclui terrenos e `Carta.buff` revela por tentativa de redução mesmo quando o piso do Porco impede a perda; a resolução de passivos não marca explicitamente a fonte como revelada.
- Pendências: esclarecer alcance curto, exigência de dois alvos, duração do Override, interação do reset com auras e gatilhos de revelação antes de tratar essas interpretações como regras definitivas. Testes de sincronização, eventos, animações e interações não executados: tentativa interrompida por `node: command not found`. Aparência e comportamento em navegador não validados.

## 2026-09-28

### Números das cartas orientados para cada jogador

- Girado em 180 graus o número de poder das cartas do campo superior exclusivamente na apresentação; o campo inferior mantém a orientação normal.
- Renovada a versão do script no HTML e publicados script e HTML no servidor, com backup e sem reiniciar partidas. Confirmados conteúdo atualizado e HTTP 200 no domínio público.
- Sintaxe, testes de layout da apresentação e espectador e `git diff --check` aprovados. Aparência não inspecionada em navegador; alterações ainda precisam ser registradas no Git para persistir nos próximos deploys.

### Mesa vertical, espera e turno orientado para o jogador

- Ajustada a preparação da apresentação à proporção original do jogo, com um QR code em cada extremidade: jogador 1 embaixo e jogador 2 em cima, girado 180 graus.
- Adicionados placares nas duas extremidades, com nome, poder, turno e rodadas na perspectiva de cada jogador. Na apresentação, o relógio mostra “Vez de [apelido]” e a fase atual, posicionado e girado para quem está jogando; removidos os rótulos duplicados do campo nesse modo.
- Criada uma tela de espera para o primeiro jogador conectado, com saída da sala e remoção automática ao iniciar o duelo.
- Aprovados testes de orientação do HUD, fases e jogadores ativos, tela de espera, apresentação do cliente, espectador, título e retorno à partida, além de sintaxe e `git diff --check`.
- Publicados HTML, CSS e scripts alterados no servidor, com cópia de segurança e sem reiniciar as partidas. Confirmados HTTP 200 e conteúdo atualizado na página e nos três arquivos públicos; aparência não inspecionada em navegador. Alterações locais e no checkout remoto ainda precisam entrar no histórico Git para persistirem nos próximos deploys.

### Correção do 404 no endereço da apresentação

- Confirmado no servidor público: `/apresentacao` já respondia 200, mas `/apresentação`, usado na captura, retornava 404.
- Adicionados redirecionamentos das variantes com acentos e barra final para `/apresentacao` no Nginx e no backend.
- Publicada a configuração Nginx por SSH, com cópia de segurança, validação `nginx -t` e recarga sem reiniciar o servidor de partidas. Atualizado também o arquivo Nginx no checkout remoto; as alterações ainda precisam entrar no histórico Git para preservar a correção nos próximos deploys.
- Verificadas as quatro variantes no domínio público: todas chegam à página de apresentação com HTTP 200. Teste de apresentação com redirecionamentos aprovado. Ajuste equivalente no backend validado localmente, sem republicar esse serviço.

## 2026-09-23

### Som somente ao clicar no menu

- Removido o som da navegação por arraste e da troca programática das cartas. O clique nas cartas, nas abas que alteram a seleção e no botão de ação reproduz `clique-menu.mp3`; cliques suprimidos após arraste permanecem silenciosos.
- Atualizada a versão da interface no HTML. Testes da tela inicial (cliques, arraste silencioso, volume e limpeza), sintaxe e `git diff --check` aprovados.

### Som ao trocar cartas do menu

- Integrado `assets/sons/clique-menu.mp3` à navegação das cartas por clique, abas e arraste confirmado, respeitando o volume de efeitos. Seleção da mesma aba e arrastes além dos limites não tocam o som.
- Reutilizado o elemento de áudio e interrompida sua reprodução ao sair do menu. Atualizada a versão da interface no HTML.
- Aprovados testes da tela inicial (trocas, volume, limites e limpeza), interface do matchmaking, sintaxe e `git diff --check`. Reprodução de áudio em navegador não verificada.

### Caracteres Matrix mudando durante a queda

- Cada coluna agora troca um caractere da trilha e sorteia o caractere da ponta a cada 180 ms, sem reiniciar a animação de queda.
- Atualização interrompida ao sair do menu; recriar a chuva limpa o temporizador anterior. Aba oculta e preferência por movimento reduzido suspendem as trocas.
- Renovada a versão da interface no HTML. Testes da tela inicial/Matrix (troca, preservação do comprimento, aba oculta e limpeza), interface do matchmaking, sintaxe e `git diff --check` aprovados. Aparência não verificada em navegador.

### Laterais dos atalhos e velocidade da chuva Matrix

- Estendido o fundo preto dos atalhos inferiores, incluindo Ajustes, até as bordas laterais do menu, mantendo o alinhamento dos botões.
- Acelerada levemente a chuva: duração de cada percurso reduzida de 12–26 segundos para 10–22 segundos, mantendo velocidades variadas entre colunas.
- Renovadas as versões do CSS e da interface no HTML. Aprovados testes da tela inicial/Matrix e interface do matchmaking, sintaxe e `git diff --check`; aparência não verificada em navegador.

### Cabeçalho preto no menu

- Aplicado fundo preto opaco ao cabeçalho com a versão `v1.0.0`, estendido às laterais e ao espaço superior do menu para cobrir a chuva Matrix nessa região.
- Renovada a versão do CSS no HTML. Testes da tela inicial e Matrix e `git diff --check` aprovados; aparência não verificada em navegador.

### Rodapé preto até a borda inferior

- Transferido o espaçamento inferior do menu para o painel preto de status, que agora ocupa também o espaço livre restante e se estende às bordas laterais. Isso cobre a faixa abaixo de “Conectado ao servidor” onde os caracteres ainda apareciam.
- Renovada a versão do CSS no HTML. Testes da tela inicial e Matrix e `git diff --check` aprovados; aparência não verificada em navegador.

### Fundo preto no status da conexão

- Aplicado fundo preto opaco à área de status, incluindo “Conectado ao servidor”, para cobrir os caracteres Matrix atrás da mensagem.
- Renovada a versão do CSS no HTML. Testes da tela inicial e Matrix e `git diff --check` aprovados; aparência não verificada em navegador.

### Fundo opaco nos atalhos inferiores

- Aplicado fundo preto opaco ao submenu inferior de atalhos, incluindo Ajustes, para encobrir os caracteres Matrix atrás dos botões e dos espaços entre eles.
- Atualizada a versão do CSS no HTML. Testes da tela inicial e Matrix e `git diff --check` aprovados; aparência não verificada em navegador.

### Menu preto com caracteres Matrix maiores

- Removidos a imagem anterior e os gradientes decorativos do fundo do menu de modos; aplicado preto puro atrás da chuva Matrix.
- Aumentado o tamanho responsivo dos caracteres de `clamp(9px, 2.2cqw, 24px)` para `clamp(14px, 3.4cqw, 36px)` e renovada a versão do CSS no HTML.
- Testes da tela inicial e Matrix e `git diff --check` aprovados. Aparência não verificada em navegador.

### Correção: chuva Matrix no menu de modos

- Removida a chuva de caracteres da cena de partida e adicionada ao fundo do menu principal, onde são selecionados os modos de jogo, conforme esclarecimento do usuário.
- Adaptada para 24 colunas DOM com animação CSS, velocidades variadas, caracteres verdes e ponta clara. A camada fica atrás dos controles, não captura cliques e é removida ao sair do menu; respeita a preferência do sistema por movimento reduzido.
- Atualizadas as versões dos arquivos no HTML. Aprovados testes da tela inicial (incluindo colunas e ausência do efeito na partida), desempenho da cena e interface do matchmaking, além de sintaxe e `git diff --check`. Aparência não verificada em navegador.

### Chuva de caracteres Matrix no fundo da partida

- Examinadas `criarChuvaCaracteres` e `atualizarChuvaCaracteres` de `src/Scenes/CenaStart.js` no repositório S.N.R-Soul-Network-Reborn indicado pelo usuário. Implementada adaptação com 24 colunas verdes de letras, números e katakana, velocidades variadas, ponta clara e troca periódica de caracteres.
- Chuva exibida sobre o vídeo da cidade e atrás do campo, com transparência para preservar a leitura. Os 48 objetos de texto são reutilizados nos redesenhos; a opção de desativar o fundo libera também a chuva, e a reentrada na cena reinicializa sua referência.
- Atualizada a versão da cena no HTML. Aprovados testes de desempenho da cena, animações do oponente e sincronização, sintaxe e `git diff --check`. Teste específico cobre reutilização, movimento, limite após pausas, troca dos caracteres, retorno ao topo e desativação. Aparência em navegador e desempenho em celular físico não verificados.

### Identidade visual verde

- Convertidos os tons ciano e azul-ciano definidos em CSS e JavaScript para verde, preservando luminosidade, saturação e transparência. Destaque principal alterado para `#23ff6c`, com a variável `--forge-accent` substituindo `--forge-cyan`.
- Atualizados menus, montador de decks, perfil, leaderboard, carregamento, painéis da partida e efeitos desenhados pelo Phaser, incluindo bordas, brilhos, sombras, gradientes e cores de destaque das cartas.
- Renovadas as versões dos sete arquivos visuais no HTML e ajustada a expectativa de cor do fundo no teste da cena.
- Aprovados testes de carregamento, animações do oponente, desempenho da cena, tela inicial, interface do matchmaking e sincronização, além de sintaxe e `git diff --check`. Varredura confirmou ausência dos tons da faixa convertida nas cores de CSS/JavaScript próprios.
- Cores incorporadas a imagens e vídeos permanecem nas artes originais. Aparência e contraste não verificados em navegador nesta alteração.

### Prioridade do vídeo na abertura

- O carregamento dos assets agora começa após o primeiro frame do vídeo de abertura. A tela permanece por pelo menos um segundo após esse início, inclusive com os arquivos em cache.
- Erro de vídeo libera o carregamento; espera máxima de dez segundos evita bloquear a aplicação quando a reprodução não inicia. Mantido o acesso direto ao deck e atualizada a versão do preload no HTML.
- Aprovados testes de carregamento (ordem, cache quente, erro, timeout e saída), assets, sintaxe e `git diff --check`. Reprodução real no navegador não verificada nesta alteração.

### Título na tela de carregamento

- Adicionado “CYBERDUEL” centralizado na parte superior do vídeo de carregamento, com texto branco, contorno escuro e brilho ciano.
- Atualizada a versão do preload no HTML. Teste do carregamento, sintaxe e `git diff --check` aprovados; aparência não verificada em navegador.

### Tela de carregamento EchoRasp

- Integrado `assets/videos/carregamento_echorasp.mp4` ao carregamento inicial, em loop sem som e com ajuste proporcional para cobrir a tela. A barra e o percentual permanecem sobre um painel escuro na parte inferior.
- O vídeo carrega diretamente, sem depender da fila de assets; é interrompido ao sair da cena. Falhas no vídeo não impedem o progresso nem a entrada no menu, e o atalho `?deck=1` foi preservado.
- Atualizada a versão do preload no HTML. Aprovados testes do vídeo de carregamento e assets, sintaxe e `git diff --check`. ffprobe confirmou H.264, 1080×1920 e 8 segundos; reprodução visual em navegador não verificada nesta alteração.

### Aguardar os efeitos do oponente antes de agir

- Adiada a liberação local da vez até terminar o último efeito visual do oponente, incluindo os eventos aguardando na fila, tanto contra a IA quanto no multiplayer.
- Bloqueados os comandos de jogar cartas, usar habilidades e passar durante os efeitos remotos. Atualizações multiplayer recebidas durante a espera substituem a liberação pendente, preservando a fase mais recente.
- Atualizada a versão da cena de jogo no HTML. Teste reproduz dois efeitos sequenciais, bloqueio dos comandos, liberação única e atualizações recebidas durante a espera.
- Aprovados testes de animações do oponente, sincronização e desempenho da cena, sintaxe e `git diff --check`. Sem validação visual em navegador; o prazo multiplayer permanece controlado pelo servidor e não ganha tempo adicional durante a espera local.

### Fundo da partida com vídeo da cidade

- Substituído o vídeo `parte_3-720p.mp4` por `assets/videos/background_cidade.mp4` no carregamento do fundo da partida, preservando reprodução em loop, sem som, ajuste proporcional e opção de desativar a animação.
- Atualizada a versão do preload no HTML para renovar o cache e ajustado o teste de assets para conferir o novo arquivo.
- Aprovados testes de assets, desempenho da cena e configurações, sintaxe do preload e `git diff --check`. Vídeo confirmado com ffprobe: H.264, 1080×1920, 8 segundos, 3,15 MiB; substitui o anterior de menos de 2 MiB. Reprodução visual e desempenho em celular não verificados nesta alteração.

### Fotos de perfil na leaderboard e Juggernaut

- A leaderboard agora mostra a foto de perfil ao lado do apelido, com miniatura circular e iniciais para jogadores sem foto.
- Confirmada a disponibilidade de `juggernaut_icon.png` no catálogo automático existente; o teste de perfil passou a validar explicitamente sua presença, salvamento e persistência após reiniciar o servidor.
- Atualizadas as versões do CSS e da interface no HTML para renovar o cache.
- Aprovados os testes de interface do matchmaking/leaderboard, perfil e tela inicial, além da verificação de sintaxe e `git diff --check`. Layout visual não verificado em navegador nesta alteração.

### Novos símbolos de efeitos da EchoSsystem

- Integradas ao carregamento as doze imagens novas de `assets/efeitos`: Aranha, Boi, Cabra, Cão, Cavalo, Cobra, Coelho, Galo, Macaco, Porco, Rato e Tigre.
- Ligados Aranha, Boi, Cabra, Rato e Tigre às habilidades; Cobra à habilidade e ao dano de veneno; Cão e Porco às passivas; Cavalo, Galo e Macaco às conjurações; Coelho à invocação do terreno.
- Cada evento exibe um símbolo proporcional com expansão suave e desaparecimento, aproveitando a fila existente. O objeto é destruído ao concluir; fontes ocultas não revelam símbolos identificáveis e habilidades aprendidas usam o símbolo correspondente.
- Atualizadas as versões do preload e da cena de efeitos no HTML. Aprovados testes de assets, animações, cena, sincronização e habilidades, além de sintaxe e `git diff --check`.
- No Chromium móvel simulado foram carregadas as doze texturas e reproduzidos os doze símbolos em sequência, com tamanho limitado, proporção preservada e objetos liberados ao concluir, sem exceções JavaScript. Desempenho em celular físico não medido.

### Fundo opcional e placar abaixo do campo

- Adicionada a opção “Fundo animado da partida” nas configurações e as ações “Desativar fundo”/“Ativar fundo” no menu do duelo. A preferência fica salva no aparelho e pode ser aplicada pela função `definirFundoAnimado(ativo)` da cena.
- Desativar destrói o objeto de vídeo e usa fundo escuro; redesenhos e novas partidas respeitam a escolha. Reativar recria o vídeo, e restaurar configurações liga a opção novamente.
- Rebaixado o painel de turno e rodadas em aproximadamente 62 unidades no layout normal. Sua posição agora acompanha a borda inferior do campo, mantendo distância também no layout ampliado.
- Aprovados testes de configurações, cena, tela inicial, resolução e sincronização; sintaxe e `git diff --check` sem erros. No Chromium móvel simulado foram verificadas a opção nas configurações, ativação/desativação pelo menu, persistência em nova partida e a posição do placar sem sobreposição, sem exceções JavaScript.
- Atualizadas as versões dos scripts e do CSS no HTML para renovar o cache.

### Reutilização de objetos e limpeza da cena de jogo

- Os vinte fundos de vidro do campo agora são reutilizados entre jogadas e recriados apenas quando o layout muda. Cartas, áreas de toque e indicadores dinâmicos continuam sendo renovados normalmente.
- A CenaJogo só encaminha o histórico de efeitos quando há um evento novo; a cena de efeitos deixa de varrer os objetos do campo quando não há invocações pendentes nem cartas a restaurar.
- Consolidada a criação dos oito sons da partida e adicionada sua destruição ao sair da cena. Centralizada a remoção dos listeners da descrição e reiniciado o controle de gestos a cada nova partida.
- Removidos três métodos sem chamadas e um listener de movimento sem efeito. Evitada conversão repetida de coordenadas durante a rolagem. `jogo.js` ficou 250 linhas e 6.341 bytes menor, sem dividir o arquivo em novos módulos.
- Novo teste comprova reutilização em cinquenta redesenhos, recriação ao trocar o layout, envio apenas de eventos novos, ausência de varredura ociosa e limpeza seletiva dos listeners.
- No Chromium móvel simulado foram validados dez redesenhos mantendo campo e vídeo, dez slots sem duplicação, troca entre os layouts, abertura/fechamento da ficha, reinstalação dos gestos e quantidade estável de sons ao iniciar a segunda partida, além da rotação sem exceções JavaScript. Ganho de FPS em aparelho físico não medido.
- Aprovados 27 dos 29 testes. Permanecem as duas falhas anteriores: `card-modal-layer.test.js` usa um mock sem `bringToTop`, e `effect-events.test.js` diverge da descrição documental de O Bom. Sintaxe das cenas e `git diff --check` aprovados.
- Atualizadas as versões das duas cenas no HTML; preservados os ajustes locais de resolução móvel do pedido anterior.

### Redução do custo de renderização no celular

- Corrigido o aumento automático da resolução em celulares de alta densidade: o padrão móvel fica em 720×1480, em vez de chegar a 1080×2220. São 55,6% menos pixels por frame no caso máximo anterior, mantendo mais definição que o antigo perfil de 480×987.
- Limitada a renderização móvel a 60 FPS para evitar trabalho adicional em telas de 90/120 Hz. Mantidos `?quality=high` para maior resolução e `?quality=mobile` para o perfil econômico.
- Atualizada a versão de `main.js` no HTML para renovar o cache. A foto nova foi dispensada pelo usuário; nenhuma alteração no catálogo.
- Aprovados testes de resolução, viewport, habilidades, sincronização e animações do oponente; sintaxe e `git diff --check` sem erros.
- Confirmados no Chromium com tela móvel simulada e DPR 3: canvas de 720×1480, limite real do Phaser em 60 FPS, abertura da partida e da ficha, dez slots e rotação sem exceções JavaScript. A redução de pixels foi verificada; ganho de FPS em aparelho físico não foi medido.

## 2026-09-22

### Nitidez no celular, versão e simplificação da cena

- Substituída a redução automática para 480×987 por resolução ajustada à densidade e à área da tela, entre 720×1480 e 1080×2220 no layout atual. Mantido `?quality=mobile` como opção econômica explícita; desativado o arredondamento de posições para suavizar movimentos.
- Substituído o “CD” do topo por `v1.0.0`, correspondente ao `package.json`, com apresentação discreta e sem moldura.
- Limitada a reavaliação visual das auras de habilidade a uma vez a cada 100 ms, evitando recalcular alvos em todos os frames e atualizar a visibilidade sem mudança. Eventos de efeitos e relógios continuam no fluxo por frame.
- Reescritos comentários extensos em linhas simples nos arquivos próprios de JavaScript, CSS e HTML; preservadas bibliotecas de terceiros. A limpeza inicial retirou 59.464 bytes de JavaScript e teve a equivalência estrutural do código verificada antes das mudanças funcionais. A cena de jogo ficou aproximadamente 39 KB menor.
- Atualizadas as versões dos assets no HTML. Sintaxe de 22 arquivos próprios e `git diff --check` aprovados; equivalência estrutural confirmada em 19 arquivos sem mudanças funcionais.
- Aprovados 26 dos 28 testes, incluindo resolução por densidade, limite de pixels, perfil econômico, frequência das auras, contas e multiplayer. Confirmadas também no código anterior as falhas de `card-modal-layer.test.js` (mock sem `bringToTop`) e `effect-events.test.js` (descrição de O Bom divergente do documento).
- Validado no Chromium com tela móvel simulada de 390×844 e DPR 3: canvas de 1080×2220, versão no menu, abertura da partida, dez slots do jogador, ficha e rotação para paisagem, sem exceções JavaScript. Desempenho em aparelho físico não medido.

### Correção da inicialização do servidor no Docker

- Confirmado nos logs o erro `ENOENT` ao ler `/app/assets/fotosdeperfil`: o catálogo passou a ser obrigatório na inicialização, mas não era copiado para a imagem do servidor.
- Adicionada a cópia de `assets/fotosdeperfil` ao `docker/Dockerfile.server`.
- Executado `docker compose up -d --build` com sucesso. Servidor e Nginx saudáveis, Caddy em execução, `/health` retornando `ok: true` e presença das 20 fotos confirmada dentro do container, incluindo RaspClay e Boi.

### Galeria de perfil recolhida com três fotos por linha

- A grade agora exibe três fotos por linha e começa oculta. Clicar na foto atual abre ou recolhe as opções; escolher uma foto atualiza a prévia e fecha a grade, mantendo o salvamento pelo botão de perfil.
- Foto atual convertida em botão acessível por teclado, com indicação de expansão. Atualizada a versão dos assets para renovar o cache.
- Sintaxe de `js/title-ui.js`, teste de perfil e `git diff --check` aprovados. Comportamento visual não verificado em navegador nesta sessão.

### Fotos de perfil restritas ao catálogo

- Substituído o upload por uma galeria com as 20 imagens de `assets/fotosdeperfil`, com prévia e indicação da seleção. O servidor fornece o catálogo e rejeita imagens externas, uploads em base64 e caminhos não autorizados.
- A escolha inicial de RaspCorp define `raspclay_icon.png`; Echossystem define `boi_icon.png`. Depois, o jogador pode escolher outra foto do catálogo.
- Fotos antigas fora do catálogo são substituídas ao carregar a conta pela imagem da facção; contas sem facção ficam sem foto até escolherem uma. Preservadas fotos já permitidas e alterações locais dos assets.
- Atualizadas as versões dos scripts e do CSS para renovar o cache. Teste de perfil aprovado, cobrindo catálogo completo, acesso às imagens, rejeições, facções, persistência e contas antigas; sintaxe dos 23 arquivos JavaScript validada. Testes de matchmaking, interface de matchmaking e multiplayer aprovados; `git diff --check` sem erros.
- Limitação: a suíte geral `npm test` interrompeu no teste de cartas `test/card-modal-layer.test.js`, com `this.scene.bringToTop is not a function`, em código não alterado nesta entrega. Interface não verificada em navegador nesta sessão.

### Instalação do Ponytail e conferência do Caveman

- Instalado o plugin Ponytail 4.10.0 no ambiente pessoal do Codex, a partir do marketplace oficial `DietrichGebert/ponytail`.
- Baixada a skill Caveman de `JuliusBrussee/caveman` para comparação: o `SKILL.md` instalado já corresponde ao repositório. Preservados os arquivos locais existentes.
- A ativação do Ponytail em uma nova sessão e a revisão/confiança dos hooks pelo usuário ainda estão pendentes; não foram executados testes funcionais dos hooks nesta sessão.

### Verificação de disponibilidade do Caveman

- Consultado o catálogo de plugins: nenhum resultado para Caveman. Confirmada a presença local da skill `caveman` em `/home/dante/.agents/skills/caveman`, já disponível nesta sessão.
- Nenhum plugin novo instalado; instalação do plugin depende da identificação de sua fonte de distribuição.

### Ficha de carta sem rótulos extras

- Removidos “Sobre a carta”, “Arraste para ler” e a identificação “PA” do selo. O número agora fica centralizado; a descrição aproveita o espaço liberado pelo cabeçalho, mantendo o fundo e a rolagem quando necessária.
- Atualizada a versão do script da CenaJogo para renovar o cache. Sintaxe JavaScript e `git diff --check` validados.

### Selo de PA e descrição das cartas

- Substituído o círculo preto de poder por um selo arredondado de vidro, reflexo suave, detalhe rosado e número claro; tamanhos maiores exibem a identificação PA. O componente é compartilhado pelas cartas e suas visualizações na CenaJogo.
- Ampliada a ficha comum de carta e reorganizados cabeçalho, arte e título. A descrição recebeu fundo escuro independente, bordas suaves, margens internas, título e maior separação entre história e efeito.
- A descrição longa indica que pode ser arrastada. Área de toque e barra de rolagem ficam fixas fora do texto mascarado, mantendo o indicador visível durante a leitura. Atualizada a versão do script no HTML.
- Validados no Firefox headless o NeoAnalista, texto em 112% e 135%, telas de 430×932 e 360×780 e rolagem por arraste, sem erros JavaScript. Testes de habilidades, seleção da mão e resolução aprovados; sintaxe e `git diff --check` sem erros.

### Interface minimalista com vidro translúcido na CenaJogo

- Reformulada exclusivamente a interface do duelo: superfícies arredondadas, transparência, reflexos discretos e bordas finas nos espaços do campo, cronômetro, placar, contadores, menu de ações, histórico, detalhes de cartas e confirmação de desistência. Menu inicial e editor de deck não foram alterados.
- Removida a grade decorativa sobre o vídeo; aplicada uma camada de contraste. Textos da interface usam fonte sem serifa e dispensam contornos pesados. Contadores de poder mantêm tamanho estável, e os avisos do cronômetro continuam diferenciando jogador, oponente, pausa e tempo crítico.
- Ampliadas áreas de toque dos controles reformulados e simplificados os rótulos das ações. Corrigido o posicionamento da área clicável da paginação do histórico e separado o nome da carta dos dados de turno/jogador. Botões de habilidade e retorno ao menu receberam o mesmo material visual.
- Preservadas as dimensões das áreas de colocação das cartas, regras e fluxos da partida. O vidro é uma simulação por camadas vetoriais do Phaser, sem refração ou desfoque em tempo real. Atualizada apenas a versão do script da CenaJogo no HTML para renovar o cache.
- `npm test` aprovado: sintaxe de 23 arquivos e 27 testes funcionais. Conferidos no Firefox headless: menu, histórico, paginação, detalhes, arraste para o campo, cancelamento de desistência, mão recolhida, conclusão de jogada e resultado final, sem erros JavaScript. Capturas verificadas em desktop e celular, incluindo escala de texto de 135%; validação em aparelho físico não realizada.

## 2026-09-19

### Queda imediata ao buscar partida na imagem Docker

- Reproduzido erro `ENOENT` ao carregar as regras de duelo na imagem de produção: o Dockerfile não copiava `js/deck-builder.js`. A busca autenticada carrega esse módulo para validar o deck; a exceção encerra o backend e derruba as conexões.
- Incluído `js/deck-builder.js` na imagem do servidor. A construção agora carrega `server/duel-runtime.js` para rejeitar imagens sem os arquivos necessários às regras de duelo.
- Imagem reconstruída com sucesso. Teste em container isolado com duas contas validou login, escolha de facção, busca, cancelamento e formação de partida ranqueada, mantendo as conexões e `/health` ativos. `node test/matchmaking.test.js` aprovado.
- Publicação e conferência no servidor hospedado pendentes; é necessário reconstruir o serviço `server` com o Dockerfile atualizado.

### Sessão preservada na busca de partida aleatória

- Reproduzida perda de autenticação após reiniciar o backend: token antes válido retornava 401, enquanto uma página aberta podia continuar exibindo a conta conectada. Esse mecanismo foi confirmado localmente; a causa no servidor publicado não foi verificada diretamente.
- Sessões agora persistem em `DATA_DIR/sessions.json`, usando hashes dos tokens e gravação por substituição de arquivo. Mantidos prazo de sete dias e revogação por logout; o volume existente do Compose preserva os dados entre reinícios da instância única.
- Busca aleatória sinaliza sessão inválida com código próprio e limpa a conta exibida no cliente, orientando novo login. Erros de deck e timeout não limpam a sessão. Atualizada a versão do script multiplayer para renovar o cache.
- `npm test` aprovado: sintaxe de 23 arquivos e 27 testes funcionais. Regressões cobrem autenticação e entrada na fila após reinício, logout persistente, expiração, ausência de token em texto puro no arquivo e atualização do estado do cliente.
- Publicação e validação no servidor hospedado pendentes. Documentado no README o comando de atualização e a necessidade de entrar novamente uma vez para sessões da versão anterior, que existiam apenas na memória. Filas e partidas continuam em memória.

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
