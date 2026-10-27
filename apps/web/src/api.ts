import type { Action, Currency, GameEvent, PlayerState, RareInstance, RealMoneyProduct } from '@gti/shared';

const TOKEN_KEY = 'nh_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setToken = (t: string) => {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* modo privado: segue sem salvar */ }
};
export const clearToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignora */ }
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // o servidor só manda push quando a aba não está visível
      'X-Tab-Visible': document.visibilityState === 'visible' ? '1' : '0',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Erro', res.status);
  return data as T;
}

export interface PixCharge {
  orderId: string; mode: 'dev' | 'live'; productName: string; amount: number;
  qrCode: string; qrCodeBase64: string; ticketUrl?: string; expiresAt: number;
}

export type OrderState = 'pending' | 'approved' | 'rejected' | 'expired';
export interface OrderStatus { status: OrderState; productName: string; amount: number; currency: Currency }

export interface StateResponse { player: PlayerState; events: GameEvent[]; serverTime: number }

export interface MarketListing {
  id: string; sellerNick: string; sellerVip: boolean; kind: 'rare' | 'part' | 'plan'; itemId: string; name: string;
  qty: number; price: number; createdAt: number; expiresAt: number; rare?: RareInstance;
}
export interface MarketView {
  listings: MarketListing[];
  mine: MarketListing[];
  stats: Record<string, { last: number; avg: number; count: number }>;
  me: { vip: boolean; fee: number; slots: number; used: number; balance: number; paid: number; earned: number; adSlotUntil: number | null };
  withdraw: { enabled: boolean; min: number; usdPer1000: number; holdDays: number };
}
export type MarketResponse = StateResponse & { market: MarketView };
export type ListRequest =
  | { kind: 'rare'; uid: string; price: number }
  | { kind: 'part' | 'plan'; itemId: string; qty: number; price: number };

// ---------- cidade viva ----------
export interface CrewMember { nick: string; level: number; code: string; vip: boolean; owner: boolean }
export interface CrewInfo { id: string; name: string; tag: string; code: string; owner: boolean; members: CrewMember[]; weekPoints: number }
export interface DistrictStanding { district: string; name: string; owner: { tag: string; mine: boolean } | null; top: { tag: string; points: number; mine: boolean }[] }
export interface TeamInfo {
  id: string; code: string; heistId: string; leader: string; mine: boolean;
  slots: Record<string, { nick: string; me: boolean } | null>;
  createdAt: number; startedAt: number | null; endsAt: number | null; expiresAt: number;
}
export interface CrewView {
  crew: CrewInfo | null; standings: DistrictStanding[];
  ranking: { name: string; tag: string; members: number; points: number; mine: boolean }[];
  week: string; cost: number; maxMembers: number; bonus: number;
  team: { mine: TeamInfo | null; open: TeamInfo[] };
}
export interface NewsItem { id: string; at: number; kind: string; text: string; nick?: string }
export interface RaceBoard { top: { nick: string; best: number; me: boolean }[]; myRank: number | null; runsLeft: number; best: number }
export interface RaceResult { distance: number; cash: number; rewarded: boolean; runsLeft: number; best: number; newBest: boolean; board: RaceBoard }
export interface Profile {
  nick: string; code: string; level: number; vip: boolean; founder: boolean; crew: { name: string; tag: string } | null;
  district: string; since: number; equipped: PlayerState['equipped']; tuning: Record<string, string>;
  trophies: string[]; rares: { itemId: string; serial: number; name: string }[];
  stats: { cashEarned: number; robberies: number; jailed: number; biggestHeist: number; laundered: number; teamHeists: number; raceBest: number; territories: number; playDays: number };
}
export interface AuctionInfo {
  id: string; seller: string; mineSeller: boolean; itemId: string; serial: number; name: string;
  start: number; bid: number; bidder: string | null; mineBid: boolean; bids: number; minBid: number; endsAt: number; highlight: boolean;
}
export interface AuctionView { open: AuctionInfo[]; recent: AuctionInfo[]; window: boolean; nextEnd: number }
export type With<T> = StateResponse & { data: T };

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? 'Erro', res.status);
  return data as T;
}

