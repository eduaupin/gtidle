# Grand Trade Idle

Idle MMO de crime urbano para navegador, com a cidade em visão de cima no estilo 2D clássico.
Sua gangue rouba lojas, o galpão refina, os pontos vendem — tudo por tempo, inclusive com o jogo fechado.

> Nome, cidade e arte são originais. Não use nomes, logos, personagens ou arte de franquias existentes.

## Rodar em desenvolvimento

Requisitos: Node.js 20+.

```bash
npm install
npm run dev          # sobe a API (porta 3001) e o jogo juntos
```

Abra http://localhost:5173. Para parar, Ctrl+C. (Se preferir, `npm run dev:server` e `npm run dev:web`
em dois terminais fazem o mesmo.)

Sem banco de dados e sem pagamento real: o servidor salva tudo em `apps/server/data/dev-db.json`
e a loja gera um Pix de teste com o botão "Simular pagamento aprovado".

No Windows, se o PowerShell disser que "a execução de scripts foi desabilitada", rode uma vez
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

```bash
npm test          # testes do motor, missões, Pix e assinatura do webhook
npm run typecheck
npm run build     # gera apps/web/dist
```

## Estrutura

```text
packages/shared/        regras e conteúdo usados por servidor e cliente
  src/content/world.ts  distritos, assaltos, galpão (produtos), imóveis, RULES (balanceamento)
  src/content/shop.ts   produtos com preço em R$ e US$, itens em diamantes
  src/brand.ts          nome do jogo (mude aqui para renomear)
  src/content/missions.ts cadeia de 11 objetivos que ensina o jogo e paga recompensas
  src/formulas.ts       XP, custos, VIP, limites offline
  src/types.ts          PlayerState, Action, GameEvent
apps/server/            Fastify + Socket.IO
  src/engine/idle.ts    motor idle autoritativo (função pura avance(estado, agora))
  src/engine/actions.ts validação de todas as ações e entrega de compras
  src/payments.ts       Pix pelo Mercado Pago: cria a cobrança, consulta o status, valida o webhook
  src/stripe.ts         cartão pelo Stripe Checkout (real ou dólar), consulta e webhook assinado
  src/push.ts           notificações push (Web Push, chaves VAPID)
  src/store/store.ts    armazenamento em arquivo para dev (interface para trocar por Prisma)
  prisma/schema.prisma  schema PostgreSQL para produção
  test/                 testes do motor, missões e pagamentos
apps/web/               React + Vite
  src/game/city.ts      gera a cidade: ruas, quarteirões com calçada de cantos curvos, prédios com
                        altura, alvos, esconderijo, galpão, árvores, postes, caminhos de pedestres
  src/game/textures.ts  texturas feitas por código: pedra da calçada, asfalto, grama, concreto, telhado
  src/game/draw.ts      carros, pedestres, árvores e prédios em falsa perspectiva
  src/game/CityCanvas.tsx câmera que segue a gangue, zoom, arrastar, trânsito, polícia, noite, minimapa
  src/ui/               HUD, painéis, alerta de polícia, checkout e chat
  src/ads.ts            anúncio recompensado (Google H5 Games Ads)
  src/notifications.ts  ativa o push no navegador
  public/sw.js          service worker que mostra a notificação com a aba fechada
```

## Visual do mapa

Visão de cima com câmera próxima, no estilo dos jogos de crime 2D dos anos 90, com arte 100% própria
gerada por código. Os prédios usam falsa perspectiva: o telhado é desenhado mais alto que a base, então
as paredes "tombam" para fora a partir do centro da tela e mudam conforme a câmera anda. A altura do
"olho" acompanha o zoom, então a inclinação fica igual de perto ou de longe.

Controles: arraste para mover, roda do mouse ou + e − para zoom, clique num alvo para abrir o assalto,
clique no minimapa para pular até um ponto. "Seguir a gangue" volta a câmera para o seu carro.

