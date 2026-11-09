// Venda de itens entre jogadores por dinheiro real (RMT).
//
// Fluxo: o vendedor anuncia em reais → o item sai da mochila e fica em custódia → o comprador paga por Pix
// ou cartão (mesmo checkout da loja) → o pagamento aprovado entrega o item e credita o vendedor, com a
// taxa da plataforma descontada → o valor fica RETIDO alguns dias (estorno e fraude) e depois vira saldo.
//
// O saque para conta bancária está desligado (`RMT.payoutsEnabled = false`). Antes de ligar:
// intermediário de pagamento com repasse ao vendedor (Mercado Pago marketplace ou Stripe Connect),
// identificação de quem saca e revisão de um advogado. Em produção o RMT inteiro só liga com RMT_ENABLED=on.
import { randomUUID } from 'node:crypto';
import { DIAMOND_ITEMS, RMT, formatBRL, gearScore, type PlayerState, type RareInstance } from '@gti/shared';
import type { Store } from './store/store';
import { inbox } from './social';

export class RmtError extends Error { statusCode = 400; }
const fail = (m: string): never => { throw new RmtError(m); };
const DEV = process.env.NODE_ENV !== 'production';
export const rmtEnabled = () => DEV || process.env.RMT_ENABLED === 'on';

export interface RmtListing {
  id: string; sellerId: string; sellerNick: string; item: RareInstance; price: number;
  status: 'open' | 'reserved' | 'sold' | 'cancelled' | 'expired';
  createdAt: number; expiresAt: number;
  reservedBy?: string; reservedOrder?: string; reservedUntil?: number;
  buyerId?: string; soldAt?: number;
}
const doc = (s: Store) => s.getDoc<RmtListing[]>('rmt', () => []);
const itemName = (g: RareInstance) => {
  const n = DIAMOND_ITEMS.find(i => i.id === g.itemId)?.name ?? g.itemId;
  return g.serial > 0 ? `${n} #${String(g.serial).padStart(4, '0')}` : n;
};
const linked = (p: PlayerState) => (p.accounts ?? []).length > 0;

/** Libera os valores retidos que já passaram do prazo */
export function settleWallet(p: PlayerState, now: number) {
  const keep: PlayerState['rmt']['pending'] = [];
  for (const e of p.rmt.pending) { if (e.releaseAt <= now) p.rmt.available += e.amount; else keep.push(e); }
  p.rmt.pending = keep;
  p.rmt.available = Math.round(p.rmt.available * 100) / 100;
}

export function sweepRmt(s: Store, now: number) {
  for (const l of doc(s)) {
    if (l.status === 'open' && l.expiresAt <= now) {
      const seller = s.getPlayer(l.sellerId);
      if (seller) { seller.inventory.rares.push(l.item); inbox(seller, `Seu anúncio de ${itemName(l.item)} por ${formatBRL(l.price)} venceu: o item voltou para a mochila.`, now); s.savePlayer(seller); }
      l.status = 'expired'; s.touch();
    }
    if (l.status === 'reserved' && (l.reservedUntil ?? 0) <= now) {
      // pagamento não chegou a tempo: o anúncio volta para a vitrine
      l.status = 'open'; delete l.reservedBy; delete l.reservedOrder; delete l.reservedUntil; s.touch();
    }
  }
  const list = doc(s);
  const keep = list.filter(l => l.status === 'open' || l.status === 'reserved' || now - (l.soldAt ?? l.expiresAt) < 30 * 864e5);
  if (keep.length !== list.length) { list.length = 0; list.push(...keep); s.touch(); }
}

export function listRmt(s: Store, p: PlayerState, uid: unknown, price: unknown, now: number) {
  if (!rmtEnabled()) fail('Venda por dinheiro real ainda não está liberada');
  if (!linked(p)) fail('Para vender por dinheiro real, ligue sua conta Google ou Discord (botão Conta)');
  if (p.level < RMT.sellerMinLevel) fail(`Venda por dinheiro real a partir do nível ${RMT.sellerMinLevel}`);
  sweepRmt(s, now);
  if (doc(s).filter(l => l.sellerId === p.id && (l.status === 'open' || l.status === 'reserved')).length >= RMT.maxListings) fail(`Máximo de ${RMT.maxListings} anúncios abertos`);
  const v = Math.round(Number(price) * 100) / 100;
  if (!Number.isFinite(v) || v < RMT.minPrice || v > RMT.maxPrice) fail(`Preço entre ${formatBRL(RMT.minPrice)} e ${formatBRL(RMT.maxPrice)}`);
  const idx = p.inventory.rares.findIndex(r => r.uid === uid);
  if (idx < 0) fail('Item não está na mochila');
  const g = p.inventory.rares[idx];
  if (g.bound) fail('Item inicial: preso à conta');
  if (Object.values(p.gearOn).includes(g.uid)) fail('Tire o item antes de anunciar');
  p.inventory.rares.splice(idx, 1);
  const l: RmtListing = {
    id: randomUUID(), sellerId: p.id, sellerNick: p.nick, item: g, price: v, status: 'open',
    createdAt: now, expiresAt: now + RMT.listingDays * 864e5,
  };
  doc(s).push(l); s.savePlayer(p); s.touch();
  return l;
}

