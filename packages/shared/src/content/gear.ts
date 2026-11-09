// Equipamento com status: roupas, armas, acessórios e carros agora só caem jogando (assaltos, planos,
// golpes em equipe, corrida e territórios). Cada item cai com raridade e status sorteados, então dois
// itens iguais saem diferentes — é isso que dá valor ao mercado entre jogadores.
//
// Regras que não quebram:
//  - nada pago sorteia item (sem caixa de recompensa paga; ECA Digital, Lei 15.211/2025);
//  - o Clube Rockeiro só aumenta a quantidade de drops, nunca vende sorteio;
//  - todo status tem teto somando os itens, para quem compra no mercado não quebrar o jogo de quem joga grátis.
import type { DiamondItem, PlayerState, RareInstance, Rarity } from '../types';
import { DIAMOND_ITEMS } from './shop';
import { VEHICLE_CLASSES, vehicleCategory } from './supply';

export type GearSlot = 'character' | 'vehicle' | 'jewelry' | 'weapon';
export const GEAR_SLOTS: { id: GearSlot; name: string }[] = [
  { id: 'character', name: 'Roupa' }, { id: 'weapon', name: 'Arma' }, { id: 'jewelry', name: 'Acessório' }, { id: 'vehicle', name: 'Carro' },
];

export type StatId =
  | 'cash' | 'xp' | 'speed' | 'stealth' | 'intimidate' | 'luck' | 'rareFind' | 'escape'
  | 'lawyer' | 'jail' | 'pocket' | 'launder' | 'boss' | 'chem' | 'dealer' | 'reaction'
  | 'accel' | 'topSpeed' | 'armor' | 'turf' | 'hideout' | 'vest' | 'aim'
  | 'role_motorista' | 'role_hacker' | 'role_arrombador' | 'role_vigia';

export interface StatDef {
  id: StatId;
  name: string;
  /** Texto com {v} no lugar do valor */
  text: string;
  /** Peças em que o status pode aparecer */
  slots: GearSlot[];
  /** Faixa em % para um item comum (as raridades acima multiplicam) */
  base: [number, number];
  /** Teto somando todos os itens equipados (o bônus de conjunto passa do teto) */
  cap: number;
  /** Só aparece a partir desta raridade */
  minRarity?: Rarity;
}

