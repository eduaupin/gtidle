// Capangas: o coração da coleção (a mecânica de "capturar e treinar" com a temática do crime).
//
//  - Depois de um assalto às vezes aparece alguém querendo entrar para a gangue. A janela dura 30 s
//    (ou o recrutamento automático usa um convite sozinho, para quem está AFK).
//  - Convites (simples, bom, ótimo) se compram no Mercador, só com grana do jogo.
//  - Cada capanga tem especialidade, nível (1 a 100), atributos individuais (0 a 31), classe de potência
//    P1 a P5 e, muito raramente (1 em 24.000), sai "Lenda da Rua", anunciado para o servidor todo.
//  - Time de até 5 em campo, depósito sem limite, álbum com tudo que já viu e recrutou.
//  - O time pesa nos assaltos (velocidade, grana e dano), sobe de nível com eles e promove (evolui).
//  - O mesmo time luta nos Pontos, no PvP e na guerra de bondes (simulador abaixo, com replay).
import type { PlayerState, Rarity } from '../types';
import type { RobberyJob } from '../types';

export type Spec = 'pistoleiro' | 'motorista' | 'hacker' | 'arrombador' | 'brutamonte' | 'golpista';
export const SPECS: { id: Spec; name: string; color: string; note: string }[] = [
  { id: 'pistoleiro', name: 'Pistoleiro', color: '#e8574a', note: 'Forte contra Brutamonte' },
  { id: 'brutamonte', name: 'Brutamonte', color: '#b07a4a', note: 'Forte contra Arrombador' },
  { id: 'arrombador', name: 'Arrombador', color: '#e0b13a', note: 'Forte contra Hacker' },
  { id: 'hacker', name: 'Hacker', color: '#3fd0e0', note: 'Forte contra Golpista' },
  { id: 'golpista', name: 'Golpista', color: '#b45fe0', note: 'Forte contra Motorista' },
  { id: 'motorista', name: 'Motorista', color: '#5fb85a', note: 'Forte contra Pistoleiro' },
];
/** Cada especialidade bate +25% na seguinte da roda (e apanha +25% da anterior) */
const BEATS: Record<Spec, Spec> = {
  pistoleiro: 'brutamonte', brutamonte: 'arrombador', arrombador: 'hacker', hacker: 'golpista', golpista: 'motorista', motorista: 'pistoleiro',
};
export const advantage = (a: Spec, b: Spec) => (BEATS[a] === b ? 1.25 : BEATS[b] === a ? 0.8 : 1);

/** Que especialidade rende mais em cada tipo de alvo (+25%) */
export const BUILDING_SPECS: Record<RobberyJob['building'], Spec[]> = {
  rua: ['golpista', 'pistoleiro'], banca: ['golpista'], loja: ['golpista', 'pistoleiro'], posto: ['pistoleiro', 'motorista'],
  garagem: ['motorista', 'arrombador'], porto: ['brutamonte', 'motorista'], joalheria: ['arrombador', 'hacker'], banco: ['hacker', 'arrombador'],
};

export interface Stats4 { hp: number; atk: number; def: number; spd: number }
export interface Species {
  id: string; name: string; spec: Spec; rarity: Rarity;
  base: Stats4;
  /** Promoção (evolução): vira esta espécie neste nível */
  evolvesTo?: string; evolveLevel?: number;
  /** Primeira região onde aparece (aparece nela e nas seguintes, conforme o nível) */
  minLevel: number;
  /** Índice do sprite na lista de capangas (cliente) e cor da roupa */
  sprite: number; tint: string;
}

const sp = (id: string, name: string, spec: Spec, rarity: Rarity, base: [number, number, number, number], minLevel: number, sprite: number, tint: string, evolvesTo?: string, evolveLevel?: number): Species =>
  ({ id, name, spec, rarity, base: { hp: base[0], atk: base[1], def: base[2], spd: base[3] }, minLevel, sprite, tint, evolvesTo, evolveLevel });

