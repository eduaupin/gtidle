import './env';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server as SocketServer } from 'socket.io';
import { randomUUID } from 'node:crypto';
import { BRAND, MARKET, REAL_MONEY_PRODUCTS, ROBBERIES, RULES, STAR_HEAT, isLookBurned, isVip, priceIn, type Action, type Currency, type PlayerState } from '@gti/shared';
import { advance, burnLook, giveRare, migrate, newPlayer, normalizeSlots, resolveAlert, setAfterAdvance, setSerialAllocator, setTerritoryBonus } from './engine/idle';
import * as social from './social';
import { buyListing, cancelListing, listItem, marketView, sweepExpired, type ListRequest } from './market';
import { applyAction, applyGrant, canBuyProduct, GameError } from './engine/actions';
import { FileStore } from './store/store';
import { issueToken, verifyToken } from './auth';
import { createPix, fetchPayment, paymentsLive, verifyWebhookSignature } from './payments';
import { sendPush, vapidPublicKey } from './push';
import { createCardCheckout, fetchCheckout, parseStripeWebhook, stripeLive, toCents } from './stripe';

const PORT = Number(process.env.PORT ?? 3001);
const DEV = process.env.NODE_ENV !== 'production';
const store = new FileStore(process.env.DATA_FILE ?? './data/dev-db.json');
// número de série dos raros é global (um #0042 só existe uma vez no jogo inteiro)
setSerialAllocator((itemId, supply) => store.nextSerial(itemId, supply));
// cidade viva: bônus de território e o que acontece depois de cada avanço (pontos, jornal, convites)
setTerritoryBonus(social.territoryBonusFor(store));
setAfterAdvance(social.onAdvance(store));

const app = Fastify({ logger: { level: DEV ? 'info' : 'warn' } });
await app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? true });

// Guarda o corpo cru das requisições JSON: o webhook do Stripe precisa dele para validar a assinatura.
app.removeContentTypeParser('application/json');
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  (req as unknown as { rawBody: string }).rawBody = body as string;
  if (!body) return done(null, {});
  try { done(null, JSON.parse(body as string)); }
  catch { done(Object.assign(new Error('JSON inválido'), { statusCode: 400 }), undefined); }
});

// ---------- helpers ----------
function authed(req: { headers: Record<string, unknown> }): PlayerState {
  const id = verifyToken(req.headers.authorization as string | undefined);
  const p = id ? store.getPlayer(id) : undefined;
  if (p) migrate(p);
  if (!p) throw Object.assign(new Error('Não autenticado'), { statusCode: 401 });
  return p;
}

const sanitizeNick = (s: unknown) =>
  String(s ?? '').replace(/[^\p{L}\p{N}_]/gu, '').slice(0, 16) || `Novato${Math.floor(Math.random() * 9999)}`;

// Limite simples de ações por jogador (anti-spam de cliques/bots).
const lastActions = new Map<string, number[]>();
function rateLimit(id: string, max = 20, windowMs = 5000) {
  const now = Date.now();
  const arr = (lastActions.get(id) ?? []).filter(t => now - t < windowMs);
  if (arr.length >= max) throw Object.assign(new Error('Calma aí, chefe'), { statusCode: 429 });
  arr.push(now);
  lastActions.set(id, arr);
}

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  if (err instanceof social.SocialError) return reply.code(400).send({ error: err.message });
  if (err instanceof GameError) return reply.code(400).send({ error: err.message });
  const code = err.statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: code >= 500 ? 'Erro no servidor' : err.message });
});

// ---------- conta ----------
app.post('/api/guest', async (req) => {
  const { nick, ref } = (req.body ?? {}) as { nick?: string; ref?: string };
  const { id, token } = issueToken();
  const p = newPlayer(id, sanitizeNick(nick), Date.now());
  social.applyReferral(store, p, ref, Date.now());
  store.savePlayer(p);
  return { token, player: p };
});

