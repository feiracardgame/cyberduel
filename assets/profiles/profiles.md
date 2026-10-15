Os bustos do duelo são escolhidos pela foto de perfil na tabela `PERSONAGENS_DUELO_POR_AVATAR`, em `js/cenas/jogo.js`.

- `boi_icon.png` → `boi_profile.png`
- `raspclay_icon.png` → `raspclay_profile.png` (Clayrton)

Todos os 21 bustos disponíveis estão associados aos ícones correspondentes. DIPSP usa `agentes_icon.png`, CryptoAcionistas usa `cryptoacionista_icon.png`, HumbaBrain usa `humba_brain_icon.png`, IA usa `ia_treinamento_icon.png`, Político usa `prefeito_icon.png` e Bom, Feio e Mau usam `o_bom_icon.png`, `o_feio_icon.png` e `o_mal_icon.png`. Advogado e Diego usam `advogado_profille.png` e `diego_profille.png`, preservando a grafia dos arquivos existentes. Para adicionar um personagem, coloque o PNG transparente nesta pasta e acrescente a associação entre o caminho do ícone e o caminho do busto na tabela. Use o mesmo enquadramento dos PNGs atuais para manter a posição nos cantos.

`duel_corner.png` é a moldura transparente compartilhada pelos cantos, com a faixa preta do PA e detalhes azuis e magenta. O canto adversário usa `duel_corner_opponent.png`, desenhada para o topo esquerdo.