// Três estágios por especialidade (aparece no 1º, promove para os outros) + avulsos raros e lendários.
export const SPECIES: Species[] = [
  sp('trombadinha', 'Trombadinha', 'pistoleiro', 'comum', [40, 45, 35, 50], 1, 0, '#c94a3a', 'atirador', 18),
  sp('atirador', 'Atirador', 'pistoleiro', 'raro', [60, 70, 50, 65], 18, 1, '#c94a3a', 'matador', 40),
  sp('matador', 'Matador de Aluguel', 'pistoleiro', 'epico', [80, 100, 70, 85], 40, 2, '#8a1f1f'),
  sp('motoboy', 'Motoboy', 'motorista', 'comum', [40, 35, 35, 60], 1, 3, '#4a9a46', 'piloto_fuga', 18),
  sp('piloto_fuga', 'Piloto de Fuga', 'motorista', 'raro', [55, 55, 50, 85], 18, 4, '#4a9a46', 'as_volante', 40),
  sp('as_volante', 'Ás do Volante', 'motorista', 'epico', [75, 75, 65, 110], 40, 5, '#2c6e29'),
  sp('nerd', 'Nerd do Bairro', 'hacker', 'comum', [35, 50, 30, 50], 3, 6, '#2fa8c0', 'hacker_rua', 20),
  sp('hacker_rua', 'Hacker de Rua', 'hacker', 'raro', [50, 75, 45, 70], 20, 7, '#2fa8c0', 'fantasma_rede', 42),
  sp('fantasma_rede', 'Fantasma da Rede', 'hacker', 'epico', [65, 110, 60, 90], 42, 8, '#13697a'),
  sp('ladrao_galinha', 'Ladrão de Galinha', 'arrombador', 'comum', [45, 45, 40, 45], 2, 9, '#c9a03a', 'arrombador', 19),
  sp('arrombador', 'Arrombador', 'arrombador', 'raro', [65, 70, 60, 60], 19, 10, '#c9a03a', 'mestre_cofre', 41),
  sp('mestre_cofre', 'Mestre do Cofre', 'arrombador', 'epico', [85, 95, 85, 75], 41, 11, '#8a6a1a'),
  sp('leao_chacara', 'Leão de Chácara', 'brutamonte', 'comum', [60, 45, 55, 30], 2, 12, '#8a5a3a', 'seguranca', 20),
  sp('seguranca', 'Segurança Particular', 'brutamonte', 'raro', [90, 65, 80, 40], 20, 13, '#8a5a3a', 'tanque', 42),
  sp('tanque', 'Tanque', 'brutamonte', 'epico', [125, 85, 110, 50], 42, 14, '#5a3a22'),
  sp('camelo', 'Camelô Esperto', 'golpista', 'comum', [40, 40, 35, 55], 1, 15, '#9a4ac0', 'estelionatario', 18),
  sp('estelionatario', 'Estelionatário', 'golpista', 'raro', [55, 65, 50, 75], 18, 16, '#9a4ac0', 'rei_golpe', 40),
  sp('rei_golpe', 'Rei do Golpe', 'golpista', 'epico', [75, 95, 70, 100], 40, 17, '#5e2580'),
  // avulsos (não promovem): aparecem mais adiante e mais raros
  sp('cabeca_porto', 'Cabeça do Porto', 'brutamonte', 'raro', [95, 70, 75, 45], 10, 0, '#3a5a8a'),
  sp('doleiro', 'Doleiro', 'golpista', 'raro', [60, 70, 55, 70], 25, 1, '#2f7a5a'),
  sp('falsario', 'Falsário', 'hacker', 'raro', [55, 80, 50, 65], 30, 2, '#5a6a8a'),
  sp('sniper', 'Sniper do Morro', 'pistoleiro', 'epico', [70, 115, 55, 80], 50, 3, '#3a3a3a'),
  sp('dama_ouro', 'Dama de Ouro', 'golpista', 'epico', [70, 105, 65, 105], 55, 4, '#d4a52a'),
  sp('engenheiro', 'Engenheiro do Túnel', 'arrombador', 'epico', [90, 100, 95, 70], 60, 5, '#6a6a6a'),
  sp('rei_pista', 'Rei da Pista', 'motorista', 'epico', [80, 85, 70, 125], 65, 6, '#d63a2f'),
  // lendários: só no fim do mapa e na zona Fora da Lei
  sp('chefao_porto', 'Chefão do Porto', 'brutamonte', 'lendario', [140, 110, 130, 60], 80, 7, '#1d2a4a'),
  sp('a_sombra', 'A Sombra', 'hacker', 'lendario', [85, 140, 80, 120], 90, 8, '#101418'),
  sp('o_coronel', 'O Coronel', 'pistoleiro', 'lendario', [110, 140, 100, 95], 100, 9, '#4a3a1a'),
  sp('viuva_negra', 'Viúva Negra', 'golpista', 'lendario', [95, 130, 90, 125], 110, 10, '#2a0a1a'),
  sp('o_mecanico', 'O Mecânico', 'motorista', 'lendario', [100, 115, 100, 145], 120, 11, '#2a2a2a'),
];
export const speciesById = (id: string) => SPECIES.find(s => s.id === id);
/** Iniciais que o jogador escolhe */
export const STARTERS = ['trombadinha', 'motoboy', 'camelo'];