// ---------- estado e ações ----------
app.get('/api/state', async (req) => {
  const p = authed(req);
  const now = Date.now();
  if (req.headers['x-tab-visible'] === '1') visibleAt.set(p.id, now);
  const events = advance(p, now);
  await notifyAlert(p).catch(err => app.log.warn(err));
  store.savePlayer(p);
  return { player: p, events: events.slice(-30), serverTime: now };
});

app.post('/api/action', async (req) => {
  const p = authed(req);
  rateLimit(p.id);
  const now = Date.now();
  const events = advance(p, now);
  const extra = applyAction(p, (req.body as { action: Action }).action, now) ?? [];
  store.savePlayer(p);
  return { player: p, events: [...events, ...extra].slice(-30), serverTime: now };
});

// ---------- mercado entre jogadores ----------
const marketReply = (p: ReturnType<typeof authed>, now: number, events: unknown[] = []) =>
  ({ player: p, events, serverTime: now, market: marketView(store, p, now) });

app.get('/api/market', async (req) => {
  const p = authed(req);
  const now = Date.now();
  const events = advance(p, now);
  store.savePlayer(p);
  return marketReply(p, now, events.slice(-30));
});

app.post('/api/market/list', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 20, 60_000);
  const now = Date.now();
  advance(p, now);
  listItem(store, p, req.body as ListRequest, now);
  return marketReply(p, now);
});

app.post('/api/market/cancel', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 20, 60_000);
  const now = Date.now();
  cancelListing(store, p, String((req.body as { id?: string })?.id ?? ''));
  return marketReply(p, now);
});

app.post('/api/market/buy', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 20, 60_000);
  const now = Date.now();
  advance(p, now);
  const l = buyListing(store, p, String((req.body as { id?: string })?.id ?? ''), now);
  const name = l.kind === 'rare' ? `${l.rare?.itemId}#${l.rare?.serial}` : l.itemId;
  return marketReply(p, now, [{ type: 'market_bought', name, qty: l.qty, price: l.price }]);
});

// ---------- cidade viva ----------
/** Resposta padrão: estado do jogador + o pedaço social pedido */
function socialReply<T>(req: { headers: Record<string, unknown> }, fn: (p: PlayerState, now: number) => T, limit = true) {
  const p = authed(req);
  if (limit) rateLimit(p.id, 20, 60_000);
  const now = Date.now();
  const events = advance(p, now);
  const data = fn(p, now);
  store.savePlayer(p);
  return { player: p, events: events.slice(-30), serverTime: now, data };
}
const body = (req: { body: unknown }) => (req.body ?? {}) as Record<string, unknown>;

app.get('/api/crew', async (req) => socialReply(req, (p, now) => ({ ...social.crewView(store, p, now), team: social.teamView(store, p, now) }), false));
app.post('/api/crew/create', async (req) => socialReply(req, (p, now) => { social.createCrew(store, p, body(req).name, body(req).tag, now); return social.crewView(store, p, now); }));
app.post('/api/crew/join', async (req) => socialReply(req, (p, now) => { social.joinCrew(store, p, body(req).code, now); return social.crewView(store, p, now); }));
app.post('/api/crew/leave', async (req) => socialReply(req, (p, now) => { social.leaveCrew(store, p); return social.crewView(store, p, now); }));

app.post('/api/team/create', async (req) => socialReply(req, (p, now) => { social.createTeam(store, p, body(req).heistId, body(req).role, now); return social.teamView(store, p, now); }));
app.post('/api/team/join', async (req) => socialReply(req, (p, now) => { social.joinTeam(store, p, body(req).code, body(req).role, now); return social.teamView(store, p, now); }));
app.post('/api/team/leave', async (req) => socialReply(req, (p, now) => { social.leaveTeam(store, p); return social.teamView(store, p, now); }));

app.get('/api/news', async () => ({ news: social.newsFeed(store) }));