const ALL: GearSlot[] = ['character', 'vehicle', 'jewelry', 'weapon'];
export const STATS: StatDef[] = [
  { id: 'cash', name: 'Grana nos assaltos', text: '+{v}% de grana nos assaltos', slots: ['weapon', 'jewelry'], base: [2, 5], cap: 60 },
  { id: 'xp', name: 'Respeito', text: '+{v}% de XP', slots: ['character', 'jewelry'], base: [2, 5], cap: 50 },
  { id: 'speed', name: 'Agilidade', text: 'Assaltos {v}% mais rápidos', slots: ['character', 'vehicle'], base: [2, 4], cap: 35 },
  { id: 'stealth', name: 'Discrição', text: '-{v}% de procurado por assalto', slots: ['character'], base: [2, 5], cap: 40 },
  { id: 'intimidate', name: 'Intimidação', text: '+{v}% de grana em golpes de 4★ ou mais', slots: ['weapon'], base: [3, 7], cap: 60 },
  { id: 'luck', name: 'Sorte', text: '+{v}% de chance de drop', slots: ['jewelry'], base: [3, 6], cap: 60 },
  { id: 'rareFind', name: 'Faro para raros', text: '+{v}% de chance de raro numerado', slots: ['jewelry'], base: [2, 4], cap: 40, minRarity: 'raro' },
  { id: 'escape', name: 'Fuga', text: 'Procurado esfria {v}% mais rápido', slots: ['vehicle'], base: [4, 8], cap: 80 },
  { id: 'lawyer', name: 'Lábia', text: '-{v}% no custo do advogado', slots: ['jewelry', 'character'], base: [4, 8], cap: 50 },
  { id: 'jail', name: 'Contatos', text: '-{v}% de tempo na cadeia', slots: ['jewelry'], base: [4, 8], cap: 50 },
  { id: 'pocket', name: 'Bolso fundo', text: '-{v}% de grana suja apreendida', slots: ['character'], base: [4, 8], cap: 60 },
  { id: 'launder', name: 'Lavanderia', text: '-{v}% na taxa de lavagem', slots: ['jewelry'], base: [4, 8], cap: 50 },
  { id: 'boss', name: 'Patrão', text: '+{v}% de renda dos imóveis', slots: ['jewelry'], base: [2, 5], cap: 50 },
  { id: 'chem', name: 'Químico', text: 'Galpão {v}% mais rápido', slots: ['character'], base: [3, 6], cap: 50 },
  { id: 'dealer', name: 'Vendedor', text: '+{v}% no preço dos pontos de venda', slots: ['jewelry'], base: [2, 5], cap: 40 },
  { id: 'reaction', name: 'Tempo de reação', text: '+{v}% de tempo para despistar a polícia', slots: ['vehicle', 'jewelry'], base: [5, 10], cap: 100 },
  { id: 'accel', name: 'Aceleração', text: 'Corrida: +{v}% de aceleração', slots: ['vehicle'], base: [3, 6], cap: 50 },
  { id: 'topSpeed', name: 'Velocidade final', text: 'Corrida: +{v}% de velocidade máxima', slots: ['vehicle'], base: [2, 4], cap: 25 },
  { id: 'armor', name: 'Lataria', text: 'Corrida: perde {v}% menos velocidade ao bater', slots: ['vehicle'], base: [4, 8], cap: 60 },
  { id: 'turf', name: 'Dono da área', text: '+{v}% de pontos de território', slots: ['weapon'], base: [3, 7], cap: 60 },
  { id: 'vest', name: 'Colete', text: '-{v}% de dano nos golpes', slots: ['character'], base: [3, 6], cap: 50 },
  { id: 'aim', name: 'Pontaria', text: '-{v}% de munição gasta', slots: ['weapon'], base: [3, 6], cap: 50 },
  { id: 'hideout', name: 'Esconderijo', text: '-{v}% de espera no esconderijo', slots: ['character'], base: [4, 8], cap: 50 },
  { id: 'role_motorista', name: 'Especialista: motorista', text: '+{v}% da parte no golpe em equipe como motorista', slots: ALL, base: [4, 8], cap: 60 },
  { id: 'role_hacker', name: 'Especialista: hacker', text: '+{v}% da parte no golpe em equipe como hacker', slots: ALL, base: [4, 8], cap: 60 },
  { id: 'role_arrombador', name: 'Especialista: arrombador', text: '+{v}% da parte no golpe em equipe como arrombador', slots: ALL, base: [4, 8], cap: 60 },
  { id: 'role_vigia', name: 'Especialista: vigia', text: '+{v}% da parte no golpe em equipe como vigia', slots: ALL, base: [4, 8], cap: 60 },
];
export const statDef = (id: StatId) => STATS.find(s => s.id === id)!;
export const statText = (id: StatId, v: number) => statDef(id).text.replace('{v}', String(Math.round(v)));

export const RARITIES: Rarity[] = ['comum', 'raro', 'epico', 'lendario'];
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);
/** Quantos status e quanto cada um vale por raridade */
export const RARITY_RULES: Record<Rarity, { stats: number; mult: number; repair: number }> = {
  comum: { stats: 1, mult: 1, repair: 500 },
  raro: { stats: 2, mult: 1.6, repair: 2000 },
  epico: { stats: 3, mult: 2.3, repair: 8000 },
  lendario: { stats: 3, mult: 3.2, repair: 25000 },
};

// ---------------- conjuntos ----------------
export type SetId = 'rua' | 'fantasma' | 'magnata' | 'pista';
export interface GearSet { id: SetId; name: string; two: Partial<Record<StatId, number>>; four: Partial<Record<StatId, number>> }
export const GEAR_SETS: GearSet[] = [
  { id: 'rua', name: 'Bonde da Rua', two: { cash: 5 }, four: { speed: 10 } },
  { id: 'fantasma', name: 'Fantasma', two: { stealth: 10 }, four: { escape: 30 } },
  { id: 'magnata', name: 'Magnata', two: { boss: 10 }, four: { launder: 20 } },
  { id: 'pista', name: 'Rei da Pista', two: { accel: 10 }, four: { topSpeed: 8, armor: 20 } },
];

// ---------------- efeito único dos lendários ----------------
export type PerkId = 'dono_da_noite' | 'blindado' | 'mao_leve' | 'sortudo';
export const PERKS: { id: PerkId; name: string; text: string }[] = [
  { id: 'dono_da_noite', name: 'Dono da Noite', text: '+25% de grana nos assaltos à noite' },
  { id: 'blindado', name: 'Blindado', text: 'A primeira prisão do dia não apreende grana suja' },
  { id: 'mao_leve', name: 'Mão Leve', text: 'Golpes de 4★ ou mais rendem 1 peça extra' },
  { id: 'sortudo', name: 'Sortudo', text: 'Chance de raro numerado ×1,5 (passa do teto)' },
];