// ---------------- indivíduo ----------------
export interface Recruit {
  uid: string; speciesId: string; level: number; xp: number;
  ivs: Stats4;
  /** "Lenda da Rua": 1 em 24.000 por encontro (variação dourada, anunciada) */
  lenda?: boolean;
  /** Discos de treino aprendidos (+10% num atributo cada, até 2) */
  discs?: (keyof Stats4)[];
  caughtAt: number;
  /** Inicial: preso à conta */
  bound?: boolean;
}

export const RECRUIT = {
  maxLevel: 100,
  teamSize: 5,
  /** Encontros por hora de assalto */
  encountersPerHour: 6,
  windowSec: 30,
  lendaOdds: 1 / 24000,
  /** Parte do XP do assalto que cada capanga do time recebe */
  teamXpShare: 0.5,
  /** Capanga registrado no esconderijo treina com esta parte do XP (Clube: o dobro) */
  traineeShare: 0.25,
  maxDiscs: 2,
  /** Mercado: nível e potência mínimos para anunciar (Lenda e P5 em qualquer nível) */
  marketMinLevel: 50, marketMinPower: 3,
};

export const RECRUIT_CHANCE: Record<Rarity, number> = { comum: 0.6, raro: 0.35, epico: 0.15, lendario: 0.05 };
export type InviteId = 'simples' | 'bom' | 'otimo';
export const INVITES: { id: InviteId; name: string; mult: number; priceHours: number }[] = [
  { id: 'simples', name: 'Convite simples', mult: 1, priceHours: 0.01 },
  { id: 'bom', name: 'Convite bom', mult: 1.5, priceHours: 0.03 },
  { id: 'otimo', name: 'Convite ótimo', mult: 2.2, priceHours: 0.08 },
];
export const recruitChance = (s: Species, invite: InviteId, lenda = false) =>
  Math.min(0.95, RECRUIT_CHANCE[s.rarity] * (INVITES.find(i => i.id === invite)?.mult ?? 1) * (lenda ? 0.5 : 1));

export const recruitXpToNext = (level: number) => Math.floor(12 * Math.pow(level, 1.6));

/** Atributos finais no nível (fórmula clássica de coleção: base, individual e nível) */
export function recruitStats(r: Pick<Recruit, 'speciesId' | 'level' | 'ivs' | 'lenda' | 'discs'>, specBonus = 0): Stats4 {
  const s = speciesById(r.speciesId)!;
  const calc = (k: keyof Stats4) => {
    const raw = k === 'hp'
      ? Math.floor(((s.base.hp * 2 + r.ivs.hp) * r.level) / 100) + r.level + 10
      : Math.floor(((s.base[k] * 2 + r.ivs[k]) * r.level) / 100) + 5;
    const disc = 1 + 0.1 * (r.discs ?? []).filter(d => d === k).length;
    return Math.round(raw * disc * (r.lenda ? 1.1 : 1) * (1 + specBonus));
  };
  return { hp: calc('hp'), atk: calc('atk'), def: calc('def'), spd: calc('spd') };
}
/** Potência P1 a P5 pela soma dos atributos individuais (0 a 124) */
export const powerClass = (ivs: Stats4) => {
  const t = ivs.hp + ivs.atk + ivs.def + ivs.spd;
  return t >= 110 ? 5 : t >= 90 ? 4 : t >= 65 ? 3 : t >= 40 ? 2 : 1;
};
export const recruitScore = (st: Stats4) => st.atk + st.def + st.spd + st.hp / 2;

