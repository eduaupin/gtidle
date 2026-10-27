import { RULES } from './content/world';
import type { PlayerState } from './types';

/** XP total para sair do nível n para n+1 */
export const xpToNext = (level: number) => Math.floor(20 * Math.pow(level, 1.8));

/** Custo exponencial padrão de upgrade */
export const costAt = (base: number, level: number) => Math.floor(base * Math.pow(1.15, level));

export const isVip = (p: PlayerState, now: number) => p.vipUntil !== null && p.vipUntil > now;
export const isJailed = (p: PlayerState, now: number) => p.jailedUntil !== null && p.jailedUntil > now;
export const isTurbo = (p: PlayerState, now: number) => p.turboUntil !== null && p.turboUntil > now;

export const robberySlots = (p: PlayerState, now: number) =>
  isVip(p, now) ? RULES.robberySlotsVip : RULES.robberySlotsFree;

export const labLines = (p: PlayerState, now: number) =>
  RULES.labLinesBase + Math.floor(p.lab.level / 4) + (isVip(p, now) ? RULES.labLinesVipBonus : 0);

export const offlineCapMs = (p: PlayerState, now: number) =>
  (isVip(p, now) ? RULES.offlineCapHoursVip : RULES.offlineCapHoursFree) * 3600_000;

export const cashMult = (p: PlayerState, now: number) => isVip(p, now) ? RULES.vipCashMult : 1;
export const xpMult = (p: PlayerState, now: number) => isVip(p, now) ? RULES.vipXpMult : 1;

export const lawyerCost = (p: PlayerState) => costAt(RULES.lawyerBaseCost, Math.floor(p.level / 3));
export const labUpgradeCost = (p: PlayerState) => costAt(RULES.labUpgradeBaseCost, p.lab.level);
export const dealingPointCost = (p: PlayerState) => costAt(RULES.dealingPointBaseCost, p.dealing.points);
export const totalDiamonds = (p: PlayerState) => p.diamondsPaid + p.diamondsEarned;

/** RNG determinístico (mulberry32) — o servidor guarda a semente, então o resultado é reproduzível. */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}

export const formatCash = (n: number) =>
  '$' + Math.floor(n).toLocaleString('pt-BR');

export const formatDuration = (sec: number) => {
  sec = Math.max(0, Math.ceil(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
};

/** Multiplicador de recompensa do assalto conforme o alerta de polícia. */
export function robberyModeMult(slot: { mode?: string; boostUntil?: number }, now: number) {
  if (slot.mode === 'weak') return RULES.weakMult;
  if (slot.mode === 'boosted' && (slot.boostUntil ?? 0) > now) return RULES.boostMult;
  return 1;
}

/** Roupa ou carro em uso estão queimados pela polícia? (assaltos ficam parados até trocar) */
export const burnedUntil = (p: PlayerState, itemId: string) => p.burned?.[itemId] ?? 0;
export function isLookBurned(p: PlayerState, now: number) {
  return burnedUntil(p, p.equipped.character) > now || burnedUntil(p, p.equipped.vehicle) > now;
}
