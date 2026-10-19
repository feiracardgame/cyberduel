# Artes dos encontros

Direção visual: refinamento das vinhetas existentes. O trio adota a composição de um cartaz italiano de faroeste dos anos 60, conforme a referência fornecida: papel claro, molduras pretas em alturas diferentes, ilustração pintada e títulos vermelhos de impressão. Os três personagens mantêm suas identidades e recebem paisagens próprias dentro do cartaz. Os duelos mantêm os retratos e usam cenários exclusivos.

Aplicação da skill design-taste-frontend: DESIGN_VARIANCE 7 (assimetria do cartaz), MOTION_INTENSITY 5 (entrada dos retratos, combate existente e aproximação lenta do pôster), VISUAL_DENSITY 3 (arte em destaque). A tipografia serifada e o papel claro pertencem à referência vintage, dentro da apresentação escura do jogo. Implementação nativa no Phaser; sem novas bibliotecas.

Na auditoria, o trio anterior era apresentado em três faixas iguais, com recortes semelhantes e fundo marrom plano. Os duelos usavam fundo chapado azul-escuro. A revisão concentra a composição do trio em uma imagem inteira e troca os fundos das três duplas. A fila de efeitos, os gatilhos e as frases de ataque são preservados.

## Assets finais

| Arquivo | Uso |
| --- | --- |
| `cinematicas/poster-trio.webp` | Pôster completo de O Bom, O Mau e O Feio; sem recortar personagens ou títulos |
| `cinematicas/fundo-boi-raspclay.webp` | Praça entre o distrito industrial e a cidade corporativa |
| `cinematicas/fundo-tigre-dipsp.webp` | Rua industrial molhada, portões de segurança e iluminação azul/vermelha |
| `cinematicas/fundo-bom-mau.webp` | Povoado nos Ermos ao pôr do sol, com desfiladeiros ao fundo |

As quatro artes foram geradas com a ferramenta image_gen integrada. Os PNGs originais estão em `output/sindicato/art-direction/originais/`; as imagens usadas pelo jogo foram exportadas em WebP, mantendo as dimensões originais, totalizando aproximadamente 2,22 MiB. Os prompts exatos estão em [cinematicas/PROMPTS.md](cinematicas/PROMPTS.md).

O cartaz ocupa até 94% da largura e 88% da altura lógica, sempre preservando a proporção. A sequência de 4,4 segundos revela a impressão de cima para baixo, corrige uma leve inclinação e aproxima o cartaz antes da saída. Movimento reduzido mostra a imagem inteira, sem recorte, zoom ou rotação.

Os duelos revelam o cenário, trazem os retratos em tempos diferentes e apresentam nomes e VS. Boi/RaspClay e Bom/Mau permanecem em confronto por 2,8 segundos. DIPSP/Tigre tem uma sequência de 3,5 segundos com quatro movimentos alternados dos retratos e áudio sincronizado, sem projéteis ou garras desenhadas. A frase corresponde à fonte original. Movimento reduzido preserva o cenário, os retratos e a frase, com entrada por opacidade.

Todas as vinhetas bloqueiam jogadas e consultas, inclusive quando antecedem uma invocação. A ação normal continua uma única vez após a saída. Timers, tweens, sons criados pela sequência, objetos e listeners são cancelados ao terminar ou fechar a cena. A escolha de alvos também impede abrir outra ficha de carta.

Para conferir o resultado, execute `npm run test:interactions:browser`. O Playwright aciona as habilidades por toques no botão e no alvo e invoca o Feio da mão entre Bom e Mau. Verifica movimento, revelação, cenário, enquadramento, áudio real, bloqueio/liberação da interface, evento único, movimento reduzido e saída durante uma vinheta. Capturas, vídeo `animacoes.webm` e relatório ficam em `output/sindicato/interactions/`; a variável `INTERACTIONS_TEST_OUTPUT` permite outra pasta. A versão animada validada desta revisão está em `output/sindicato/interactions-verified/`.

As três duplas (Boi/RaspClay, Tigre/DIPSP e Bom/Mau) só ativam a vinheta quando um personagem usa sua habilidade diretamente no outro, como alvo selecionado e visível. Invocações não ativam esses encontros. O trio mantém o gatilho do bônus de adjacência.

## Cópia absoluta — Estudante e Professores

Ao copiar a habilidade de **Professores de Duelo**, o Estudante apresenta uma sequência exclusiva com `sarda_asset.png` à esquerda, `felipe_asset.png` à direita e `aluno_asset.png` em primeiro plano. Os PNGs originais são preservados. A sala de aula cyberpunk em `cinematicas/fundo-aprendizado.webp` foi gerada com image_gen integrada e convertida para WebP (aproximadamente 487 KiB); o prompt exato está em [cinematicas/PROMPTS.md](cinematicas/PROMPTS.md).

A vinheta dura 6,8 segundos, com saída de 280 ms: entrada dos três personagens e dos títulos, aproximação do cenário, portal giratório, dois fluxos de conhecimento com partículas, aura do aluno, ondas de impacto e confirmação da habilidade assimilada. Usa Graphics e tweens nativos do Phaser, os sons existentes dos Professores e da explosão e o som do Estudante na retomada da ação. Timers, tweens, objetos e sons da vinheta são limpos ao terminar ou sair da cena.

O gatilho exige a ação original de aprender, com os Professores como alvo aliado, selecionado e visível. Copiar outra carta, invocar os personagens ou usar a habilidade já aprendida não repete a cena. Custo de 2 PA, aprendizado permanente, fila de efeitos e perspectivas online são preservados. Movimento reduzido usa uma composição estática com entrada e saída por opacidade, sem deslocamentos, zoom, partículas, tremor ou ondas; dura 2,6 segundos mais a saída.

Execute `npm run test:learning:browser` para ativar a cópia por toques reais em celular e desktop, conferir a fila, o retorno da interface, movimento reduzido e saída durante a transferência. Capturas, relatório e vídeo ficam em `output/sindicato/aprendizado/`; os testes usam dados temporários.