Para trocar por sprites desenhados à mão: substitua `drawCar`, `drawPerson` e as texturas em
`textures.ts` por imagens; a câmera, a projeção e as rotas continuam iguais.

## Como o jogo funciona

| Sistema | Onde mexer |
| --- | --- |
| Assaltos em loop ("loot por tempo") | `ROBBERIES` em `world.ts` |
| Galpão: compra insumo → refina por tempo → pontos vendem | `DRUGS` e `RULES.sellSecPerUnit` |
| Procurado 0–100: cheio = 10 min preso; advogado reduz | `RULES.heat*`, `RULES.jailSec` |
| Imóveis com renda passiva (estilo Idle Mafia) | `PROPERTIES` |
| Ganho offline: 8 h grátis, 16 h no Clube Rockeiro | `RULES.offlineCapHours*` |

O servidor guarda `lastTick` e simula em passos de 5 s até o momento atual. O cliente nunca informa
quanto ganhou; ele só desenha e interpola as barras entre uma consulta e outra.

## Evento "seu roubo está sendo monitorado"

Mantém o jogador voltando ao jogo. Enquanto um assalto roda, a polícia começa a monitorar o roubo
em intervalos sorteados (12 a 25 minutos, a partir do nível 2):

| Situação | O que acontece |
| --- | --- |
| Alerta aparece | notificação no navegador (mesmo com a aba fechada), aviso no jogo, viatura rondando o alvo, título da aba piscando |
| Volta em até 2 minutos e assiste o anúncio | golpe continua normal |
| Não volta a tempo | golpe fraco: 35% da recompensa até despistar |
| Golpe fraco e assiste o anúncio | volta ao normal |
| Clube Rockeiro (VIP) | despista sem anúncio e ganha +50% por 30 minutos |

Todos os números ficam em `RULES` (`alert*`, `weakMult`, `boostMult`, `boostMinutes`, `adMinSec`, `adsPerDay`).

**Notificações:** o jogador clica em "Ativar avisos" (o navegador exige um clique para pedir permissão).
O servidor avança sozinho, a cada 15 s, quem tem notificação ativa, cria o alerta na hora certa e manda o push.
Se a aba estiver visível, o push não é enviado, porque o aviso já aparece no jogo. Funciona em https ou em localhost;
no iPhone, só quando o site é adicionado à tela de início.

**Anúncio recompensado:** usa o Google H5 Games Ads (Ad Placement API), feito para jogos de navegador.
Crie a conta AdSense, inscreva o site no programa H5 Games Ads e preencha `VITE_ADSENSE_CLIENT=ca-pub-...`
no `.env`. Mantenha `VITE_ADS_TEST=on` até a aprovação. Sem anúncio disponível na hora, o jogo mostra uma
espera curta no lugar para o jogador não travar. O navegador não consegue provar que o anúncio foi assistido,
então o servidor limita abuso com token de uso único, tempo mínimo de 8 s e no máximo 30 por dia.

**Para testar em desenvolvimento:** com a gangue num assalto, clique em "Testar alerta" no topo do mapa
(o botão só existe em modo de desenvolvimento).

## Procurado de 0 a 6 estrelas

O procurado é um número de 0 a 100, mostrado em 6 estrelas (`content/police.ts`):

| Estrelas | Procurado | Quem vem atrás | O que muda |
| --- | --- | --- | --- |
| 1 | 10+ | policiais a pé | nada |
| 2 | 25+ | viatura | nada |
| 3 | 40+ | viaturas em cerco | aviso para ir ao esconderijo |
| 4 | 60+ | SWAT | roupa e carro em uso ficam queimados |
| 5 | 75+ | helicóptero com holofote | a espera no esconderijo dobra |
| 6 | 90+ | cerco total, com bloqueio na rua | no 100 é cadeia |

Cada assalto tem um teto de estrelas (`maxStars` em `content/world.ts`). Golpe pequeno só chama policial
a pé (bater carteira não passa de 1 estrela), e golpe grande chama SWAT e helicóptero (joalheria e banco
vão até 6). O teto não derruba um procurado que já estava alto. Isso cria a estratégia: farmar golpes
pequenos é seguro, golpes grandes pagam muito mais e exigem esconderijo e visual reserva.