/** Pontos dominados (ginásios): +25% nos atributos dessa especialidade */
export const POINT_BONUS = 0.25;

// ---------------- força do time nos assaltos ----------------
const memberAt = (level: number) => recruitScore(recruitStats({ speciesId: 'atirador', level, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } }));
/** Quantos capangas medianos um alvo "pede": 1 no começo (o inicial dá conta), 2 a partir do nível 10, 3 a partir do 25 */
export const membersFor = (minLevel: number) => (minLevel < 10 ? 1 : minLevel < 25 ? 2 : 3);
/** Força que um assalto "pede": capangas medianos 2 níveis acima do mínimo */
export const jobRequirement = (job: Pick<RobberyJob, 'minLevel'>) => membersFor(job.minLevel) * memberAt(Math.min(100, job.minLevel + 2));

export function teamOf(p: PlayerState): Recruit[] {
  const r = p.recruits;
  if (!r) return [];
  return r.team.map(uid => r.depot.find(x => x.uid === uid)).filter((x): x is Recruit => !!x);
}

/** Força do time contra um alvo (com vantagem de especialidade e bônus de Ponto dominado) */
export function teamPower(p: PlayerState, job?: Pick<RobberyJob, 'building'>, pointSpecs: Spec[] = []) {
  let total = 0;
  for (const r of teamOf(p)) {
    const s = speciesById(r.speciesId);
    if (!s) continue;
    const st = recruitStats(r, pointSpecs.includes(s.spec) ? POINT_BONUS : 0);
    const adv = job && BUILDING_SPECS[job.building].includes(s.spec) ? 1.25 : 1;
    total += recruitScore(st) * adv;
  }
  return total;
}

/** Efeito do time num assalto: velocidade, grana e dano (time fraco atrasa, time forte acelera) */
export function teamEffect(p: PlayerState, job: Pick<RobberyJob, 'building' | 'minLevel'>, pointSpecs: Spec[] = []) {
  // sem nenhum capanga ainda (antes de escolher o primeiro), o assalto roda no ritmo normal
  const ratio = teamOf(p).length ? teamPower(p, job, pointSpecs) / jobRequirement(job) : 1;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return {
    ratio,
    speed: clamp(0.8 + 0.2 * ratio, 0.8, 1.5),
    cash: clamp(0.8 + 0.2 * ratio, 0.8, 1.5),
    damage: clamp(1.3 - 0.3 * ratio, 0.6, 1.3),
  };
}