app.get('/api/race', async (req) => socialReply(req, (p, now) => social.raceBoard(store, p, now), false));
app.post('/api/race/start', async (req) => socialReply(req, (p, now) => social.startRace(p, now)));
app.post('/api/race/finish', async (req) => socialReply(req, (p, now) => {
  const r = social.finishRace(store, p, body(req).raceId, body(req).distance, now);
  return { ...r, board: social.raceBoard(store, p, now) };
}));

app.post('/api/gift', async (req) => socialReply(req, (p, now) => social.giftCosmetic(store, p, body(req).to, body(req).itemId, now)));

// Ficha criminal: pública (qualquer um com o código vê, sem login)
app.get('/api/profile/:code', async (req) => {
  const code = String((req.params as { code: string }).code ?? '');
  const target = social.findByCode(store, code) ?? store.findPlayerByNick(code);
  if (!target) throw Object.assign(new Error('Ficha não encontrada'), { statusCode: 404 });
  migrate(target);
  return social.profile(store, target, Date.now());
});

app.post('/api/inbox/read', async (req) => socialReply(req, p => { for (const m of p.inbox) m.read = true; return null; }, false));

app.get('/api/auction', async (req) => socialReply(req, (p, now) => social.auctionView(store, p, now), false));
app.post('/api/auction/create', async (req) => socialReply(req, (p, now) => { social.createAuction(store, p, body(req).uid, body(req).start, now, DEV); return social.auctionView(store, p, now); }));
app.post('/api/auction/bid', async (req) => socialReply(req, (p, now) => { social.bidAuction(store, p, body(req).id, body(req).amount, now); return social.auctionView(store, p, now); }));

// golpes em equipe, leilões e territórios andam mesmo com todo mundo offline
setInterval(() => {
  const now = Date.now();
  social.sweepTeams(store, now);
  social.sweepAuctions(store, now);
  social.settleTerritories(store, now);
}, 30_000).unref();

// Saque em cripto: desligado de propósito. Ver MARKET.withdrawEnabled e o README antes de ligar.
app.post('/api/market/withdraw', async () => {
  if (!MARKET.withdrawEnabled) throw Object.assign(new Error('Saque em breve: depende de parceiro autorizado pelo Banco Central'), { statusCode: 403 });
  throw Object.assign(new Error('Saque não configurado'), { statusCode: 501 });
});

// anúncios vencidos voltam para o dono mesmo que ninguém abra o mercado
setInterval(() => sweepExpired(store, Date.now()), 60_000).unref();

// ---------- notificações push ----------
app.get('/api/push/key', async () => ({ publicKey: vapidPublicKey() }));