No mapa, a polícia aparece em volta da gangue conforme as estrelas. Em desenvolvimento: "Testar 5 estrelas",
"Testar 6 estrelas", "Zerar estrelas" e "+$100.000" no topo do mapa.

## Barra suja: 3 estrelas pedem esconderijo

Ao chegar em 3 estrelas de procurado (40 de 100), a polícia fecha o cerco: aviso no mapa, notificação
e título da aba piscando. O jogador manda a gangue para a base:

| Situação | O que acontece |
| --- | --- |
| Vai para o esconderijo | assaltos e pontos de venda param, o procurado esfria rápido |
| Depois de 5 minutos | notificação "a barra esfriou"; o jogador clica em "Voltar ao corre" e os mesmos assaltos voltam |
| Clube Rockeiro | espera de 3 minutos e volta sozinho |
| Rota de fuga (8 diamantes) | sai do esconderijo na hora |
| Ignora o aviso | o procurado continua subindo até a cadeia (10 minutos com tudo parado) |
| Não volta depois da espera | a gangue volta sozinha após 20 minutos, para o idle offline não morrer |

Números em `RULES.hideout*`. Em desenvolvimento, use "Testar 3 estrelas" e "Pular espera do esconderijo" no topo do mapa.

## 4 estrelas: visual queimado (aba Visual)

Se o procurado chega a 4 estrelas (60 de 100), a SWAT grava a roupa e o carro em uso. Os dois ficam
queimados por 8 h (4 h no Clube Rockeiro) e a gangue não rouba enquanto estiver com um item queimado.
Um card no mapa mostra os visuais livres para trocar com um clique.

- Todo jogador começa com 2 roupas e 2 veículos (sedan e moto), então nunca fica travado.
- Roupas e carros novos custam grana do jogo (de $1.500 a $45.000) ou diamantes nos modelos especiais.
- Seis formatos de veículo aparecem diferentes no mapa: sedan, hatch, esportivo, moto (com piloto), picape e van.
- Números em `RULES.lookBurn*` / `RULES.lookCooldownHours*`. Em desenvolvimento: "Testar 4 estrelas".

### Joias, armas e raridade

- **Joias** (corrente, relógio, anéis) e **armas** (taco, soco inglês, canivete, pistola, submetralhadora,
  escopeta, rifle) aparecem nas mãos e no pescoço da gangue: no mapa, no esconderijo e no card de compartilhar.
- São só visuais: quem aumenta a grana é o Arsenal. Não queimam com 4 estrelas. Clicar de novo tira.
- Cada item mostra uma raridade (Comum, Raro, Épico, Lendário) definida pela faixa de preço em `rarityOf()`.
  É rótulo de vitrine: o jogador sempre escolhe e vê o item que compra, sem sorteio.

## Evolução da gangue (aba Gangue)

Três trilhas de 8 níveis, pagas só com grana do jogo e caras de propósito (`content/upgrades.ts`):

| Trilha | Efeito por nível | Abre |
| --- | --- | --- |
| Arsenal | +10% de grana por assalto | nível 3, depois a cada 5 níveis |
| Oficina | +8% de velocidade | idem |
| Equipamento | −6% de procurado ganho | idem |

No Clube Rockeiro as trilhas custam 30% menos (`UPGRADE_VIP_DISCOUNT`): ajuda, mas não compra o jogo.

## Esconderijo decorado (aba Base)

Oito espaços (piso, parede, sofá, tapete, TV, bar, canto, quadro) com cerca de 30 itens em `content/decor.ts`.
Bandeiras de time são de clubes **fictícios** (Tricolor da Orla, Rubro-Negro do Porto…): nome e escudo de
clube real são marca registrada. O carro em uso aparece estacionado na garagem da sala.

