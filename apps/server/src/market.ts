// Mercado entre jogadores. Regras que fecham a conta:
//  - preços em diamantes; só se compra com diamantes COMPRADOS ou com saldo de vendas
//    (diamantes ganhos com anúncio ou missão não entram, senão anúncio vira dinheiro);
//  - quem vende recebe saldo de mercado já sem a taxa (10%, ou 5% no Clube Rockeiro);
//  - o item fica em custódia no anúncio e volta para o dono se cancelar ou vencer;
//  - o saque em cripto existe só como regra (MARKET.withdrawEnabled = false) até ter parceiro autorizado.
import { randomUUID } from 'node:crypto';
import {
  DIAMOND_ITEMS, HEIST_PLANS, MARKET, PARTS, isVip, marketFee, marketSlots, ownsItem,
  type PartId, type PlayerState,
} from '@gti/shared';
import type { Listing, Store } from './store/store';

export class MarketError extends Error { statusCode = 400; }
const fail = (msg: string): never => { throw new MarketError(msg); };

export type ListRequest =
  | { kind: 'rare'; uid: string; price: number }
  | { kind: 'part'; itemId: PartId; qty: number; price: number }
  | { kind: 'plan'; itemId: string; qty: number; price: number };

export const itemName = (l: Pick<Listing, 'kind' | 'itemId'>) =>
  l.kind === 'part' ? PARTS.find(x => x.id === l.itemId)?.name ?? l.itemId
  : l.kind === 'plan' ? HEIST_PLANS.find(x => x.id === l.itemId)?.planName ?? l.itemId
  : DIAMOND_ITEMS.find(x => x.id === l.itemId)?.name ?? l.itemId;

/** Tira o raro da roupa/carro em uso se o jogador não tiver mais nenhum igual. */
function unequipIfGone(p: PlayerState, itemId: string) {
  if (ownsItem(p, itemId)) return;
  const e = p.equipped;
  if (e.character === itemId) e.character = 'skin_padrao';
  if (e.vehicle === itemId) e.vehicle = 'carro_padrao';
  if (e.jewelry === itemId) e.jewelry = null;
  if (e.weapon === itemId) e.weapon = null;
}

function giveTo(p: PlayerState, l: Listing) {
  if (l.kind === 'rare' && l.rare) p.inventory.rares.push(l.rare);
  else if (l.kind === 'part') p.inventory.parts[l.itemId as PartId] += l.qty;
  else if (l.kind === 'plan') p.inventory.plans[l.itemId] = (p.inventory.plans[l.itemId] ?? 0) + l.qty;
}

const activeOf = (store: Store, playerId: string, now: number) =>
  store.listings().filter(l => l.sellerId === playerId && l.expiresAt > now);