app.post('/api/push/subscribe', async (req) => {
  const p = authed(req);
  const { subscription } = req.body as { subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  const ep = subscription?.endpoint, keys = subscription?.keys;
  if (!ep || !/^https:\/\//.test(ep) || !keys?.p256dh || !keys?.auth) throw Object.assign(new Error('Inscrição inválida'), { statusCode: 400 });
  const subs = store.getPushSubs(p.id).filter(s => s.endpoint !== ep).slice(-4); // até 5 navegadores
  store.setPushSubs(p.id, [...subs, { endpoint: ep, keys: { p256dh: keys.p256dh, auth: keys.auth } }]);
  return { ok: true };
});

app.post('/api/push/unsubscribe', async (req) => {
  const p = authed(req);
  const { endpoint } = req.body as { endpoint: string };
  store.setPushSubs(p.id, store.getPushSubs(p.id).filter(s => s.endpoint !== endpoint));
  return { ok: true };
});

/**
 * Manda os pushes pendentes do jogador, cada um uma vez só:
 *  - polícia monitorando o roubo
 *  - 3 estrelas: hora de ir para o esconderijo
 *  - esconderijo: já pode voltar ao corre
 * Se a aba do jogo está visível, nada é enviado (o aviso aparece no próprio jogo).
 */
// Quando a aba do jogo está visível, o aviso aparece dentro do jogo e o push não é enviado.
const visibleAt = new Map<string, number>();

async function notifyAlert(p: PlayerState) {
  const now = Date.now();
  const msgs: { title: string; body: string; tag: string; url: string }[] = [];
  const a = p.alert;
  if (a && !a.notified && a.status === 'pending') {
    a.notified = true;
    const job = ROBBERIES.find(r => r.id === a.jobId);
    msgs.push({
      title: 'Seu roubo está sendo monitorado',
      body: `A polícia está de olho em "${job?.name ?? 'seu assalto'}". Volte em até ${Math.round(RULES.alertWindowSec / 60)} minutos para despistar, ou o golpe fica fraco.`,
      tag: `alerta-${a.id}`, url: '/?alerta=1',
    });
  }
  if (p.heatWarning && !p.heatWarning.notified) {
    p.heatWarning.notified = true;
    msgs.push({
      title: 'Barra suja: 3 estrelas',
      body: `A polícia está fechando o cerco. Leve a gangue para o esconderijo por ${RULES.hideoutMinutes} minutos ou ela vai presa.`,
      tag: 'barra-suja', url: '/?esconderijo=1',
    });
  }
  if (p.lookBurn && !p.lookBurn.notified) {
    p.lookBurn.notified = true;
    msgs.push({
      title: 'A polícia conhece seu visual',
      body: 'Quatro estrelas: sua roupa e seu carro foram queimados. Troque os dois para a gangue voltar a roubar.',
      tag: 'visual-queimado', url: '/?visual=1',
    });
  }
  const h = p.hideout;
  if (h && !h.readyNotified && now >= h.until) {
    h.readyNotified = true;
    msgs.push({
      title: 'A barra esfriou',
      body: 'Sua gangue já pode sair do esconderijo. Volte ao corre.',
      tag: 'esconderijo-pronto', url: '/?esconderijo=1',
    });
  }
  if (!msgs.length || now - (visibleAt.get(p.id) ?? 0) < 8_000) return;
  let subs = store.getPushSubs(p.id);
  if (!subs.length) return;
  for (const m of msgs) subs = await sendPush(subs, m);
  store.setPushSubs(p.id, subs);
}

// Quem fechou a aba não chama /api/state, então o servidor avança sozinho, a cada 15 s,
// quem tem notificação ativa: cria alertas na hora certa e manda os avisos.
setInterval(() => {
  const now = Date.now();
  for (const id of store.playersWithPush()) {
    const p = store.getPlayer(id);
    if (!p) continue;
    migrate(p);
    advance(p, now);
    notifyAlert(p).catch(err => app.log.warn(err)).finally(() => store.savePlayer(p));
  }
}, 15_000).unref();

// ---------- anúncio recompensado (despistar a polícia) ----------
// O navegador não tem como provar que o anúncio foi assistido, então o servidor limita o abuso:
// token de uso único, tempo mínimo entre começar e concluir, e limite diário por jogador.
type AdPurpose = 'alert' | 'market_slot';
const adSessions = new Map<string, { playerId: string; startedAt: number; purpose: AdPurpose }>();
const brDay = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);

app.post('/api/ads/start', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 6, 60_000);
  const purpose: AdPurpose = (req.body as { purpose?: string } | undefined)?.purpose === 'market_slot' ? 'market_slot' : 'alert';
  if (purpose === 'alert' && !p.alert) throw Object.assign(new Error('Não tem polícia de olho agora'), { statusCode: 400 });
  if (purpose === 'market_slot') {
    if (isVip(p, Date.now())) throw Object.assign(new Error('O Clube Rockeiro já tem 10 vagas'), { statusCode: 400 });
    if ((p.market.adSlotUntil ?? 0) > Date.now()) throw Object.assign(new Error('Você já tem a vaga extra de hoje'), { statusCode: 400 });
  }
  const today = brDay(Date.now());
  if (p.ads.day !== today) p.ads = { day: today, count: 0 };
  if (p.ads.count >= RULES.adsPerDay) throw Object.assign(new Error('Limite de anúncios de hoje atingido'), { statusCode: 429 });
  for (const [k, v] of adSessions) if (v.playerId === p.id || Date.now() - v.startedAt > 10 * 60_000) adSessions.delete(k);
  const token = randomUUID();
  adSessions.set(token, { playerId: p.id, startedAt: Date.now(), purpose });
  return { token, minSec: RULES.adMinSec };
});

