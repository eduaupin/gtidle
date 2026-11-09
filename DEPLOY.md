# Colocar o jogo no ar

O servidor Node entrega tudo num endereço só: o site (já montado), a API e o tempo real (chat, alertas).
O `Dockerfile` na raiz monta a imagem pronta. Os dados do jogo ficam num arquivo em `/data`, que precisa
de um **volume persistente** (senão somem a cada atualização).

## Caminho recomendado: Railway (sem linha de comando)

1. **GitHub em dia.** O Railway lê o código do repositório `eduaupin/gtidle`.
2. **railway.com → New Project → Deploy from GitHub repo** → escolha o repositório. Ele acha o `Dockerfile` sozinho.
3. **Volume:** no serviço, *Settings → Volumes → Add volume*, caminho de montagem **`/data`**.
4. **Variáveis** (*Variables*):
   | Variável | Valor |
   |---|---|
   | `SESSION_SECRET` | 40+ caracteres aleatórios (sem isso o servidor não sobe) |
   | `PUBLIC_URL` e `API_PUBLIC_URL` | o endereço do jogo, ex. `https://seujogo.com.br` (os dois iguais) |
   | `CORS_ORIGIN` | o mesmo endereço |
   | `FIREBASE_PROJECT_ID`, `VITE_FIREBASE_*` | do Firebase (abaixo) |
   | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | do Discord (abaixo) |
   | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `STRIPE_*` | pagamentos de produção |
   | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` |
   As `VITE_*` entram no site na hora do build: depois de mudar uma delas, faça um novo deploy.
5. **Domínio:** *Settings → Networking → Custom domain*. Compre o domínio (registro.br para `.com.br`) e crie o
   CNAME que o Railway mostrar. O HTTPS é automático.
6. **Webhooks de pagamento:** Mercado Pago → `https://SEU_DOMINIO/api/webhooks/mercadopago`;
   Stripe → `https://SEU_DOMINIO/api/webhooks/stripe`.

## Firebase (login com Google)

1. console.firebase.google.com → *Criar projeto* (Analytics opcional).
2. *Authentication → Sign-in method → Google → Ativar*.
3. *Authentication → Settings → Authorized domains*: adicione o seu domínio.
4. *Configurações do projeto → Seus apps → Web (</>)*: copie `apiKey`, `authDomain`, `projectId`, `appId`
   para `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
   No servidor, `FIREBASE_PROJECT_ID` = o mesmo `projectId`. Essas chaves do site são públicas por natureza.

## Discord

1. discord.com/developers/applications → *New Application*.
2. *OAuth2*: copie **Client ID** e **Client Secret** (este só no servidor).
3. *OAuth2 → Redirects*: adicione `https://SEU_DOMINIO/api/auth/discord/callback`.

## Como o login funciona no jogo

- Tela inicial: **Entrar com Google**, **Entrar com Discord** ou convidado.
- Convidado que liga uma conta (botão **Conta** no topo) leva o progresso junto.
- Dá para ligar Google e Discord no mesmo jogador; qualquer um dos dois abre o mesmo jogo em outro aparelho.
- Se a conta já tinha jogo salvo, ela carrega esse jogo.
- Sem as chaves, em desenvolvimento os dois botões entram com contas de teste.

## Cuidados

- **Backup:** baixe o `/data/db.json` todo dia (ou use os backups de volume do provedor).
- **Uma instância só:** os dados ficam em arquivo; não ligue mais de uma réplica. Passou de alguns milhares de
  jogadores ativos por dia, o próximo passo é o PostgreSQL (o esquema já está em `apps/server/prisma`).
- **Segredos** (`SESSION_SECRET`, `DISCORD_CLIENT_SECRET`, chaves de pagamento) nunca vão para o GitHub.

## Alternativa: servidor próprio (VPS)

Em qualquer VPS com Docker (Hetzner, DigitalOcean, Contabo):

```bash
docker build -t gti --build-arg VITE_FIREBASE_API_KEY=... --build-arg VITE_FIREBASE_PROJECT_ID=... .
docker run -d --restart=always -p 3001:3001 -v /srv/gti:/data --env-file .env.producao gti
```

E um proxy com HTTPS na frente (Caddy: `seujogo.com.br { reverse_proxy localhost:3001 }`).
