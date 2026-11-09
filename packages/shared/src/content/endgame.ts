// Fim de jogo e sistemas de disputa: zona Fora da Lei (níveis 90 a 150), chefões com fichas,
// eventos globais da semana, Pontos (dominados como ginásios), PvP ranqueado e guerra de bondes diária.
import type { HeistPlan, RobberyJob } from '../types';
import { recruitScore, recruitStats, type Spec } from './recruits';
import { brDay, brHour } from './city';

// ---------------- chefões (com ficha) ----------------
export interface BossInfo { power: number; spec: Spec; title: string }
export type BossPlan = HeistPlan & { boss: BossInfo };
/** Força do chefão: um time de 5 bons capangas 5 níveis acima do mínimo (com folga de 10%) */
const bossPower = (minLevel: number) => {
  const lvl = Math.min(100, minLevel + 5);
  const sp = lvl >= 40 ? 'matador' : lvl >= 18 ? 'atirador' : 'trombadinha';
  return Math.round(5 * recruitScore(recruitStats({ speciesId: sp, level: lvl, ivs: { hp: 18, atk: 18, def: 18, spd: 18 } })) * 0.9 * (1 + Math.max(0, minLevel - 100) / 100));
};
const boss = (id: string, planName: string, name: string, district: RobberyJob['district'], minLevel: number, durationSec: number,
  cash: [number, number], xp: number, spec: Spec, _power: number, description: string): BossPlan =>
  ({ id, planName, name, district, minLevel, durationSec, cash, xp, heat: 40, maxStars: 6, building: 'banco', rareChance: 0.3,
    description, boss: { power: bossPower(minLevel), spec, title: name } });

/**
 * Chefões: cada ficha é uma tentativa. O time precisa ter força para vencer; ganhando, cai equipamento
 * épico ou melhor e pode cair um disco de treino. As fichas caem nos golpes de 6★ e se vendem no Mercado.
 */
export const BOSSES: BossPlan[] = [
  boss('chefe_porto', 'Ficha: Dono do Cais', 'Dono do Cais', 'porto', 20, 1200, [30000, 45000], 1500, 'brutamonte', 900, 'Manda em cada contêiner que entra.'),
  boss('chefe_aeroporto', 'Ficha: Rei da Pista de Pouso', 'Rei da Pista de Pouso', 'aeroporto', 30, 1500, [70000, 90000], 2600, 'motorista', 1500, 'Ninguém pousa sem pagar a ele.'),
  boss('chefe_centro', 'Ficha: O Banqueiro', 'O Banqueiro', 'centro', 40, 1800, [150000, 200000], 4200, 'hacker', 2300, 'Lava dinheiro de meio estado.'),
  boss('chefe_orla', 'Ficha: A Rainha da Orla', 'A Rainha da Orla', 'orla', 50, 1800, [300000, 380000], 6000, 'golpista', 3100, 'As boates são todas dela.'),
  boss('chefe_marina', 'Ficha: O Almirante', 'O Almirante', 'marina', 60, 2400, [600000, 750000], 9000, 'brutamonte', 4000, 'Contrabando com escolta armada.'),
  boss('chefe_mata', 'Ficha: O Fazendeiro', 'O Fazendeiro', 'mata', 70, 2400, [1100000, 1300000], 13000, 'pistoleiro', 5000, 'Pista de pouso e jagunços.'),
  boss('chefe_mansoes', 'Ficha: O Chefão', 'O Chefão', 'mansoes', 85, 3600, [3000000, 3600000], 24000, 'arrombador', 6400, 'O dono da Costa Dourada.'),
  boss('chefe_sombra', 'Ficha: A Sombra', 'A Sombra', 'vila_norte', 100, 3600, [7000000, 8500000], 40000, 'hacker', 8000, 'Ninguém viu o rosto.'),
  boss('chefe_coronel', 'Ficha: O Coronel', 'O Coronel', 'farol', 120, 5400, [18000000, 22000000], 70000, 'pistoleiro', 10000, 'O homem por trás da polícia.'),
  boss('chefe_lenda', 'Ficha: A Lenda', 'A Lenda da Costa', 'ilha_sol', 140, 7200, [45000000, 55000000], 120000, 'golpista', 12500, 'Só se fala dela em sussurro.'),
];
export const isBoss = (j: { id: string }): j is BossPlan => BOSSES.some(b => b.id === j.id);