## Compartilhar perfil

O botão "Compartilhar" (topo e aba Gangue) gera uma imagem 1080x1350 com nível, grana, gangue, carro,
evolução e o esconderijo. No celular abre o menu de compartilhar do sistema (Instagram, WhatsApp…);
no computador baixa a imagem. O rodapé mostra o domínio do site, que vira divulgação grátis.

## Mapa do estado: Costa Dourada

São 16 regiões num estado fictício com a estrutura de uma península tropical: metrópole na costa leste
(Periferia, Centro, Porto da Baía, Aeroporto) com praias em ilhas-barreira (Orla, Ilha das Mansões, Marina),
Lagoa Grande no meio, Pântano dos Jacarés no centro-sul, Autódromo e Vila Norte no interior, Mata Vermelha
no noroeste, Porto do Poente no oeste e as Ilhotas ligando o sul até a Ilha do Sol e a Ilha do Farol.
Nomes e traçado são originais (`DISTRICTS` e `ROBBERIES` em `content/world.ts`).

- Botão **Mapa** no topo e "Abrir o mapa" na aba Assaltos: clique numa região para ver alvos e viajar.
- Cada região tem um cenário (`terrain`): cidade, praia, porto com contêineres e água, aeroporto com pista,
  pântano, plantações, mata e ilha. A cidade é gerada em `apps/web/src/game/city.ts`.

## Mercado entre jogadores (aba Mercado)

**O que se negocia** (tudo cai nos assaltos; nada sai da loja nem de anúncio):