app.post('/api/ads/complete', async (req) => {
  const p = authed(req);
  const { token } = req.body as { token: string };
  const s = adSessions.get(token);
  if (!s || s.playerId !== p.id) throw Object.assign(new Error('Sessão de anúncio inválida'), { statusCode: 400 });
  if (Date.now() - s.startedAt < RULES.adMinSec * 1000) throw Object.assign(new Error('O anúncio ainda não terminou'), { statusCode: 400 });
  adSessions.delete(token);
  const now = Date.now();
  const events = advance(p, now);
  p.ads.count += 1;
  // recompensa presa à conta: nunca vira diamante negociável nem item vendável
  const extra = s.purpose === 'market_slot'
    ? (p.market.adSlotUntil = now + MARKET.adSlotHours * 3600_000, [])
    : resolveAlert(p, 'ad', now);
  store.savePlayer(p);
  return { player: p, events: [...events, ...extra].slice(-30), serverTime: now };
});

app.get('/api/ranking', async () => {
  return store.allPlayers()
    .sort((a, b) => b.level - a.level || b.xp - a.xp)
    .slice(0, 20)
    .map(p => ({ nick: p.nick, level: p.level, founder: p.flags.founder, vip: (p.vipUntil ?? 0) > Date.now() }));
});

// ---------- loja ----------
// Dois meios de pagamento:
//  - Pix (Mercado Pago): só em reais, taxa menor, para quem está no Brasil.
//  - Cartão (Stripe Checkout): reais ou dólares, aceita cartões do mundo todo, Apple Pay e Google Pay.
app.get('/api/shop', async () => {
  const now = Date.now();
  return {
    pixLive: paymentsLive(),
    cardLive: stripeLive(),
    products: REAL_MONEY_PRODUCTS.filter(x => !x.availableUntil || Date.parse(x.availableUntil) > now),
  };
});

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const badRequest = (msg: string) => Object.assign(new Error(msg), { statusCode: 400 });

// Pix: o jogo mostra o QR e o copia-e-cola.
app.post('/api/shop/pix', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 5, 60_000);
  const { productId, email, giftTo } = req.body as { productId: string; email: string; giftTo?: string };
  if (!EMAIL_RE.test(String(email ?? ''))) throw badRequest('Informe um e-mail válido');
  const gift = giftTarget(p, giftTo);
  const prod = canBuyProduct(gift ?? p, productId, Date.now());
  const orderId = randomUUID();
  const pix = await createPix({ orderId, amount: prod.priceBRL, description: `${BRAND.name} - ${prod.name}`, email });
  store.createOrder({
    id: orderId, playerId: p.id, productId: prod.id, amount: prod.priceBRL, currency: 'BRL', provider: 'mercadopago',
    status: 'pending', createdAt: Date.now(), providerRef: pix.paymentId, expiresAt: pix.expiresAt,
    ...(gift ? { giftTo: gift.id } : {}),
  });
  return {
    orderId, mode: paymentsLive() ? 'live' : 'dev', productName: prod.name, amount: prod.priceBRL,
    qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64, ticketUrl: pix.ticketUrl, expiresAt: pix.expiresAt,
  };
});

