// Regras da cidade viva: lavagem, noite, seguro, tuning, bondes, territórios, golpe em equipe,
// corrida de rua, leilão, jornal, troféus e convites. Tudo é balanceamento: ajuste aqui.
import type { PlayerState } from '../types';

/** Hora em Brasília (o jogo inteiro usa o mesmo relógio, para todo mundo viver a mesma noite) */
export const brHour = (ms: number) => new Date(ms - 3 * 3600_000).getUTCHours();
export const brDay = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);
/** Semana (segunda a domingo) em Brasília: '2026-W43' */
export function brWeek(ms: number) {
  const d = new Date(ms - 3 * 3600_000);
  const day = (d.getUTCDay() + 6) % 7; // segunda = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 864e5 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export const previousWeek = (ms: number) => brWeek(ms - 7 * 864e5);

// ---------------- dia e noite ----------------
export const NIGHT = { from: 19, to: 6, cashMult: 1.2, heatMult: 1.2 };
export const isNight = (ms: number) => { const h = brHour(ms); return h >= NIGHT.from || h < NIGHT.to; };

// ---------------- lavagem de dinheiro ----------------
export const LAUNDER = {
  /** Golpes com este teto de estrelas ou mais rendem grana suja */
  dirtyFromStars: 4,
  /** Cada $1/s de renda dos negócios lava $12/s de grana suja */
  perIncome: 12,
  /** Taxa da lavagem pelos negócios (o resto vira grana limpa) */
  fee: 0.1,
  feeVip: 0.05,
  /** Lavar na hora, sem esperar os negócios */
  instantFee: 0.25,
  /** Na prisão a polícia apreende parte da grana suja */
  confiscate: 0.5,
};

// ---------------- seguro contra prisão ----------------
export const INSURANCE = {
  hours: 24,
  /** Preço em grana limpa: por nível */
  costPerLevel: 400,
  /** Com seguro: apreensão menor e metade do tempo preso */
  confiscate: 0.25,
  jailMult: 0.5,
};
export const insuranceCost = (p: PlayerState) => INSURANCE.costPerLevel * p.level;

// ---------------- oficina de tuning ----------------
export type TuningSlot = 'paint' | 'neon' | 'wheels';
export interface TuningOption { id: string; slot: TuningSlot; name: string; color: string; priceCash?: number; priceDiamonds?: number }
export const TUNING_SLOTS: { id: TuningSlot; name: string }[] = [
  { id: 'paint', name: 'Pintura' }, { id: 'neon', name: 'Neon embaixo' }, { id: 'wheels', name: 'Rodas' },
];
export const TUNING: TuningOption[] = [
  { id: 'pint_vermelha', slot: 'paint', name: 'Vermelho Pista', color: '#d62828', priceCash: 4000 },
  { id: 'pint_azul', slot: 'paint', name: 'Azul Elétrico', color: '#2563eb', priceCash: 4000 },
  { id: 'pint_verde', slot: 'paint', name: 'Verde Limão', color: '#84cc16', priceCash: 4000 },
  { id: 'pint_roxa', slot: 'paint', name: 'Roxo Metálico', color: '#7c3aed', priceCash: 6000 },
  { id: 'pint_rosa', slot: 'paint', name: 'Rosa Orla', color: '#ff4fb0', priceCash: 6000 },
  { id: 'pint_ouro', slot: 'paint', name: 'Dourado', color: '#f2c14e', priceDiamonds: 120 },
  { id: 'pint_cromo', slot: 'paint', name: 'Cromado', color: '#e5edf5', priceDiamonds: 180 },
  { id: 'neon_azul', slot: 'neon', name: 'Neon Azul', color: '#3fe0ff', priceCash: 3000 },
  { id: 'neon_rosa', slot: 'neon', name: 'Neon Rosa', color: '#ff4fb0', priceCash: 3000 },
  { id: 'neon_verde', slot: 'neon', name: 'Neon Verde', color: '#39ff7a', priceCash: 3000 },
  { id: 'neon_roxo', slot: 'neon', name: 'Neon Roxo', color: '#b04fff', priceDiamonds: 60 },
  { id: 'neon_ouro', slot: 'neon', name: 'Neon Dourado', color: '#ffd23f', priceDiamonds: 90 },
  { id: 'roda_preta', slot: 'wheels', name: 'Rodas Pretas Foscas', color: '#16181d', priceCash: 1500 },
  { id: 'roda_cromo', slot: 'wheels', name: 'Rodas Cromadas', color: '#d8e4ee', priceCash: 5000 },
  { id: 'roda_ouro', slot: 'wheels', name: 'Rodas Douradas', color: '#f2c14e', priceDiamonds: 80 },
];

// ---------------- bondes e territórios ----------------
export const CREW = { cost: 5000, maxMembers: 6, nameMax: 20, tagMin: 2, tagMax: 4 };
export const TERRITORY = {
  /** Pontos = grana do assalto / 100 */
  pointsPerCash: 0.01,
  /** Quem domina a região na semana: bônus de grana para os membros nos assaltos de lá */
  cashBonus: 0.15,
};

// ---------------- golpe em equipe ----------------
export const TEAM_ROLES = [
  { id: 'motorista', name: 'Motorista' },
  { id: 'hacker', name: 'Hacker' },
  { id: 'arrombador', name: 'Arrombador' },
  { id: 'vigia', name: 'Vigia' },
] as const;
export type TeamRole = typeof TEAM_ROLES[number]['id'];
export interface TeamHeistDef { id: string; name: string; minLevel: number; minutes: number; cash: [number, number]; xp: number; rareChance: number; parts: number; description: string }
export const TEAM_HEISTS: TeamHeistDef[] = [
  { id: 'carro_forte', name: 'Carro-forte blindado', minLevel: 10, minutes: 60, cash: [25000, 40000], xp: 900, rareChance: 0.15, parts: 4,
    description: 'Fechar a avenida, abrir a porta traseira e sumir antes da viatura.' },
  { id: 'cofre_central', name: 'Cofre do Banco Central', minLevel: 30, minutes: 120, cash: [150000, 220000], xp: 4000, rareChance: 0.25, parts: 8,
    description: 'Túnel, alarme desligado e quatro minutos de cofre aberto.' },
  { id: 'navio_ouro', name: 'Navio do ouro', minLevel: 55, minutes: 240, cash: [700000, 900000], xp: 12000, rareChance: 0.4, parts: 14,
    description: 'Abordagem em alto-mar com lancha e helicóptero.' },
];
/** Equipe montada que não sai em 2 h é desfeita */
export const TEAM_LOBBY_HOURS = 2;

// ---------------- corrida de rua ----------------
export const RACE = {
  seconds: 30,
  lanes: 3,
  /** Velocidade em m/s: começa em base e sobe até max */
  baseSpeed: 30,
  maxSpeed: 70,
  accel: 2.2,
  /** Batida: a velocidade cai para esta fração */
  crashKeep: 0.45,
  rewardedRunsPerDay: 5,
  /** Recompensa em grana: por metro, escala com o nível */
  cashPerMeter: 0.4,
};
/** Maior distância possível em `sec` segundos sem bater (o servidor recusa acima disso) */
export function raceMaxDistance(sec: number) {
  let v = RACE.baseSpeed, d = 0;
  for (let t = 0; t < sec; t += 0.05) { v = Math.min(RACE.maxSpeed, v + RACE.accel * 0.05); d += v * 0.05; }
  return Math.ceil(d);
}
export const raceReward = (distance: number, level: number) => Math.round(distance * RACE.cashPerMeter * (1 + level / 10));

// ---------------- leilão de raros ----------------
export const AUCTION = {
  /** Termina domingo às 22 h (Brasília) */
  endDay: 0, endHour: 22,
  minIncrement: 0.05,
  /** Lance nos últimos minutos estende o fim */
  extendMinutes: 5,
  minStart: 50,
};
/** Sábado e domingo em Brasília (no desenvolvimento qualquer dia vale) */
export const isAuctionWindow = (ms: number) => { const d = new Date(ms - 3 * 3600_000).getUTCDay(); return d === 6 || d === 0; };
/** Próximo domingo 22 h em Brasília, em ms UTC */
export function auctionEnd(ms: number) {
  const br = new Date(ms - 3 * 3600_000);
  const add = (7 - br.getUTCDay()) % 7;
  const end = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() + add, AUCTION.endHour) + 3 * 3600_000;
  return end > ms ? end : end + 7 * 864e5;
}

