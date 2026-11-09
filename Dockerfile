# Imagem única: o servidor Node entrega a API, o tempo real (socket.io) e o site já montado.
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY . .
# As variáveis VITE_* entram no site na hora do build (são públicas: chave do Firebase web, AdSense)
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_ADSENSE_CLIENT
ARG VITE_ADS_TEST=on
RUN npm run build

ENV NODE_ENV=production PORT=3001 DATA_FILE=/data/db.json
# Os dados do jogo ficam aqui: monte um volume persistente nesse caminho
VOLUME /data
EXPOSE 3001
CMD ["npm", "start", "--workspace", "@gti/server"]