export const api = {
  async guest(nick: string, ref?: string | null) {
    const r = await call<{ token: string; player: PlayerState }>('/api/guest', { nick, ...(ref ? { ref } : {}) });
    setToken(r.token);
    return r.player;
  },
  state: () => call<StateResponse>('/api/state'),
  act: (action: Action) => call<StateResponse>('/api/action', { action }),
  shop: () => call<{ pixLive: boolean; cardLive: boolean; products: RealMoneyProduct[] }>('/api/shop'),
  pix: (productId: string, email: string, giftTo?: string) => call<PixCharge>('/api/shop/pix', { productId, email, ...(giftTo ? { giftTo } : {}) }),
  card: (productId: string, currency: Currency, email?: string, giftTo?: string) =>
    call<{ orderId: string; mode: 'dev' | 'live'; checkoutUrl: string | null; amount: number; currency: Currency }>('/api/shop/card', { productId, currency, email, ...(giftTo ? { giftTo } : {}) }),
  order: (orderId: string) => call<OrderStatus>(`/api/shop/order/${orderId}`),
  devApprove: (orderId: string) => call<{ ok: true }>(`/api/dev/approve/${orderId}`, {}),
  devAlert: () => call<StateResponse>('/api/dev/alert', {}),
  devHeat: () => call<StateResponse>('/api/dev/heat', {}),
  devBurn: () => call<StateResponse>('/api/dev/burn', {}),
  devLevel: () => call<StateResponse>('/api/dev/level', {}),
  devLoot: () => call<StateResponse>('/api/dev/loot', {}),
  devCash: () => call<StateResponse>('/api/dev/cash', {}),
  devDirty: () => call<StateResponse>('/api/dev/dirty', {}),
  devWanted: (stars: number) => call<StateResponse>('/api/dev/wanted', { stars }),
  devHideoutSkip: () => call<StateResponse>('/api/dev/hideout-skip', {}),
  adStart: (purpose: 'alert' | 'market_slot' = 'alert') => call<{ token: string; minSec: number }>('/api/ads/start', { purpose }),
  market: () => call<MarketResponse>('/api/market'),
  marketList: (req: ListRequest) => call<MarketResponse>('/api/market/list', req),
  marketCancel: (id: string) => call<MarketResponse>('/api/market/cancel', { id }),
  marketBuy: (id: string) => call<MarketResponse>('/api/market/buy', { id }),
  adComplete: (token: string) => call<StateResponse>('/api/ads/complete', { token }),
  crew: () => call<With<CrewView>>('/api/crew'),
  crewCreate: (name: string, tag: string) => call<With<unknown>>('/api/crew/create', { name, tag }),
  crewJoin: (code: string) => call<With<unknown>>('/api/crew/join', { code }),
  crewLeave: () => call<With<unknown>>('/api/crew/leave', {}),
  teamCreate: (heistId: string, role: string) => call<With<unknown>>('/api/team/create', { heistId, role }),
  teamJoin: (code: string, role: string) => call<With<unknown>>('/api/team/join', { code, role }),
  teamLeave: () => call<With<unknown>>('/api/team/leave', {}),
  news: () => call<{ news: NewsItem[] }>('/api/news'),
  race: () => call<With<RaceBoard>>('/api/race'),
  raceStart: () => call<With<{ raceId: string; seed: number; seconds: number }>>('/api/race/start', {}),
  raceFinish: (raceId: string, distance: number) => call<With<RaceResult>>('/api/race/finish', { raceId, distance }),
  gift: (to: string, itemId: string) => call<With<{ to: string; item: string }>>('/api/gift', { to, itemId }),
  profile: (code: string) => publicGet<Profile>(`/api/profile/${encodeURIComponent(code)}`),
  inboxRead: () => call<With<null>>('/api/inbox/read', {}),
  auction: () => call<With<AuctionView>>('/api/auction'),
  auctionCreate: (uid: string, start: number) => call<With<AuctionView>>('/api/auction/create', { uid, start }),
  auctionBid: (id: string, amount: number) => call<With<AuctionView>>('/api/auction/bid', { id, amount }),
  ranking: () => call<{ nick: string; level: number; founder: boolean; vip: boolean }[]>('/api/ranking'),
};

const CURRENCY_KEY = 'gti_currency';
/** Moeda inicial: real para quem está com o navegador em português, dólar para o resto. */
export function initialCurrency(): Currency {
  try {
    const saved = localStorage.getItem(CURRENCY_KEY);
    if (saved === 'BRL' || saved === 'USD') return saved;
  } catch { /* sem storage */ }
  return navigator.language?.toLowerCase().startsWith('pt') ? 'BRL' : 'USD';
}
export function saveCurrency(c: Currency) {
  try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* sem storage */ }
}