// ---------------- convites ----------------
export const REFERRAL = {
  /** Quem chega pelo convite ganha na hora */
  newcomerCash: 2000, newcomerDiamonds: 30,
  /** Quem convidou ganha quando o amigo chega a este nível (evita conta falsa) */
  rewardLevel: 10, inviterDiamonds: 100,
};

// ---------------- troféus (ficha criminal) ----------------
export interface Trophy { id: string; name: string; description: string; check: (p: PlayerState) => boolean }
export const TROPHIES: Trophy[] = [
  { id: 'primeiro_corre', name: 'Primeiro corre', description: 'Fez o primeiro assalto', check: p => p.stats.robberiesDone >= 1 },
  { id: 'ficha_suja', name: 'Ficha suja', description: 'Foi preso pela primeira vez', check: p => p.stats.timesJailed >= 1 },
  { id: 'mil_assaltos', name: 'Mil assaltos', description: '1.000 assaltos concluídos', check: p => p.stats.robberiesDone >= 1000 },
  { id: 'milionario', name: 'Milionário', description: '$1 milhão ganho no total', check: p => p.stats.cashEarned >= 1e6 },
  { id: 'magnata', name: 'Magnata', description: '$100 milhões ganhos no total', check: p => p.stats.cashEarned >= 1e8 },
  { id: 'lavanderia', name: 'Lavanderia', description: '$1 milhão lavado', check: p => (p.stats.laundered ?? 0) >= 1e6 },
  { id: 'primeiro_raro', name: 'Sorte grande', description: 'Achou o primeiro item raro', check: p => (p.stats.raresFound ?? 0) >= 1 },
  { id: 'colecionador', name: 'Colecionador', description: '5 raros diferentes na mochila', check: p => new Set(p.inventory.rares.map(r => r.itemId)).size >= 5 },
  { id: 'trabalho_em_equipe', name: 'Trabalho em equipe', description: 'Concluiu um golpe em equipe', check: p => (p.stats.teamHeists ?? 0) >= 1 },
  { id: 'piloto', name: 'Piloto de fuga', description: '1.500 m numa corrida de rua', check: p => (p.stats.raceBest ?? 0) >= 1500 },
  { id: 'dono_do_pedaco', name: 'Dono do pedaço', description: 'O bonde dominou uma região', check: p => (p.stats.territoriesWon ?? 0) >= 1 },
  { id: 'generoso', name: 'Generoso', description: 'Deu um presente', check: p => (p.stats.giftsSent ?? 0) >= 1 },
  { id: 'padrinho', name: 'Padrinho', description: '3 amigos chegaram ao nível 10 pelo seu convite', check: p => (p.referral?.rewarded ?? 0) >= 3 },
  { id: 'costa_inteira', name: 'Costa inteira', description: 'Chegou ao nível 85', check: p => p.level >= 85 },
];
export const trophiesOf = (p: PlayerState) => TROPHIES.filter(t => t.check(p)).map(t => t.id);