export function cancelRmt(s: Store, p: PlayerState, id: unknown, now: number) {
  sweepRmt(s, now);
  const l = doc(s).find(x => x.id === id && x.sellerId === p.id) ?? fail('Anúncio não encontrado');
  if (l.status === 'reserved') fail('Alguém está pagando por esse item agora. Tente de novo em alguns minutos.');
  if (l.status !== 'open') fail('Anúncio já encerrado');
  l.status = 'cancelled';
  p.inventory.rares.push(l.item);
  s.savePlayer(p); s.touch();
}

/** Segura o anúncio enquanto o comprador paga (até o pedido vencer) */
export function reserveRmt(s: Store, buyer: PlayerState, id: unknown, orderId: string, until: number, now: number) {
  if (!rmtEnabled()) fail('Venda por dinheiro real ainda não está liberada');
  if (!linked(buyer)) fail('Para comprar por dinheiro real, ligue sua conta Google ou Discord (botão Conta)');
  sweepRmt(s, now);
  const l = doc(s).find(x => x.id === id) ?? fail('Anúncio não encontrado');
  if (l.sellerId === buyer.id) fail('Esse anúncio é seu');
  if (l.status === 'reserved' && l.reservedBy !== buyer.id) fail('Outra pessoa está pagando por esse item agora');
  if (l.status !== 'open' && l.status !== 'reserved') fail('Esse item já foi vendido');
  for (const other of doc(s)) {
    if (other.reservedBy === buyer.id && other.id !== l.id && other.status === 'reserved') fail('Termine (ou deixe vencer) o outro pagamento antes');
  }
  Object.assign(l, { status: 'reserved', reservedBy: buyer.id, reservedOrder: orderId, reservedUntil: until });
  s.touch();
  return l;
}

/** Pagamento aprovado: entrega o item e credita o vendedor (retido). false = anúncio não estava mais reservado. */
export function completeRmt(s: Store, listingId: string, orderId: string, buyerId: string, now: number) {
  const l = doc(s).find(x => x.id === listingId);
  if (!l) return false;
  if (l.status === 'sold') return l.reservedOrder === orderId; // webhook repetido
  // pagamento chegou depois da reserva vencer, mas ninguém comprou: ainda vale
  if (!(l.status === 'reserved' && l.reservedOrder === orderId) && l.status !== 'open') return false;
  const buyer = s.getPlayer(buyerId);
  const seller = s.getPlayer(l.sellerId);
  if (!buyer) return false;
  buyer.inventory.rares.push(l.item);
  buyer.rmt.bought += 1;
  inbox(buyer, `Compra aprovada: ${itemName(l.item)} chegou na sua mochila.`, now);
  const net = Math.round(l.price * (1 - RMT.fee) * 100) / 100;
  if (seller) {
    seller.rmt.pending.push({ amount: net, releaseAt: now + RMT.holdDays * 864e5, listingId: l.id });
    seller.rmt.sold += 1;
    inbox(seller, `Vendido! ${itemName(l.item)} por ${formatBRL(l.price)}. Você recebe ${formatBRL(net)} (liberado em ${RMT.holdDays} dias).`, now);
    s.savePlayer(seller);
  }
  Object.assign(l, { status: 'sold', buyerId: buyer.id, soldAt: now, reservedOrder: orderId });
  s.savePlayer(buyer); s.touch();
  return true;
}

export const rmtListing = (s: Store, id: string) => doc(s).find(l => l.id === id);

export function rmtView(s: Store, p: PlayerState, now: number) {
  sweepRmt(s, now);
  settleWallet(p, now);
  const show = (l: RmtListing) => ({
    id: l.id, seller: l.sellerNick, price: l.price, item: l.item, status: l.status, expiresAt: l.expiresAt,
    reservedByMe: l.reservedBy === p.id, mine: l.sellerId === p.id, soldAt: l.soldAt ?? null,
  });
  const all = doc(s);
  return {
    enabled: rmtEnabled(),
    linked: linked(p),
    canSell: rmtEnabled() && linked(p) && p.level >= RMT.sellerMinLevel,
    open: all.filter(l => (l.status === 'open' || (l.status === 'reserved' && l.reservedBy === p.id)) && l.sellerId !== p.id)
      .sort((a, b) => gearScore(b.item) - gearScore(a.item)).slice(0, 60).map(show),
    mine: all.filter(l => l.sellerId === p.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 30).map(show),
    wallet: { pending: p.rmt.pending, available: p.rmt.available, sold: p.rmt.sold, bought: p.rmt.bought, payoutsEnabled: RMT.payoutsEnabled },
    rules: { fee: RMT.fee, holdDays: RMT.holdDays, minPrice: RMT.minPrice, maxPrice: RMT.maxPrice, sellerMinLevel: RMT.sellerMinLevel, listingDays: RMT.listingDays },
  };
}