// Cartão: devolve a URL da página de pagamento do Stripe.
app.post('/api/shop/card', async (req) => {
  const p = authed(req);
  rateLimit(p.id, 5, 60_000);
  const { productId, currency, email, giftTo } = req.body as { productId: string; currency: Currency; email?: string; giftTo?: string };
  if (currency !== 'BRL' && currency !== 'USD') throw badRequest('Moeda inválida');
  if (email && !EMAIL_RE.test(email)) throw badRequest('Informe um e-mail válido');
  const gift = giftTarget(p, giftTo);
  const prod = canBuyProduct(gift ?? p, productId, Date.now());
  const amount = priceIn(prod, currency);
  const orderId = randomUUID();
  const checkout = await createCardCheckout({ orderId, amount, currency, productName: `${BRAND.name} - ${prod.name}`, email });
  store.createOrder({
    id: orderId, playerId: p.id, productId: prod.id, amount, currency, provider: 'stripe',
    status: 'pending', createdAt: Date.now(), providerRef: checkout.sessionId,
    expiresAt: Date.now() + 24 * 3600_000, // sessões do Stripe expiram em 24 h
    ...(gift ? { giftTo: gift.id } : {}),
  });
  return { orderId, mode: stripeLive() ? 'live' : 'dev', checkoutUrl: checkout.url, amount, currency };
});

// O jogo consulta a cada poucos segundos. O servidor confirma direto no provedor,
// então funciona mesmo sem webhook (ex.: rodando em localhost).
app.get('/api/shop/order/:id', async (req) => {
  const p = authed(req);
  const order = store.getOrder((req.params as { id: string }).id);
  if (!order || order.playerId !== p.id) throw Object.assign(new Error('Pedido não encontrado'), { statusCode: 404 });
  if (order.status === 'pending' && order.providerRef) {
    if (order.provider === 'mercadopago' && paymentsLive()) await confirmPix(order.providerRef).catch(err => app.log.warn(err));
    if (order.provider === 'stripe' && stripeLive()) await confirmCard(order.providerRef).catch(err => app.log.warn(err));
  }
  const fresh = store.getOrder(order.id)!;
  const expired = fresh.status === 'pending' && fresh.expiresAt !== undefined && Date.now() > fresh.expiresAt;
  const prod = REAL_MONEY_PRODUCTS.find(x => x.id === fresh.productId);
  return { status: expired ? 'expired' : fresh.status, productName: prod?.name ?? '', amount: fresh.amount, currency: fresh.currency };
});

/** Presente pago: quem recebe (pelo código da ficha ou nick). Só produtos de Clube e diamantes. */
function giftTarget(p: PlayerState, giftTo?: string) {
  if (!giftTo) return undefined;
  const to = social.findByCode(store, giftTo) ?? store.findPlayerByNick(giftTo);
  if (!to) throw badRequest('Jogador do presente não encontrado (use o código da ficha dele)');
  if (to.id === p.id) throw badRequest('Presente é para os outros');
  migrate(to);
  return to;
}

async function confirmPix(paymentId: string) {
  const pay = await fetchPayment(paymentId);
  const order = store.getOrder(pay.external_reference);
  if (pay.status === 'approved' && order && order.currency === 'BRL' && Math.abs(pay.transaction_amount - order.amount) < 0.01) {
    fulfillOrder(order.id);
  } else if (order && order.status === 'pending' && ['rejected', 'cancelled'].includes(pay.status)) {
    order.status = 'rejected';
    store.updateOrder(order);
  }
}

async function confirmCard(sessionId: string) {
  const info = await fetchCheckout(sessionId);
  const order = info.orderId ? store.getOrder(info.orderId) : undefined;
  if (!order) return;
  if (info.paid && info.currency === order.currency && info.amountCents === toCents(order.amount)) {
    fulfillOrder(order.id);
  } else if (info.expired && order.status === 'pending') {
    order.status = 'expired';
    store.updateOrder(order);
  }
}

