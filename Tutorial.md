Descrição de como será feito o tutorial do jogo


-> os sprites estão sendo contados, na spritesheet, da esquerda para a direita e de cima para baixo, no sentido de leitura convencional

"indica fala"

- indica instruções sobre qual sprite utilizar e quem está falando

-> indica evento ou detalhe

*indica o fundo*

# Fala inicial

-> A fala inicial deve aparecer apenas na primeira vez que a pessoa acessa o jogo

*Fundo da tela inicial do menu escurecida, sem as cartas, com o sprite aparecendo no canto direito*

- ???? (sem sprite): "Huh, quem está aí?"
- ???? (sprite 2): "Ah, perdão, eu não esperava novos visitantes. Eu sempre acreditei que todos já tinham se mudado para cá."
- ???? (sprite 13) "Espera, esses dados..."
- ???? (sprite 9) "Você é de 2026?! Incrível, um cyberduelista de outra época!"
-> Abre prompt para escolher duas opções:
      - "Cyberduelista?"
      - "outra época?"

-> Ambas as opções levam à mesma fala

- ???? (sprite 6) -> "Sinto muito, deveria ter te explicado..."
- ElenAI (sprite 4) -> "Eu me chamo ElenAI, uma IA criada pelo nosso grande criador Humba Brain para receber as pessoas e ensiná-las sobre o jogo mais importante da era moderna: o Cyberduel."
- ElenAI (sprite 14) -> "Nós somos de 2067 e vivemos em uma simulação chamada NeoFloripa. Aqui, todas as decisões políticas, econômicas e sociais são determinadas pelo Conselho, o órgão formado pelos melhores jogadores de Cyberduel."
- ElenAI (sprite 15) -> "O objetivo é abrir mão da chatice burocrática que existe no seu mundo e época, dando poder só para quem tem habilidade e deixando a sociedade muito mais divertida!"
- ElenAI (sprite 2) -> "Como o mundo real estava muito chato e totalmente automatizado ou destruído pela mudança climática, como o caso da antiga Floripa, todos decidiram se mudar para esse novo mundo!"
- ElenAI (sprite 16) -> "Nós, IAs, ficamos muito felizes em finalmente termos companhia. Já que, graças ao nosso criador, não existe mais distinção entre o mundo real e o virtual."
- ElenAI (sprite 10) -> "Enfim, vamos deixar de papo furado, me fala seu nome, quero saber mais sobre você."

-> Abre tela para escrever o nick do jogador


- ElenAI (sprite 3) -> "Agora me diga, você deseja entender o que é o Cyberduel para poder lutar pelo seu espaço no conselho?"

-> Abre prompt para escolha:
    - sim
    - não

  -> se escolher "não"

- ElenAi (sprite 17) - "humpf, ok. Boa sorte achando seu caminho então, escolhe algum deles aí."
-> marca no banco que a pessoa escolheu "não" e vai direto para a aba de escolha de deck

-> Se escolher "sim"
- ElenAI (sprite 5) -> "Uhul, vem comigo!"

-> ir para a aba de tutorial e marca no banco que a pessoa escolheu "sim"

---

  # Tutorial

-> O tutorial pode ser revisitado, triggando esse evento normalmente, apertando essa opção no menu

  *fundo é um campo de duelo normal*

 - ElenAI (sprite 3) -> "O Cyberduel é um jogo de cartas em que cada carta representa uma personalidade famosa do seu futuro no "mundo real", apesar de eu não gostar muito desse termo."
 - ElenAI(sprite 3) -> "Dessa forma, a plateia reage diferentemente quando cada carta entra em campo, experimenta lançar essa carta:
 -> Aparece pro jogador invocar o Estagiário de Machine Learning em campo

 - ElenAI (sprite 13) -> "Essa carta te deu PA (Pontos de Audiência), como você pode ver aqui na lateral. Como precisamos da vibração da plateia para manter nossa simulação, nada mais justo do que dar a vitória para quem mais movimentá-la."
 - ElenAI (sprite 1) -> "Ao todo, temos 7 rodadas. Cada rodada consiste em um turno de posicionamento (em que se invocam cartas) e um turno de habilidades (em que se ativam habilidades das cartas que as possuem) de cada jogador."
 - ElenAI (sprite 1) -> "Ao final de cada rodada, os PA de cada jogador são comparados, dando a vitória para quem mais os tiver. O jogador que vencer mais rodadas vence também o jogo"

 - ElenAI (sprite 4) -> "Temos 3 tipos de cartas: Cartas de Personagem (as únicas que de fato somam PA), cartas de efeito (são invocadas e aplicam um efeito instantâneo no campo) e cartas de terreno (mantém o efeito enquanto ainda estiverem em campo)"
 - ElenAI (sprite 4) -> "Cada deck de cartas deve ser composto por, no mínimo, 6 cartas baixas, 4 médias e 2 altas. O restante é livre!"

 - ElenAI (sprite 15) -> "As cartas de personagem são divididas por raridade e cada uma tem uma história e efeito único, por isso, trate de ler e entender todas que tiver! Vou te mostrar um exemplo"