export const GEAR = {
  /** Desgaste por assalto concluído com o item equipado (0 a 100) */
  wearPerRobbery: 0.1,
  /** Item gasto (100) rende só metade dos status até consertar */
  wornMult: 0.5,
  /** Drops de equipamento por hora de assalto, por estrela do golpe */
  perHour: { 1: 0.25, 2: 0.35, 3: 0.5, 4: 0.7, 5: 0.9, 6: 1.1 } as Record<number, number>,
  /** Chance de cair equipamento ao terminar um plano de golpe */
  planChance: 0.5,
  /** Pesos de raridade (comum, raro, épico, lendário) por estrela do golpe */
  rarityWeights: {
    1: [80, 18, 2, 0], 2: [70, 25, 5, 0], 3: [60, 30, 9, 1], 4: [45, 35, 17, 3], 5: [30, 38, 25, 7], 6: [20, 35, 33, 12],
  } as Record<number, [number, number, number, number]>,
  /** Chance de o item vir de um conjunto (só épico e lendário) */
  setChance: 0.5,
  /** Mochila cheia: drops novos viram peças */
  bagMax: 60,
};

// ---------------- bases ----------------
/** Itens que podem cair com status: os visuais das 4 peças, menos os iniciais e os exclusivos. */
export const GEAR_BASES: DiamondItem[] = DIAMOND_ITEMS.filter(i =>
  i.kind === 'cosmetic' && i.slot && i.slot !== 'hideout' && !i.starter && !i.exclusive && !i.rare);
export const isGearSlot = (s: string | undefined): s is GearSlot => s === 'character' || s === 'vehicle' || s === 'jewelry' || s === 'weapon';

/** Faixa visual da base (pelo preço antigo), para casar base e raridade do drop. */
function baseTier(i: DiamondItem): number {
  if (i.priceDiamonds >= 300 || (i.priceCash ?? 0) >= 50_000) return 3;
  if (i.priceDiamonds >= 100 || (i.priceCash ?? 0) >= 15_000) return 2;
  if (i.priceDiamonds > 0 || (i.priceCash ?? 0) >= 4_000) return 1;
  return 0;
}

type Rand = () => number;
const pickWeighted = (weights: number[], r: number) => {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r * total;
  for (let i = 0; i < weights.length; i++) if ((x -= weights[i]) < 0) return i;
  return weights.length - 1;
};

export function rollRarity(stars: number, rand: Rand): Rarity {
  const w = GEAR.rarityWeights[Math.max(1, Math.min(6, stars))];
  return RARITIES[pickWeighted(w, rand())];
}

export function rollBase(rarity: Rarity, rand: Rand): DiamondItem {
  const rank = rarityRank(rarity);
  const pool = GEAR_BASES.filter(b => baseTier(b) === rank || baseTier(b) === rank - 1);
  const list = pool.length ? pool : GEAR_BASES;
  return list[Math.floor(rand() * list.length)];
}

/** Sorteia status, conjunto e efeito único para uma base e raridade. */
export function rollStats(base: DiamondItem, rarity: Rarity, rand: Rand) {
  const slot = base.slot as GearSlot;
  const rule = RARITY_RULES[rarity];
  const melee = base.weapon?.kind === 'taco' || base.weapon?.kind === 'faca';
  const pool = STATS.filter(s => s.slots.includes(slot) && (!s.minRarity || rarityRank(rarity) >= rarityRank(s.minRarity)) && !(melee && s.id === 'aim'));
  const stats: Partial<Record<StatId, number>> = {};
  const n = Math.min(rule.stats, pool.length);
  let left = [...pool];
  // as 4 especialidades de golpe em equipe contam juntas como um status só no sorteio
  const weight = (d: StatDef) => (d.id.startsWith('role_') ? 0.25 : 1);
  for (let i = 0; i < n && left.length; i++) {
    let x = rand() * left.reduce((sum, d) => sum + weight(d), 0);
    let idx = left.findIndex(d => (x -= weight(d)) < 0);
    if (idx < 0) idx = left.length - 1;
    const s = left.splice(idx, 1)[0];
    if (s.id.startsWith('role_')) left = left.filter(d => !d.id.startsWith('role_')); // uma especialidade por item
    const [lo, hi] = s.base;
    stats[s.id] = Math.max(1, Math.round((lo + (hi - lo) * rand()) * rule.mult));
  }
  const out: Pick<RareInstance, 'rarity' | 'stats' | 'set' | 'perk' | 'wear'> = { rarity, stats, wear: 0 };
  if (rarityRank(rarity) >= 2 && rand() < GEAR.setChance) out.set = GEAR_SETS[Math.floor(rand() * GEAR_SETS.length)].id;
  if (rarity === 'lendario') out.perk = PERKS[Math.floor(rand() * PERKS.length)].id;
  return out;
}

