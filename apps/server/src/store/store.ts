// Armazenamento. Em desenvolvimento usa memória + arquivo JSON para não exigir banco.
// Em produção, troque por uma implementação com Prisma (schema em prisma/schema.prisma)
// mantendo esta mesma interface.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Currency, PlayerState, RareInstance } from '@gti/shared';

/** Anúncio do mercado. O item fica guardado aqui (custódia) até vender, cancelar ou vencer. */
export interface Listing {
  id: string;
  sellerId: string;
  sellerNick: string;
  sellerVip: boolean;
  kind: 'rare' | 'part' | 'plan';
  itemId: string;
  qty: number;
  /** Preço do lote inteiro, em diamantes */
  price: number;
  createdAt: number;
  expiresAt: number;
  rare?: RareInstance;
}

export interface Sale { itemId: string; kind: Listing['kind']; qty: number; price: number; at: number }

export interface Order {
  id: string;
  playerId: string;
  productId: string;
  amount: number;
  currency: Currency;
  provider: 'mercadopago' | 'stripe';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  providerRef?: string;
  expiresAt?: number;
  /** Presente: quem recebe o produto (id do jogador) */
  giftTo?: string;
}

export interface Store {
  getPlayer(id: string): PlayerState | undefined;
  savePlayer(p: PlayerState): void;
  allPlayers(): PlayerState[];
  createOrder(o: Order): void;
  getOrder(id: string): Order | undefined;
  updateOrder(o: Order): void;
  /** Inscrições de notificação push por jogador (um jogador pode ter vários navegadores) */
  getPushSubs(playerId: string): PushSub[];
  setPushSubs(playerId: string, subs: PushSub[]): void;
  playersWithPush(): string[];
  listings(): Listing[];
  putListing(l: Listing): void;
  removeListing(id: string): Listing | undefined;
  addSale(s: Sale): void;
  sales(): Sale[];
  /** Próximo número de série de um item raro, ou null se a tiragem acabou */
  nextSerial(itemId: string, supply: number): number | null;
  /** Documentos genéricos (bondes, territórios, golpes em equipe, jornal, corridas, leilões) */
  getDoc<T>(key: string, init: () => T): T;
  /** Marca o documento como alterado (salva no próximo flush) */
  touch(): void;
  findPlayerByNick(nick: string): PlayerState | undefined;
}

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string } }

export class FileStore implements Store {
  private players = new Map<string, PlayerState>();
  private orders = new Map<string, Order>();
  private push = new Map<string, PushSub[]>();
  private market = new Map<string, Listing>();
  private saleLog: Sale[] = [];
  private serials: Record<string, number> = {};
  private docs: Record<string, unknown> = {};
  private dirty = false;

  constructor(private path: string) {
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf8'));
      for (const p of data.players ?? []) this.players.set(p.id, p);
      for (const o of data.orders ?? []) this.orders.set(o.id, o);
      for (const [k, v] of Object.entries(data.push ?? {})) this.push.set(k, v as PushSub[]);
      for (const l of data.listings ?? []) this.market.set(l.id, l);
      this.saleLog = data.sales ?? [];
      this.serials = data.serials ?? {};
      this.docs = data.docs ?? {};
    }
    setInterval(() => this.flush(), 5000).unref();
  }

  getPlayer(id: string) { return this.players.get(id); }
  savePlayer(p: PlayerState) { this.players.set(p.id, p); this.dirty = true; }
  allPlayers() { return [...this.players.values()]; }
  createOrder(o: Order) { this.orders.set(o.id, o); this.dirty = true; }
  getOrder(id: string) { return this.orders.get(id); }
  updateOrder(o: Order) { this.orders.set(o.id, o); this.dirty = true; }
  getPushSubs(id: string) { return this.push.get(id) ?? []; }
  setPushSubs(id: string, subs: PushSub[]) {
    if (subs.length) this.push.set(id, subs); else this.push.delete(id);
    this.dirty = true;
  }
  playersWithPush() { return [...this.push.keys()]; }
  listings() { return [...this.market.values()]; }
  putListing(l: Listing) { this.market.set(l.id, l); this.dirty = true; }
  removeListing(id: string) {
    const l = this.market.get(id);
    if (l) { this.market.delete(id); this.dirty = true; }
    return l;
  }
  addSale(s: Sale) { this.saleLog.push(s); if (this.saleLog.length > 2000) this.saleLog.splice(0, this.saleLog.length - 2000); this.dirty = true; }
  sales() { return this.saleLog; }
  nextSerial(itemId: string, supply: number) {
    const n = (this.serials[itemId] ?? 0) + 1;
    if (n > supply) return null;
    this.serials[itemId] = n;
    this.dirty = true;
    return n;
  }

  getDoc<T>(key: string, init: () => T): T {
    if (!(key in this.docs)) { this.docs[key] = init(); this.dirty = true; }
    return this.docs[key] as T;
  }
  touch() { this.dirty = true; }
  findPlayerByNick(nick: string) {
    const n = nick.trim().toLowerCase();
    for (const p of this.players.values()) if (p.nick.toLowerCase() === n) return p;
    return undefined;
  }

  flush() {
    if (!this.dirty) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({
      players: [...this.players.values()],
      orders: [...this.orders.values()],
      push: Object.fromEntries(this.push),
      listings: [...this.market.values()],
      sales: this.saleLog,
      serials: this.serials,
      docs: this.docs,
    }));
    this.dirty = false;
  }
}