export function listItem(store: Store, p: PlayerState, req: ListRequest, now: number): Listing {
  sweepExpired(store, now);
  const vip = isVip(p, now);
  if (activeOf(store, p.id, now).length >= marketSlots(p, vip, now)) {
    fail(vip ? 'Todas as vagas de anúncio estão ocupadas' : 'Vagas ocupadas. Assista um anúncio para ganhar mais uma por 24 h, ou entre no Clube Rockeiro (10 vagas)');
  }
  const price = Math.floor(Number(req.price));
  if (!Number.isFinite(price) || price < MARKET.minPrice || price > MARKET.maxPrice) fail(`Preço entre ${MARKET.minPrice} e ${MARKET.maxPrice.toLocaleString('pt-BR')} diamantes`);
  const base = {
    id: randomUUID(), sellerId: p.id, sellerNick: p.nick, sellerVip: vip, price, createdAt: now,
    expiresAt: now + (vip ? MARKET.durationHoursVip : MARKET.durationHoursFree) * 3600_000,
  };
  let listing: Listing;
  if (req.kind === 'rare') {
    const idx = p.inventory.rares.findIndex(r => r.uid === req.uid);
    if (idx < 0) fail('Você não tem esse item');
    const [rare] = p.inventory.rares.splice(idx, 1);
    unequipIfGone(p, rare.itemId);
    listing = { ...base, kind: 'rare', itemId: rare.itemId, qty: 1, rare };
  } else {
    const qty = Math.floor(Number(req.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MARKET.maxQty) fail(`Quantidade entre 1 e ${MARKET.maxQty}`);
    if (req.kind === 'part') {
      if (!PARTS.some(x => x.id === req.itemId)) fail('Peça não existe');
      if ((p.inventory.parts[req.itemId] ?? 0) < qty) fail('Você não tem peças suficientes');
      p.inventory.parts[req.itemId] -= qty;
    } else {
      if (!HEIST_PLANS.some(x => x.id === req.itemId)) fail('Plano não existe');
      if ((p.inventory.plans[req.itemId] ?? 0) < qty) fail('Você não tem planos suficientes');
      p.inventory.plans[req.itemId] -= qty;
      if (!p.inventory.plans[req.itemId]) delete p.inventory.plans[req.itemId];
    }
    listing = { ...base, kind: req.kind, itemId: req.itemId, qty };
  }
  store.putListing(listing);
  store.savePlayer(p);
  return listing;
}

export function cancelListing(store: Store, p: PlayerState, id: string) {
  const l = store.listings().find(x => x.id === id) ?? fail('Anúncio não encontrado');
  if (l.sellerId !== p.id) fail('Esse anúncio não é seu');
  store.removeListing(id);
  giveTo(p, l);
  store.savePlayer(p);
}

export function buyListing(store: Store, buyer: PlayerState, id: string, now: number) {
  sweepExpired(store, now);
  const l = store.listings().find(x => x.id === id) ?? fail('Esse item já foi vendido');
  if (l.sellerId === buyer.id) fail('Você não pode comprar o próprio anúncio');
  const usable = buyer.market.balance + buyer.diamondsPaid;
  if (usable < l.price) {
    fail(buyer.diamondsEarned > 0
      ? 'No mercado só valem diamantes comprados e saldo de vendas. Os diamantes ganhos jogando ficam para a loja.'
      : 'Diamantes insuficientes');
  }
  const seller = store.getPlayer(l.sellerId);
  store.removeListing(id);
  const fromBalance = Math.min(buyer.market.balance, l.price);
  buyer.market.balance -= fromBalance;
  buyer.diamondsPaid -= l.price - fromBalance;
  buyer.market.bought += 1;
  giveTo(buyer, l);
  if (seller) {
    const fee = marketFee(isVip(seller, now));
    seller.market.balance += Math.floor(l.price * (1 - fee));
    seller.market.sold += 1;
    store.savePlayer(seller);
  }
  store.addSale({ itemId: l.itemId, kind: l.kind, qty: l.qty, price: l.price, at: now });
  store.savePlayer(buyer);
  return l;
}

/** Anúncios vencidos voltam para o dono. */
export function sweepExpired(store: Store, now: number) {
  for (const l of store.listings()) {
    if (l.expiresAt > now) continue;
    store.removeListing(l.id);
    const seller = store.getPlayer(l.sellerId);
    if (seller) { giveTo(seller, l); store.savePlayer(seller); }
  }
}

/** Tudo que a aba Mercado precisa ver. */
export function marketView(store: Store, p: PlayerState, now: number) {
  sweepExpired(store, now);
  const vip = isVip(p, now);
  const all = store.listings().filter(l => l.expiresAt > now);
  // vitrine: anúncios de VIP em destaque primeiro, depois os mais novos
  const listings = all.filter(l => l.sellerId !== p.id)
    .sort((a, b) => Number(b.sellerVip) - Number(a.sellerVip) || b.createdAt - a.createdAt)
    .slice(0, 200)
    .map(l => ({ ...l, sellerId: undefined, name: itemName(l) }));
  const stats: Record<string, { last: number; avg: number; count: number }> = {};
  for (const s of store.sales().slice(-500)) {
    const unit = s.price / s.qty;
    const st = (stats[s.itemId] ??= { last: 0, avg: 0, count: 0 });
    st.avg = (st.avg * st.count + unit) / (st.count + 1); st.count += 1; st.last = unit;
  }
  return {
    listings,
    mine: all.filter(l => l.sellerId === p.id).map(l => ({ ...l, name: itemName(l) })),
    stats,
    me: {
      vip,
      fee: marketFee(vip),
      slots: marketSlots(p, vip, now),
      used: all.filter(l => l.sellerId === p.id).length,
      balance: p.market.balance,
      paid: p.diamondsPaid,
      earned: p.diamondsEarned,
      adSlotUntil: p.market.adSlotUntil,
    },
    withdraw: {
      enabled: MARKET.withdrawEnabled, min: MARKET.withdrawMin, usdPer1000: MARKET.withdrawUsdPer1000,
      holdDays: vip ? MARKET.holdDaysVip : MARKET.holdDaysFree,
    },
  };
}
