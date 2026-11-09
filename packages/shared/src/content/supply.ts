// Vida, munição e cura: o custo de manter a gangue na rua.
//
//  - Golpe de 2★ ou mais gasta munição e precisa de arma equipada. Sem bala (ou sem arma) a gangue continua
//    tentando, mas só 1% dos golpes dá certo.
//  - Todo golpe machuca. Com a vida baixa a gangue usa um kit médico sozinha. Se os kits acabarem com a vida
//    baixa, ou se a vida zerar, ela volta para o esconderijo e PARA de farmar até o jogador mandar de volta.
//  - Munição e kits só se compram com grana do jogo (no Mercador). Nunca com dinheiro real ou diamantes:
//    pagar para tentar um drop que vale dinheiro real seria caixa de recompensa paga (ECA Digital).
//
// Também: categorias e classes de carros e motos, e quanto o Mercador paga por cada item.
import type { PlayerState, RareInstance, Rarity, VehicleType } from '../types';
import { ROBBERIES } from './world';

/** Renda por hora do melhor assalto liberado no nível (régua de preços que acompanha a progressão) */
export function incomePerHour(level: number) {
  let best = 0;
  for (const j of ROBBERIES) {
    if (j.minLevel > level) continue;
    best = Math.max(best, ((j.cash[0] + j.cash[1]) / 2) * 3600 / j.durationSec);
  }
  return best;
}

export const SUPPLY = {
  maxHp: 100,
  /** Munição gasta por hora de assalto, por estrela (índice = estrelas) */
  ammoPerHour: [0, 0, 30, 40, 50, 60, 80],
  /** Vida perdida por hora de assalto, por estrela */
  damagePerHour: [0, 3, 8, 14, 22, 32, 45],
  /** Chance de dar certo sem bala ou sem arma */
  unarmedSuccess: 0.01,
  /** Kit médico: quanto cura e quando a gangue usa sozinha */
  kitHeal: 50,
  autoHealBelow: 40,
  /** Sem kit e com a vida abaixo disso, a gangue recua para o esconderijo */
  retreatBelow: 25,
  /** No esconderijo a vida volta sozinha (de 0 a 100 em 60 min) */
  regenPerSec: 100 / 3600,
  /** Vida mínima para voltar para a rua */
  returnHp: 50,
  /** Fração da renda/hora gasta em munição e em kits (balanceamento dos preços) */
  ammoCostShare: 0.06,
  kitCostShare: 0.04,
  maxAmmo: 3000,
  maxKits: 60,
  /** Pacotes do Mercador */
  ammoPacks: [50, 250, 1000],
  kitPacks: [1, 5, 20],
};

/** Preço de 1 bala no nível do jogador (grana do jogo) */
export const bulletPrice = (level: number) => Math.max(1, Math.round(incomePerHour(level) * SUPPLY.ammoCostShare / 60));
/** Preço de 1 kit médico no nível do jogador */
export const kitPrice = (level: number) => Math.max(10, Math.round(incomePerHour(level) * SUPPLY.kitCostShare));

/** Arma branca (taco, faca): não gasta bala, rende 20% menos e não serve para golpe de 4★ ou mais */
export const MELEE = { maxStars: 3, cashMult: 0.8 };
export const isMelee = (kind?: string) => kind === 'taco' || kind === 'faca';

/** Munição e dano de um golpe, já com Pontaria e Colete */
export function jobNeeds(job: { durationSec: number; maxStars: number }, aimPct = 0, vestPct = 0) {
  const h = job.durationSec / 3600;
  const s = Math.max(0, Math.min(6, job.maxStars));
  return {
    ammo: SUPPLY.ammoPerHour[s] * h * (1 - aimPct / 100),
    damage: SUPPLY.damagePerHour[s] * h * (1 - vestPct / 100),
    needsGun: SUPPLY.ammoPerHour[s] > 0,
  };
}

/** Clube Rockeiro: reanimação automática (continua farmando AFK), desconto no Mercador e mochila maior */
export const VIP_SUPPLY = { revivesPerDay: 4, reviveHp: 100, merchantDiscount: 0.1, extraBag: 30 };

export type DownReason = 'morto' | 'sem_cura';
export const isDown = (p: PlayerState) => !!p.vitals?.down;

// ---------------- carros e motos ----------------
export interface VehicleCategory { id: VehicleType; name: string; speed: number; cash: number; note: string }
export const VEHICLE_CATEGORIES: VehicleCategory[] = [
  { id: 'moto', name: 'Moto', speed: 10, cash: -5, note: 'Mais rápida, carrega menos' },
  { id: 'hatch', name: 'Popular', speed: 0, cash: 0, note: 'Equilibrado' },
  { id: 'sedan', name: 'Sedã', speed: 0, cash: 3, note: 'Porta-malas maior' },
  { id: 'sport', name: 'Esportivo', speed: 8, cash: 5, note: 'Rápido e chamativo' },
  { id: 'picape', name: 'Picape', speed: -5, cash: 8, note: 'Leva muita carga' },
  { id: 'van', name: 'Utilitário', speed: -8, cash: 10, note: 'Lento, carrega tudo' },
];
/** Classe de qualidade pela raridade do drop: quanto melhor, mais veloz e mais grana */
export const VEHICLE_CLASSES: Record<Rarity, { name: string; speed: number; cash: number }> = {
  comum: { name: 'C', speed: 0, cash: 0 },
  raro: { name: 'B', speed: 6, cash: 6 },
  epico: { name: 'A', speed: 12, cash: 12 },
  lendario: { name: 'S', speed: 20, cash: 20 },
};
export const vehicleCategory = (t?: VehicleType) => VEHICLE_CATEGORIES.find(c => c.id === (t ?? 'sedan')) ?? VEHICLE_CATEGORIES[2];

// ---------------- Mercador ----------------
const MERCHANT_HOURS: Record<Rarity, number> = { comum: 0.15, raro: 0.6, epico: 2, lendario: 8 };
/** Quanto o Mercador paga na hora (grana limpa): escala com o nível, a raridade e o desgaste */
export function merchantValue(g: Pick<RareInstance, 'rarity' | 'serial' | 'wear'>, level: number) {
  const base = incomePerHour(level) * MERCHANT_HOURS[g.rarity ?? 'comum'];
  return Math.max(10, Math.round(base * (g.serial > 0 ? 2 : 1) * (1 - Math.min(100, g.wear ?? 0) / 200)));
}

// ---------------- RMT (venda por dinheiro real entre jogadores) ----------------
export const RMT = {
  /** Preço em reais */
  minPrice: 2, maxPrice: 2000,
  /** Taxa da plataforma sobre a venda */
  fee: 0.1,
  /** Dias que o valor fica retido antes de liberar (estorno e fraude) */
  holdDays: 7,
  /** Nível mínimo para vender por dinheiro real */
  sellerMinLevel: 10,
  /** Anúncio vence depois de N dias */
  listingDays: 7,
  maxListings: 10,
  /** Saque para conta bancária: desligado até ter intermediário de pagamento e revisão jurídica */
  payoutsEnabled: false,
};
export const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