// ---------------- encontros ----------------
type Rand = () => number;
/** Quem aparece num distrito, pelo nível do alvo: espécies-base liberadas, raros pesam menos */
export function rollEncounter(jobLevel: number, rand: Rand, now: number, districtId: string) {
  const pool = SPECIES.filter(s => s.minLevel <= Math.max(1, jobLevel + 5) && !SPECIES.some(o => o.evolvesTo === s.id && s.rarity !== 'lendario'));
  const w = pool.map(s => ({ comum: 60, raro: 20, epico: 6, lendario: 1 })[s.rarity]);
  let x = rand() * w.reduce((a, b) => a + b, 0);
  let s = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) < 0) { s = pool[i]; break; }
  const iv = () => Math.floor(rand() * 32);
  const level = Math.max(1, Math.min(RECRUIT.maxLevel, Math.round(jobLevel * (0.8 + rand() * 0.4))));
  return {
    id: `enc-${now.toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
    speciesId: s.id, level, ivs: { hp: iv(), atk: iv(), def: iv(), spd: iv() },
    lenda: rand() < RECRUIT.lendaOdds, expiresAt: now + RECRUIT.windowSec * 1000, district: districtId,
  };
}
export type Encounter = ReturnType<typeof rollEncounter>;

// ---------------- batalha (Pontos, PvP, guerra de bondes) ----------------
export interface Fighter { name: string; spec: Spec; lenda?: boolean; sprite: number; tint: string; max: number; hp: number; atk: number; def: number; spd: number; level: number }
export interface BattleTurn { a: 0 | 1; ai: number; di: number; dmg: number; hp: number; crit: boolean; adv: number; ko: boolean }
export interface BattleResult { winner: 0 | 1; turns: BattleTurn[]; teams: [Fighter[], Fighter[]] }

export function fighterOf(r: Recruit, specBonus: Spec[] = []): Fighter {
  const s = speciesById(r.speciesId)!;
  const st = recruitStats(r, specBonus.includes(s.spec) ? POINT_BONUS : 0);
  return { name: s.name, spec: s.spec, lenda: r.lenda, sprite: s.sprite, tint: r.lenda ? '#f2c14e' : s.tint, max: st.hp, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd, level: r.level };
}

/** Luta automática: o primeiro de pé de cada lado se enfrenta até cair; quem for mais rápido bate primeiro. */
export function simulateBattle(teamA: Fighter[], teamB: Fighter[], seed: number): BattleResult {
  let s = seed >>> 0 || 1;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const A = teamA.map(f => ({ ...f })), B = teamB.map(f => ({ ...f }));
  const turns: BattleTurn[] = [];
  let ia = 0, ib = 0, guard = 0;
  while (ia < A.length && ib < B.length && guard++ < 600) {
    const fa = A[ia], fb = B[ib];
    const order: (0 | 1)[] = fa.spd === fb.spd ? (rand() < 0.5 ? [0, 1] : [1, 0]) : fa.spd > fb.spd ? [0, 1] : [1, 0];
    for (const side of order) {
      const att = side === 0 ? fa : fb, def = side === 0 ? fb : fa;
      if (att.hp <= 0 || def.hp <= 0) continue;
      const adv = advantage(att.spec, def.spec);
      const crit = rand() < 0.08;
      const dmg = Math.max(1, Math.round((att.atk * att.atk / (att.atk + def.def)) * adv * (0.85 + rand() * 0.15) * (crit ? 1.5 : 1) * 0.6));
      def.hp = Math.max(0, def.hp - dmg);
      turns.push({ a: side, ai: side === 0 ? ia : ib, di: side === 0 ? ib : ia, dmg, hp: def.hp, crit, adv, ko: def.hp <= 0 });
    }
    if (fa.hp <= 0) ia++;
    if (fb.hp <= 0) ib++;
  }
  const winner: 0 | 1 = ia >= A.length ? 1 : ib >= B.length ? 0 : (A.reduce((t, f) => t + f.hp, 0) >= B.reduce((t, f) => t + f.hp, 0) ? 0 : 1);
  return { winner, turns, teams: [teamA, teamB] };
}

/** Time de NPC para um nível (líder de Ponto sem dono, adversário de PvP quando a fila está vazia) */
export function npcTeam(level: number, spec: Spec | null, seed: number, size = 5): Fighter[] {
  let s = seed >>> 0 || 7;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pool = SPECIES.filter(x => x.minLevel <= level && (!spec || x.spec === spec) && x.rarity !== 'lendario');
  return Array.from({ length: size }, () => {
    const sp = pool[Math.floor(rand() * pool.length)] ?? SPECIES[0];
    const iv = () => 10 + Math.floor(rand() * 15);
    return fighterOf({ uid: '', speciesId: sp.id, level: Math.max(1, Math.min(100, level)), xp: 0, ivs: { hp: iv(), atk: iv(), def: iv(), spd: iv() }, caughtAt: 0 });
  });
}