function fulfillOrder(orderId: string) {
  const order = store.getOrder(orderId);
  if (!order || order.status === 'approved') return; // idempotente: webhook pode chegar repetido
  const buyer = store.getPlayer(order.playerId);
  const p = order.giftTo ? store.getPlayer(order.giftTo) : buyer;
  const prod = REAL_MONEY_PRODUCTS.find(x => x.id === order.productId);
  if (!p || !prod) return;
  const now = Date.now();
  migrate(p);
  advance(p, now);
  applyGrant(p, prod.grants, now);
  normalizeSlots(p, now);
  order.status = 'approved';
  store.updateOrder(order);
  if (order.giftTo && buyer) {
    social.inbox(p, `${buyer.nick} te deu de presente: ${prod.name}!`, now);
    buyer.stats.giftsSent = (buyer.stats.giftsSent ?? 0) + 1;
    social.inbox(buyer, `Seu presente (${prod.name}) chegou para ${p.nick}.`, now);
    store.savePlayer(buyer);
    io.to(buyer.id).emit('purchase', { productId: prod.id, gift: true });
  }
  store.savePlayer(p);
  io.to(p.id).emit('purchase', { productId: prod.id });
}

app.post('/api/webhooks/mercadopago', async (req, reply) => {
  const q = req.query as Record<string, string | undefined>;
  const body = (req.body ?? {}) as { type?: string; data?: { id?: string } };
  const dataId = String(q['data.id'] ?? body.data?.id ?? '');
  const type = q.type ?? body.type;
  if (!dataId || type !== 'payment') return reply.code(200).send({ ok: true });
  if (!verifyWebhookSignature(req.headers['x-signature'] as string, req.headers['x-request-id'] as string, dataId)) {
    return reply.code(401).send({ error: 'assinatura inválida' });
  }
  await confirmPix(dataId).catch(err => app.log.error(err));
  reply.code(200).send({ ok: true });
});

app.post('/api/webhooks/stripe', async (req, reply) => {
  let event;
  try {
    event = parseStripeWebhook((req as unknown as { rawBody: string }).rawBody, req.headers['stripe-signature'] as string);
  } catch (err) {
    app.log.warn(err);
    return reply.code(400).send({ error: 'assinatura inválida' });
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded'
      || event.type === 'checkout.session.expired') {
    // Reconsulta a sessão no Stripe em vez de confiar só no corpo do evento.
    await confirmCard((event.data.object as { id: string }).id).catch(err => app.log.error(err));
  }
  reply.code(200).send({ received: true });
});