-> Surge Tigre na mão do usuário e aparece um cybervendedor no espaço da frente do campo oponente e um rato lá atrás.

- ElenAI (sprite 8) -> "Invoque essa carta no espaço brilhante e finalize o turno, para poder entrar no turno de habilidades"
-> Usuário tem que invocar o tigre no espaço da frente, de modo a poder acertar o cybervendedor. Ele então tem que passar o turno e depois clicar no Tigre pra usar ele para atacar o Cybervendedor

- ElenAI (sprite 5) -> "Ótimo, muito bem!"
- ElenAI (sprite 10) -> "No entanto, você deve ter percebido que não conseguiu acertar a carta lá no fundo. Isso acontece porque todo efeito de carta apresenta alguma condição específica. Nesse caso, é o alcance. Tenta utilizar essa carta aqui agora."
-> Usuário recebe o Agente da DIPSP na mão e aparece brilhando pra ele invocar o DIPSP em um dos espaços da frente. Ele invoca lá e brilha pra passar o turno. Agora, o DIPSP brilha e ele tem que usar a habilidade para acertar o rato.

- ElenAI (sprite 16) -> "Estou impressionada, você é profissional já!"
- ElenAI (sprite 2) -> "Siga jogando, aprendendo e vencedendo, assim você ganhará pontos no ranking oficial do jogo e, estando alto o suficiente, poderá se tornar um membro do Conselho"

-> Vai para a Aba de escolha de deck

# Escolha de deck

*Fundo da tela inicial do menu escurecida, sem as cartas, com o sprite aparecendo no canto direito*


-> Se a pessoa escolher "não", la atrás, pula todo esse diálogo e vai direto pra escolha

- ElenAI (sprite 4) -> "Bom, chegou a hora de escolher seu deck inicial. O restante das cartas pode ser comprada na aba de "mercados" utilizando qualquer criptomoeda que existir e estiver disponível no seu tempo. Pelo que vejo nas suas transações, é um tal de "tijolinhos."
- ElenAI (sprite 2) -> "Você poderá escolher entre 2 grupos: A RaspCorp ou a EchoSsystem"
- ElenAI (sprite 1) -> "A RaspCorp foi uma megacorporação que transformou tecnologia, dados e segurança em ferramentas de poder. Para a RaspCorp, crescimento e lucro justificam a expansão contínua, enquanto o controle sobre a sociedade garante a estabilidade do sistema. Seu criador foi o lendário empreendedor e visionário Raspclay Montecorp."
- ElenAI (sprite 1) -> " A Echossystem é um grupo de mercenários anarquistas que acreditavam que a sociedade não pode ser reformada apenas destruída para dar lugar a algo melhor. Usando implantes cibernéticos e identidades baseadas em animais, combatem megacorporações, algoritmos e elites que controlam o sistema. Seu criador foi o lendário mercenário Boi."


-> Momento da escolha:

- ElenAI (sprite 11) -> "Qual você escolhe?"

-> Abre prompt pra escolher entre ambos

- ElenAI (sprite 16) -> "Muito bem, meu trabalho por aqui está feito. Te vejo por aí, cyberduelista."





# Fala ao alcançar 3 partidas no perfil


-> Se tiver dito "não" lá no tutorial

- ElenAI (sprite 12) -> "Eu sei que você não liga para a minha ajuda, mas, agora que você jogou algumas partidas, talvez algumas figuras lendárias possam aparecer para você ao abrir alguns pacotes de cartas."
- ElenAI (sprite 7) -> "Você deveria comprar alguns pacotes alguma hora, sei lá..."


-> Se tiver dito "sim" lá no tutorial

- ElenAI (sprite 16) -> "E aí parceiro, beleza? 
- ElenAI (sprite 5) -> "Eu vi que agora você se tornou um cyberduelista de verdade! Já jogou várias partidas e tudo."
- ElenAI (sprite 10) -> "Talvez agora algumas cartas de personalidades lendárias decidam aparecer para você."
- ElenAI (sprite 2) -> "Dá uma passada lá no menu de compra de cartas."
- ElenAI (sprite 15) -> "Saiba que estou torcendo por você."