| Item | Como cai | Para que serve |
| --- | --- | --- |
| Raros numerados (#0042 de 300) | golpes de 5 e 6 estrelas e planos de golpe | roupas, carros, armas e acessórios que não estão na loja |
| Peças de Arsenal, Oficina e Equipamento | todo assalto, mais nos longos e de mais estrelas | os níveis 4 a 8 da aba Gangue pedem peças |
| Planos de golpe | golpes de 3 estrelas para cima | golpe especial que roda uma vez, paga muito e pode dar raro |

**Regras que fecham a conta** (`MARKET` e `DROP_RULES` em `content/loot.ts`, servidor em `apps/server/src/market.ts`):

- Preço em diamantes. Só se compra com **diamantes comprados** ou **saldo de vendas**. Diamantes ganhos
  jogando (anúncio, missão) valem só na loja. Assim todo diamante que pode virar dinheiro entrou pago.
- O item fica em custódia no anúncio; volta para a mochila se cancelar ou vencer.
- Quem vende recebe saldo de vendas menos a taxa.
- O número de série dos raros é global (um #0042 existe uma vez no jogo inteiro) e a tiragem acaba.

| | Grátis | Clube Rockeiro |
| --- | --- | --- |
| Taxa | 10% | 5% |
| Vagas de anúncio | 3 (+1 por 24 h assistindo anúncio) | 10 |
| Duração do anúncio | 2 dias | 7 dias |
| Vitrine | normal | destaque no topo |
| Drops de peças, planos e raros | normal | +25% |

**Anúncios:** a recompensa de anúncio é sempre presa à conta (vaga extra, despistar a polícia, grana,
turbo). A política do Google proíbe recompensa em dinheiro ou cripto e exige que a recompensa não possa ser
convertida em dinheiro. Nunca dê diamantes negociáveis nem drops vendáveis por anúncio.

**Saque em cripto (desligado):** `MARKET.withdrawEnabled = false`. A tela mostra "Sacar em Solana · em breve"
com a previsão de 1.000 diamantes de saldo = US$ 6. Enviar cripto para carteiras de jogadores é serviço de
ativo virtual: as Resoluções BCB 519, 520 e 521 (em vigor desde 02/02/2026) exigem autorização do Banco Central
e identificação do dono da carteira autocustodiada. O caminho recomendado é um parceiro já autorizado, com
verificação de identidade, e revisão de um advogado de cripto e de jogos antes de ligar. A rota
`POST /api/market/withdraw` hoje só responde "em breve".

**Para testar em desenvolvimento:** botões "+ itens de mercado" (peças, planos, dois raros e 1.000 diamantes
comprados) e "Nível 90" no topo do mapa. Abra duas janelas anônimas com nicks diferentes para comprar e vender.

## Cidade viva (bondes, golpe em equipe, corrida, jornal e mais)

Regras e números ficam em `packages/shared/src/content/city.ts`; o servidor em `apps/server/src/social.ts`.
Tudo usa o relógio de Brasília, para todo mundo viver a mesma noite e a mesma semana.

**Lavagem de dinheiro (aba Imóveis).** Golpes de 4+ estrelas, planos e golpes em equipe pagam em grana suja.
Os imóveis lavam sozinhos (cada $1/s de renda lava $12/s) com taxa de 10% (5% no Clube Rockeiro). Dá para
lavar na hora pagando 25%. Se for preso, a polícia apreende 50% da grana suja.

**Seguro contra prisão.** Pago com grana do jogo (R$ 400 × nível), vale 24 h e uma prisão: a apreensão cai
para 25% e o tempo preso pela metade.

**Dia e noite.** Das 19 h às 6 h os assaltos pagam +20% e somam +20% de procurado. O mapa escurece no mesmo horário.

**Bondes e territórios (aba Bonde).** Fundar custa $5.000 (nome e sigla de 2 a 4 letras), até 6 membros, entrada
por código. Cada assalto soma pontos (grana / 100) para a região onde aconteceu. Quem tiver mais pontos na
semana domina a região na semana seguinte: +15% de grana nos assaltos de lá para o bonde inteiro. A sigla
aparece no mapa do estado e a virada da semana vira manchete.

**Golpe em equipe.** Quatro funções (motorista, hacker, arrombador, vigia). Quem monta escolhe o golpe
(Carro-forte nv 10, Cofre do Banco Central nv 30, Navio do ouro nv 55) e passa o código. Fechou as quatro
vagas, o golpe começa e no fim cada um recebe grana suja, XP, peças e chance de raro. Equipe que não fecha em
2 h é desfeita. A vitrine mostra primeiro as equipes do seu bonde.

**Corrida de rua (aba Cidade).** 30 s desviando do trânsito em 3 faixas (setas, A/D ou toque). O servidor
sorteia a semente, confere o tempo e recusa distância acima do teto físico. As 5 primeiras do dia pagam grana
e XP; o recorde entra no ranking da semana. No fim sai um GIF dos últimos segundos para compartilhar
(gerado no navegador com `gifenc`). O tuning do carro aparece na pista.

**Oficina de tuning (aba Visual).** Pintura, neon e rodas por carro. Peças comuns com grana, as especiais com
diamantes. Aparece no mapa, na corrida, no modo foto e na ficha.

**Jornal da Costa Dourada.** Manchetes automáticas: raros encontrados, golpes acima de $50 mil (no máximo uma
por jogador a cada 30 min), níveis redondos, novos bondes, territórios, golpes em equipe, recordes e leilões.
Cada manchete vira imagem com o código de convite.

**Modo foto (botão Foto).** Cinco cenários (farol, praia, autódromo, centro, ilha), três poses e legenda.
Sai em 1080×1080 com o código de convite.

**Ficha criminal (botão Ficha).** Perfil público em `/?ficha=CODIGO`, abre até sem conta: números, maior golpe,
troféus, raros e o visual. Vira imagem 1080×1350.

**Convite.** Cada jogador tem um código (o mesmo da ficha). Quem entra por `/?ref=CODIGO` ganha $2.000 e 30
diamantes; quem convidou ganha 100 diamantes quando o amigo chega ao nível 10 (evita conta falsa).

**Presentes.** Visual de diamante para um amigo pelo código, só com diamantes comprados (diamante ganho com
anúncio nunca vira valor para outra conta). Clube Rockeiro e pacotes de diamantes podem ser dados de presente
no checkout (Pix ou cartão): a compra é aprovada e entregue na conta do amigo.

**Leilão de raros (aba Mercado).** Abre sábado e domingo e fecha domingo às 22 h. Lance mínimo +5%; o valor
fica reservado e volta na hora para quem foi superado; lance nos últimos 5 minutos estende o fim. Só valem
diamantes comprados e saldo de vendas. Números #0001 a #0010 ficam em destaque e viram manchete. Na venda vale
a mesma taxa do mercado.

**Para testar em desenvolvimento:** botão "+$50.000 sujo" para a lavanderia; o leilão abre qualquer dia;
use janelas anônimas com nicks diferentes para bonde, equipe, presentes e lances.

## Arte: folha de sprites

Toda a arte do jogo vem de uma folha de sprites (`tools/sprites-source.png`). O script
`tools/build_atlas.py` recorta cada sprite, remove o fundo escuro e gera o atlas usado no navegador:

```
pip install pillow numpy scipy opencv-python-headless
python3 tools/build_atlas.py   # gera apps/web/src/assets/sprites/atlas.png + atlas.json
```

- **Regra de negócio da folha:** o que está em GRÁTIS se compra com grana do jogo (ou já vem no começo),
  o que está em VIP custa diamantes. Os itens ficam em `packages/shared/src/content/shop.ts` (campo `sprite`)
  e `decor.ts`. Um teste garante que todo item com sprite tem preço.
- Personagens: cada roupa é um personagem da folha. Acessórios (óculos, corrente, colete, relógio) e armas
  são desenhados por cima do personagem no mapa, no esconderijo e no card.
- Carros e motos usam a vista de cima; o trânsito escolhe o sedã de cor mais parecida. Viatura e SWAT usam
  o sedã branco e o preto com giroflex por cima (a folha não tem viatura vista de cima).
- Helicópteros: o azul é o da polícia (5 e 6 estrelas); os VIP viram o cosmético "Heliponto" no telhado do esconderijo.
- Esconderijo: cama, sofá, mesa, TV, bebidas e canto usam os móveis da folha; piso, parede e bandeiras
  continuam desenhados por código (times fictícios).
- Ícones da interface (grana, XP, diamante, VIP e abas) vêm da área "Interface" da folha.
- Para trocar a arte: substitua a folha mantendo o layout, ou ajuste as caixas no script e rode de novo.
  Se o atlas não carregar, o jogo usa o desenho antigo feito por código.
- Saves antigos: itens que saíram da loja somem do inventário e o jogador volta ao visual inicial (`migrate`).

## Receber pagamentos

| Meio | Moeda | Quem usa | Onde cai o dinheiro |
| --- | --- | --- | --- |
| Pix (Mercado Pago) | R$ | jogadores no Brasil | saldo Mercado Pago |
| Cartão, Apple Pay, Google Pay (Stripe) | R$ ou US$ | Brasil e exterior | saldo Stripe, transferido para sua conta bancária |

A loja escolhe a moeda pelo idioma do navegador (português = R$, resto = US$) e o jogador pode trocar.
Pix só aparece em reais. Sem as chaves configuradas, cada meio roda em modo de teste com um botão
"Simular pagamento aprovado".

Como a confirmação funciona: o jogo pergunta ao servidor a cada 3 segundos e o servidor consulta o
pagamento direto no Mercado Pago ou no Stripe. Por isso funciona até em localhost, sem webhook.
O webhook garante a entrega quando o jogador fecha a tela antes da confirmação. Toda aprovação é
reconfirmada com o provedor (status pago, moeda e valor exatos) antes de liberar o item.

### Pix (Mercado Pago)

1. Conta Mercado Pago com uma **chave Pix** cadastrada (app > Pix > Minhas chaves). Sem chave, a API recusa o Pix.
2. mercadopago.com.br/developers > crie uma aplicação ("Pagamentos online", "Checkout Transparente")
   e copie o **Access Token de produção** para `MP_ACCESS_TOKEN` no `.env`.
3. Com o jogo num domínio https: preencha `API_PUBLIC_URL`, cadastre o webhook
   `https://SEU-DOMINIO/api/webhooks/mercadopago` (evento "Pagamentos") e copie a chave secreta para `MP_WEBHOOK_SECRET`.

### Cartão e internacional (Stripe)

1. Crie a conta em stripe.com escolhendo Brasil como país, com CPF ou CNPJ e a conta bancária para receber.
2. Dashboard > Desenvolvedores > Chaves de API: copie a chave secreta para `STRIPE_SECRET_KEY`.
   Comece com a chave de teste (`sk_test_...`) e o cartão 4242 4242 4242 4242 para ver o fluxo inteiro.
3. Com o jogo num domínio https: preencha `PUBLIC_URL`, crie o webhook
   `https://SEU-DOMINIO/api/webhooks/stripe` com os eventos `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` e `checkout.session.expired`, e copie o segredo para `STRIPE_WEBHOOK_SECRET`.
4. Troque para a chave de produção (`sk_live_...`) quando a conta estiver ativada.

Reinicie o servidor depois de mudar o `.env`. A mensagem de início diz se cada meio está "real" ou "teste".

Impostos: vendendo direto pelo Stripe, você é o vendedor e responde pelos impostos do Brasil e,
em alguns países, por IVA/sales tax sobre produto digital. Se as vendas de fora crescerem, um
"merchant of record" (Paddle, Xsolla, Lemon Squeezy) assume esses impostos em troca de uma taxa maior.
Converse com um contador.

## Loja

| Produto | R$ | US$ | Inspiração |
| --- | --- | --- | --- |
| Pacote Fundador (até 19/11) | 29,90 | 6.99 | escassez da data de lançamento |
| Bem-vindo à Quebrada (compra única) | 9,90 | 1.99 | pacote de boas-vindas do Idle Mafia |
| Clube Rockeiro 30/90 dias | 14,90 / 34,90 | 3.99 / 9.99 | assinatura "Clube da Máfia" do Idle Mafia + automações do VIP do PokeIdle |
| Passe Temporada 1 | 19,90 | 4.99 | passe do PokeIdle |
| Diamantes | 4,90 a 99,90 | 0.99 a 19.99 | — |
| Skins de personagem, veículo e esconderijo | 50 a 600 diamantes | | álbum de skins do Idle Mafia |

Sem caixa aleatória paga: o ECA Digital (Lei 15.211/2025) proíbe loot boxes em jogos acessíveis a menores.
Membros da gangue recrutáveis (próxima etapa) devem ser escolhidos e vistos antes da compra, não sorteados.

## Para ir ao ar

1. Defina as variáveis de ambiente listadas em `.env.example` no painel da hospedagem
   (localmente: `node --env-file=.env` ou exporte no terminal).
2. Troque o `FileStore` por um `PrismaStore` (mesma interface) e rode `npx prisma migrate deploy`.
3. Login real: e-mail + Google + Discord, com verificação de idade além da autodeclaração.
4. Pagamentos: siga "Receber pagamentos" acima. Compare a validação do `x-signature` em
   `src/payments.ts` com o SDK oficial do Mercado Pago antes de publicar.
5. Arte final: troque os retângulos do `CityCanvas` por um atlas de sprites 16×16 (carros vistos de cima,
   telhados, pedestres). A lógica de rotas e posições continua a mesma.
6. Hospede a API numa VPS ou Railway, o `apps/web/dist` em qualquer CDN, Cloudflare na frente.

## Próximas etapas

Tradução da interface para inglês (a página de pagamento do Stripe já se adapta ao idioma do comprador).

### Temporada 2

Modo streamer, bot de Discord/WhatsApp e a contagem regressiva para 19/11 ficam para a próxima versão.
Depois: recrutar membros com classe e raridade, chefões por distrito, chefe mundial, PvP assíncrono no
esconderijo, prestígio e passe completo.