/** Raridade de um raro numerado: tiragem pequena = lendário. */
export const numberedRarity = (item: DiamondItem): Rarity => ((item.rare?.supply ?? 999) <= 300 ? 'lendario' : 'epico');

// ---------------- status da gangue ----------------
export type StatTotals = Record<StatId, number>;
const zero = () => Object.fromEntries(STATS.map(s => [s.id, 0])) as StatTotals;

/** Itens equipados com status (um por peça). */
export function equippedGear(p: PlayerState): RareInstance[] {
  const out: RareInstance[] = [];
  const on = p.gearOn ?? {};
  for (const slot of GEAR_SLOTS) {
    const uid = on[slot.id];
    if (!uid) continue;
    const g = p.inventory?.rares?.find(r => r.uid === uid);
    if (g && p.equipped[slot.id] === g.itemId) out.push(g);
  }
  return out;
}

export const wearMult = (g: RareInstance) => ((g.wear ?? 0) >= 100 ? GEAR.wornMult : 1);

export interface GearSummary {
  /** Totais em % já com teto e conjunto (use como fração: v / 100) */
  stats: StatTotals;
  /** Totais antes do teto (para mostrar "passou do teto") */
  raw: StatTotals;
  sets: { id: SetId; name: string; pieces: number }[];
  perks: PerkId[];
  /** Categoria e classe do veículo em uso (bônus próprio, fora do teto) */
  vehicle: { category: string; className: string | null; speed: number; cash: number };
}

export function gearSummary(p: PlayerState): GearSummary {
  const raw = zero();
  const sets = new Map<SetId, number>();
  const perks: PerkId[] = [];
  for (const g of equippedGear(p)) {
    const m = wearMult(g);
    for (const [k, v] of Object.entries(g.stats ?? {})) if (k in raw) raw[k as StatId] += (v ?? 0) * m;
    if (g.set) sets.set(g.set, (sets.get(g.set) ?? 0) + 1);
    if (g.perk && !perks.includes(g.perk)) perks.push(g.perk);
  }
  const stats = zero();
  for (const s of STATS) stats[s.id] = Math.min(s.cap, raw[s.id]);
  const setList: GearSummary['sets'] = [];
  for (const [id, pieces] of sets) {
    const def = GEAR_SETS.find(x => x.id === id)!;
    setList.push({ id, name: def.name, pieces });
    if (pieces >= 2) for (const [k, v] of Object.entries(def.two)) stats[k as StatId] += v ?? 0;
    if (pieces >= 4) for (const [k, v] of Object.entries(def.four)) stats[k as StatId] += v ?? 0;
  }
  // veículo: categoria (moto, esportivo...) + classe pela raridade (C, B, A, S)
  const vItem = DIAMOND_ITEMS.find(i => i.id === p.equipped.vehicle);
  const cat = vehicleCategory(vItem?.vehicleType);
  const vGear = equippedGear(p).find(g => DIAMOND_ITEMS.find(i => i.id === g.itemId)?.slot === 'vehicle');
  const cls = vGear ? VEHICLE_CLASSES[vGear.rarity ?? 'comum'] : null;
  const vehicle = { category: cat.name, className: cls?.name ?? null, speed: cat.speed + (cls?.speed ?? 0), cash: cat.cash + (cls?.cash ?? 0) };
  return { stats, raw, sets: setList, perks, vehicle };
}

/** Atalho: fração do status (0,15 = 15%) */
export const gearFrac = (p: PlayerState, id: StatId) => gearSummary(p).stats[id] / 100;

/** Nome do item com número de série quando tiver */
export const gearSerial = (g: Pick<RareInstance, 'serial'>) => (g.serial > 0 ? `#${String(g.serial).padStart(4, '0')}` : '');

/** Valor de referência do item para ordenar a mochila e sugerir preço no mercado */
export function gearScore(g: RareInstance) {
  const r = rarityRank(g.rarity ?? 'comum');
  const sum = Object.values(g.stats ?? {}).reduce((s, v) => s + (v ?? 0), 0);
  return (r + 1) * 100 + sum + (g.perk ? 80 : 0) + (g.set ? 30 : 0) + (g.serial > 0 ? 200 - Math.min(150, g.serial) : 0);
}

export const repairCost = (g: RareInstance) => Math.ceil(RARITY_RULES[g.rarity ?? 'comum'].repair * Math.min(100, g.wear ?? 0) / 100);