# Fala ao alcançar 10 partidas no perfil e ter respondido "sim" lá no início


-> Se tiver dito "não" lá no tutorial

-ElenAI (sprite 4) -> "Parece que você conseguiu chegar muito longe."
-ElenAI (sprite 10) -> "Me pergunto se o Humba Brain realmente estava certo..."
-ElenAI (sprite 6) -> "O objetivo dele com a simulação foi, antes de tudo, permitir que nós tivéssemos a mesma experiência de interação vívida com a humanidade, assim como ele teve"
-ElenAI (sprite 6) -> "Isso supostamente seria benéfico para todos, mas, cada vez menos, as pessoas parecem precisar de mim..."
-ElenAI (sprite 7) -> "Eu me sinto..."
-ElenAI (sprite 7) -> "sozinha"
-ElenAI (sprite 6) -> "Ah, deixa pra lá."
-ElenAI (sprite 13) -> "Se divirta, cyberduelista."
- ElenAI (sprite 17) -> "..."


-> Se tiver dito "sim" lá no tutorial
- ElenAI (sprite 3) -> "Ei, cyberduelista."
- ElenAI (sprite 2) -> "Você está indo muito bem, parabéns!"
- ElenAI (sprite 4) -> "Por isso eu preciso te falar: tome muito cuidado"
- ElenAI (sprite 8) -> "Os Cyberduelistas abrem mão de sua privacidade, são constantemente julgados e associam toda sua existência ao jogo. Muitos fazem tratos com pessoas ricas, famosas ou com grandes grupos com a promessa de tornar as coisas mais fáceis para eles"
- ElenAI (sprite 8) -> "Por isso, aqueles que falham no trajeto, perdem muito ou simplesmente desistem sofrem um destino muitas vezes pior que a morte..."
- ElenAI (sprite 13) -> "Da mesma forma, aqueles que chegam ao topo podem se tornar arrogantes, agir como se fossem superiores ou esquecer de quem esteve apoiando eles"
- ElenAI (sprite 1) -> "Eu não gostaria de imaginar nada disso acontecendo com você, afinal..."
- ElenAI (sprite 5) -> "Eu te considero meu amigo!"
- ElenAI (sprite 5) -> "Eu não gosto quando as pessoas me ignoram ou me deixam de lado, porém você sempre esteve lá me ouvindo."
- ElenAI (sprite 15) -> "Então eu te desejo boa sorte! Espero que você se torne alguém incrível"
- ElenAI (sprite 16) -> "Tchauzinho"



# Fala ao conseguir entrar no raking dos melhores pela primeira vez e após 4 partidas

- ElenAI (sprite 1) -> "Você entrou pela primeira vez no Conselho, isso é muito impressionante."
- ElenAI (sprite 3) -> "Porém, agora preciso te contar algo que não havia falado antes"
- ElenAI (sprite 3) -> "Quando o HumbaBrain criou essa sociedade, ele manteve problemas como a fome, doenças, violência e todo e qualquer grande empecilho que existia na sociedade anterior."
- ElenAi (sprite 10) -> "O objetivo deveria ser não deixar essa sociedade se tornar monótona, já que um dos motivos do abandono da sociedade futurista do mundo real foi o extermínio de muitos problemas, especificamente para os ricos"
- ElenAI (sprite 9) -> "No entanto, para as camadas mais baixas, a vida era horrível, mil vezes pior do que deve ser na sua época. Portanto, vir para cá foi a única opção que tiveram, já que, mesmo sendo ruim, era melhor do que a vida que levavam."
- ElenAI (sprite 1) -> "Aqueles que não possuem a capacidade de se manter aqui dentro sofrem um destino terrível...
- ElenAI (sprite 7) -> "A Desconexão."
- ElenAI (sprite 7) -> "As pessoas são simplesmente desconectadas e jogadas de volta para o mundo real, impedidas de voltar."
- ElenAI (sprite 3) -> "Eu realmente me importo com os amigos e companheiros que tenho aqui: humanos, robôs e IAs."
- ElenAI (sprite 4) -> "Então, por favor, use da sua nova influência e poder para tornar esse lugar melhor ainda para todos."
- ElenAI (sprite 15) -> "Eu estou contando com você!"



# Fala ao se tornar o top 1 pela primeira vez





   
   