if (DEV) {
  // Simula o pagamento aprovado. Desligado em produção.
  // Força um alerta de polícia agora (para testar sem esperar 12–25 min).
  app.post('/api/dev/alert', async (req) => {
    const p = authed(req);
    const now = Date.now();
    advance(p, now);
    if (!p.robberies.some(s => s.jobId)) throw Object.assign(new Error('Mande a gangue para um assalto antes'), { statusCode: 400 });
    p.alert = null;
    p.level = Math.max(p.level, RULES.alertMinLevel);
    p.nextAlertAt = now;
    const events = advance(p, now + 1000);
    p.lastTick = now; // não adianta o relógio do jogador
    await notifyAlert(p).catch(err => app.log.warn(err));
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  // Leva o procurado direto a 3 estrelas (para testar o esconderijo).
  app.post('/api/dev/heat', async (req) => {
    const p = authed(req);
    const now = Date.now();
    advance(p, now);
    if (p.hideout) throw Object.assign(new Error('A gangue já está escondida'), { statusCode: 400 });
    p.heat = RULES.hideoutTriggerHeat + 2;
    p.heatWarning = { at: now, notified: false };
    await notifyAlert(p).catch(err => app.log.warn(err));
    store.savePlayer(p);
    return { player: p, events: [{ type: 'heat_warning' }], serverTime: now };
  });

  // Queima o visual em uso agora (para testar a troca de roupa e carro).
  // Itens de mercado para testar: peças, planos, dois raros e 1.000 diamantes "comprados"
  app.post('/api/dev/loot', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    for (const k of Object.keys(p.inventory.parts) as (keyof typeof p.inventory.parts)[]) p.inventory.parts[k] += 20;
    p.inventory.plans.plano_carroforte = (p.inventory.plans.plano_carroforte ?? 0) + 2;
    p.inventory.plans.plano_cofre = (p.inventory.plans.plano_cofre ?? 0) + 1;
    giveRare(p, now, events); giveRare(p, now, events);
    p.diamondsPaid += 1000;
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  // Pula para o nível 90 (testar o mapa inteiro)
  app.post('/api/dev/level', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    p.level = Math.max(p.level, 90);
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  // Grana para testar a loja de visuais e a evolução
  app.post('/api/dev/cash', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    p.cash += 100_000;
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });
  // Grana suja para testar a lavanderia e o seguro
  app.post('/api/dev/dirty', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    p.dirtyCash += 50_000;
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  // Põe o procurado numa quantidade de estrelas (0 a 6) para ver a polícia no mapa
  app.post('/api/dev/wanted', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    const stars = Math.max(0, Math.min(6, Number((req.body as { stars?: number })?.stars ?? 0)));
    p.heat = stars ? Math.min(99, STAR_HEAT[stars] + 2) : 0;
    if (stars >= 3 && !p.hideout && !p.heatWarning) { p.heatWarning = { at: now, notified: false }; events.push({ type: 'heat_warning' }); }
    if (stars < 3) p.heatWarning = null;
    if (stars >= 4 && !isLookBurned(p, now)) burnLook(p, now, events);
    await notifyAlert(p).catch(err => app.log.warn(err));
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  app.post('/api/dev/burn', async (req) => {
    const p = authed(req);
    const now = Date.now();
    const events = advance(p, now);
    p.heat = Math.max(p.heat, RULES.lookBurnHeat + 1);
    burnLook(p, now, events);
    await notifyAlert(p).catch(err => app.log.warn(err));
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  // Encurta a espera no esconderijo (para testar sem esperar 5 min).
  app.post('/api/dev/hideout-skip', async (req) => {
    const p = authed(req);
    const now = Date.now();
    advance(p, now);
    if (p.hideout) {
      const skippedSec = Math.max(0, (p.hideout.until - now) / 1000);
      p.heat = Math.max(0, p.heat - (RULES.hideoutHeatDecayPerSec + RULES.heatDecayPerSec) * skippedSec);
      p.hideout.until = now;
    }
    const events = advance(p, now + 1000);
    p.lastTick = now;
    store.savePlayer(p);
    return { player: p, events, serverTime: now };
  });

  app.post('/api/dev/approve/:orderId', async (req) => {
    const p = authed(req);
    const order = store.getOrder((req.params as { orderId: string }).orderId);
    if (order?.playerId === p.id) fulfillOrder(order.id);
    return { ok: true };
  });
}

app.get('/api/health', async () => ({ ok: true }));

// ---------- tempo real: chat ----------
await app.listen({ port: PORT, host: '0.0.0.0' });
const io = new SocketServer(app.server, { cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*' } });
const lastChat = new Map<string, number>();

io.on('connection', (socket) => {
  const id = verifyToken(socket.handshake.auth?.token);
  const p = id ? store.getPlayer(id) : undefined;
  if (!p) return socket.disconnect();
  socket.join(p.id);
  io.emit('online', io.engine.clientsCount);

  socket.on('chat', (raw: unknown) => {
    const now = Date.now();
    if (now - (lastChat.get(p.id) ?? 0) < 2000) return; // 1 msg a cada 2 s
    lastChat.set(p.id, now);
    const text = String(raw ?? '')
      .replace(/https?:\/\/\S+|www\.\S+/gi, '[link removido]') // chat sem links, como no PokeIdle
      .slice(0, 200).trim();
    if (!text) return;
    const fresh = store.getPlayer(p.id)!;
    io.emit('chat', {
      nick: fresh.nick, text, at: now,
      vip: (fresh.vipUntil ?? 0) > now, founder: fresh.flags.founder,
    });
  });
  socket.on('disconnect', () => io.emit('online', io.engine.clientsCount));
});

app.log.info(`Servidor no ar na porta ${PORT}. Pix: ${paymentsLive() ? 'real' : 'teste'}. Cartão: ${stripeLive() ? 'real' : 'teste'}.`);