// ---------------- eventos globais da semana ----------------
export interface GlobalEvent { id: string; name: string; text: string; xp: number; drop: number; cash: number }
export const EVENTS: { ev: GlobalEvent; active: (ms: number) => boolean }[] = [
  {
    ev: { id: 'noite_crime', name: 'Noite do Crime', text: '+50% de XP para todo mundo online', xp: 0.5, drop: 0, cash: 0 },
    active: ms => { const d = new Date(ms - 3 * 3600_000).getUTCDay(); const h = brHour(ms); return d === 3 && h >= 19 && h < 23; },
  },
  {
    ev: { id: 'fds_drop', name: 'Fim de semana do drop', text: '+50% de chance em todos os drops e encontros', xp: 0, drop: 0.5, cash: 0 },
    active: ms => { const d = new Date(ms - 3 * 3600_000).getUTCDay(); return d === 6 || d === 0; },
  },
  {
    ev: { id: 'sexta_grana', name: 'Sexta da grana', text: '+25% de grana nos assaltos', xp: 0, drop: 0, cash: 0.25 },
    active: ms => new Date(ms - 3 * 3600_000).getUTCDay() === 5 && brHour(ms) >= 18,
  },
];
export const activeEvents = (ms: number) => EVENTS.filter(e => e.active(ms)).map(e => e.ev);
export const eventBonus = (ms: number) => activeEvents(ms).reduce((a, e) => ({ xp: a.xp + e.xp, drop: a.drop + e.drop, cash: a.cash + e.cash }), { xp: 0, drop: 0, cash: 0 });
export const eventDay = brDay;

// ---------------- Pontos (dominados como ginásios) ----------------
export const POINTS = {
  minLevel: 60,
  /** Um desafio a cada N minutos por jogador, por Ponto */
  cooldownMin: 10,
  names: {
    pistoleiro: 'Ponto do Morro', motorista: 'Ponto do Autódromo', hacker: 'Ponto da Lan House',
    arrombador: 'Ponto do Cofre', brutamonte: 'Ponto do Cais', golpista: 'Ponto da Boate',
  } as Record<Spec, string>,
};

// ---------------- PvP ranqueado ----------------
export const PVP = {
  minLevel: 40,
  start: 1000,
  k: 32,
  /** Intervalo entre lutas (sem barra de energia: só um respiro anti-robô) */
  cooldownSec: 20,
  ranks: [
    { id: 'bronze', name: 'Bronze', min: 0 },
    { id: 'prata', name: 'Prata', min: 1100 },
    { id: 'ouro', name: 'Ouro', min: 1250 },
    { id: 'platina', name: 'Platina', min: 1400 },
    { id: 'diamante', name: 'Diamante', min: 1550 },
    { id: 'mestre', name: 'Mestre', min: 1700, top: 500 },
    { id: 'grao_mestre', name: 'Grão-Mestre', min: 1850, top: 100 },
    { id: 'desafiante', name: 'Desafiante', min: 2000, top: 10 },
  ],
  /** Prêmio de fim de temporada (diamantes ganhos, presos à conta) por rank */
  seasonRewards: { bronze: 10, prata: 25, ouro: 50, platina: 80, diamante: 120, mestre: 200, grao_mestre: 300, desafiante: 500 } as Record<string, number>,
};
export const pvpSeason = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 7);
/** Rank pela nota e pela posição (os três de cima só para o topo da tabela) */
export function pvpRank(rating: number, position?: number) {
  let best = PVP.ranks[0];
  for (const r of PVP.ranks) {
    if (rating < r.min) continue;
    if (r.top && (position === undefined || position > r.top)) continue;
    best = r;
  }
  return best;
}
export const elo = (ra: number, rb: number, won: boolean) => Math.round(PVP.k * ((won ? 1 : 0) - 1 / (1 + 10 ** ((rb - ra) / 400))));

// ---------------- guerra de bondes ----------------
/** Todo dia às 22 h UTC o servidor simula as guerras; não precisa estar online. */
export const WAR = { hourUtc: 22, membersPerSide: 6, winDiamonds: 20, winPoints: 500 };
