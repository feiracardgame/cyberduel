# Histórico de alterações — Cyberduel

Novidades, correções e verificações realizadas no projeto. As entregas mais recentes aparecem primeiro.

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
