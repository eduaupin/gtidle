// Motor idle autoritativo. Função pura: recebe o estado e o "agora", devolve o estado avançado.
// O cliente nunca diz quanto ganhou — o servidor calcula pelo relógio dele.
import {
  DECOR_ITEMS, DEFAULT_PLACED, DIAMOND_ITEMS, DISTRICTS, DROP_RULES, HEIST_PLANS, PARTS, RARE_ITEMS, emptyInventory, ownsItem, DRUGS, PROPERTIES, ROBBERIES, RULES, STARTER_DECOR, STARTER_ITEMS,
  arsenalMult, equipamentoHeatMult, heatCapFor, starsFor, INSURANCE, LAUNDER, NIGHT, isNight, isLookBurned, oficinaMult,
  cashMult, isJailed, isTurbo, isVip, labLines, lawyerCost, nextRandom, offlineCapMs, robberyModeMult, xpMult, xpToNext,
  type DrugId, type GameEvent, type PlayerState, type RobberyJob, type RobberyMode,
} from '@gti/shared';

export const jobById = (id: string) => robberyById.get(id);
const robberyById = new Map<string, RobberyJob & { rareChance?: number }>([...ROBBERIES, ...HEIST_PLANS].map(r => [r.id, r]));
const planIds = new Set(HEIST_PLANS.map(h => h.id));

// ---------------- número de série dos raros ----------------
// O servidor troca este contador por um global (persistido na loja de dados); os testes usam este.
const localSerials = new Map<string, number>();
let allocSerial: (itemId: string, supply: number) => number | null = (itemId, supply) => {
  const n = (localSerials.get(itemId) ?? 0) + 1;
  if (n > supply) return null;
  localSerials.set(itemId, n);
  return n;
};
export function setSerialAllocator(fn: (itemId: string, supply: number) => number | null) { allocSerial = fn; }

// ---------------- ganchos do servidor ----------------
// Território: bônus de grana do bonde que domina a região nesta semana (0 = nenhum).
let territoryBonus: (p: PlayerState, district: string, t: number) => number = () => 0;
export function setTerritoryBonus(fn: (p: PlayerState, district: string, t: number) => number) { territoryBonus = fn; }
// Depois de cada avanço o servidor processa os eventos (pontos de território, jornal, convites).
let afterAdvance: ((p: PlayerState, events: GameEvent[], now: number) => void) | null = null;
export function setAfterAdvance(fn: ((p: PlayerState, events: GameEvent[], now: number) => void) | null) { afterAdvance = fn; }

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = (n = 6) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
const drugById = new Map(DRUGS.map(d => [d.id, d]));

export function newPlayer(id: string, nick: string, now: number): PlayerState {
  return {
    id, nick, createdAt: now,
    level: 1, xp: 0, cash: 50, diamondsPaid: 0, diamondsEarned: 0,
    heat: 0, jailedUntil: null, district: 'periferia', lastTick: now,
    vipUntil: null, turboUntil: null,
    flags: { founder: false, starterPack: false, battlePassSeason: null },
    robberies: [{ jobId: 'carteira', progressSec: 0 }],
    lab: { level: 0, lines: [{ drugId: null, progressSec: 0, loaded: false }] },
    supplies: { folha: 0, po_neon: 0, cristal: 0 },
    product: { folha: 0, po_neon: 0, cristal: 0 },
    dealing: { points: 1, drugId: null, sellProgress: 0 },
    properties: {},
    cosmetics: [...STARTER_ITEMS],
    equipped: { character: 'skin_padrao', vehicle: 'carro_padrao', hideout: 'base_padrao', jewelry: null, weapon: null },
    stats: { robberiesDone: 0, unitsSold: 0, timesJailed: 0, cashEarned: 0, batchesDone: 0, lawyerUses: 0, jobCounts: {} },
    missionIndex: 0,
    seenIntro: false,
    alert: null,
    nextAlertAt: null,
    heatWarning: null,
    hideout: null,
    burned: {},
    lookBurn: null,
    upgrades: { arsenal: 0, oficina: 0, equipamento: 0 },
    decor: { owned: [...STARTER_DECOR], placed: { ...DEFAULT_PLACED } },
    ads: { day: '', count: 0 },
    inventory: emptyInventory(),
    market: { balance: 0, adSlotUntil: null, sold: 0, bought: 0 },
    dirtyCash: 0,
    insurance: null,
    tuning: { owned: [], cars: {} },
    crewId: null,
    inbox: [],
    referral: { code: makeCode(), by: null, rewarded: 0, paidOut: false },
    race: { day: '', runs: 0 },
    rngSeed: Math.floor(Math.random() * 2 ** 31),
  };
}

/** Completa campos que saves antigos não têm (rodar sempre ao carregar um jogador). */
export function migrate(p: PlayerState): PlayerState {
  p.stats.batchesDone ??= 0;
  p.stats.lawyerUses ??= 0;
  p.stats.jobCounts ??= {};
  p.missionIndex ??= 0;
  p.seenIntro ??= false;
  p.alert ??= null;
  p.nextAlertAt ??= null;
  p.heatWarning ??= null;
  p.hideout ??= null;
  p.burned ??= {};
  p.lookBurn ??= null;
  p.upgrades ??= { arsenal: 0, oficina: 0, equipamento: 0 };
  p.decor ??= { owned: [...STARTER_DECOR], placed: { ...DEFAULT_PLACED } };
  // itens que saíram da loja (troca de arte) somem do inventário e voltam para o visual inicial
  const items = new Set(DIAMOND_ITEMS.map(i => i.id));
  p.cosmetics = p.cosmetics.filter(id => items.has(id));
  for (const id of STARTER_ITEMS) if (!p.cosmetics.includes(id)) p.cosmetics.push(id);
  p.inventory ??= emptyInventory();
  p.inventory.parts ??= emptyInventory().parts;
  for (const part of PARTS) p.inventory.parts[part.id] ??= 0;
  p.inventory.plans ??= {};
  p.inventory.rares ??= [];
  p.market ??= { balance: 0, adSlotUntil: null, sold: 0, bought: 0 };
  p.dirtyCash ??= 0;
  p.insurance ??= null;
  p.tuning ??= { owned: [], cars: {} };
  p.crewId ??= null;
  p.inbox ??= [];
  p.referral ??= { code: makeCode(), by: null, rewarded: 0, paidOut: false };
  p.race ??= { day: '', runs: 0 };
  if (!items.has(p.equipped.character) || !ownsItem(p, p.equipped.character)) p.equipped.character = 'skin_padrao';
  if (!items.has(p.equipped.vehicle) || !ownsItem(p, p.equipped.vehicle)) p.equipped.vehicle = 'carro_padrao';
  if (!items.has(p.equipped.hideout)) p.equipped.hideout = 'base_padrao';
  const decor = new Set(DECOR_ITEMS.map(d => d.id));
  p.decor.owned = p.decor.owned.filter(id => decor.has(id));
  for (const id of STARTER_DECOR) if (!p.decor.owned.includes(id)) p.decor.owned.push(id);
  for (const [slot, id] of Object.entries(p.decor.placed)) {
    if (!id || !decor.has(id)) delete p.decor.placed[slot as keyof typeof p.decor.placed];
  }
  // piso e parede nunca ficam vazios (os outros espaços o jogador pode esvaziar)
  p.decor.placed.piso ??= DEFAULT_PLACED.piso;
  p.decor.placed.parede ??= DEFAULT_PLACED.parede;
  p.ads ??= { day: '', count: 0 };
  p.equipped.jewelry ??= null;
  p.equipped.weapon ??= null;
  if (p.equipped.jewelry && (!items.has(p.equipped.jewelry) || !ownsItem(p, p.equipped.jewelry))) p.equipped.jewelry = null;
  if (p.equipped.weapon && (!items.has(p.equipped.weapon) || !ownsItem(p, p.equipped.weapon))) p.equipped.weapon = null;
  return p;
}

/** Garante que o número de slots e linhas bate com o VIP atual (VIP expira → slot extra some). */
export function normalizeSlots(p: PlayerState, now: number) {
  const wantRob = isVip(p, now) ? RULES.robberySlotsVip : RULES.robberySlotsFree;
  while (p.robberies.length < wantRob) p.robberies.push({ jobId: null, progressSec: 0 });
  if (p.robberies.length > wantRob) p.robberies.length = wantRob;
  const wantLab = labLines(p, now);
  while (p.lab.lines.length < wantLab) p.lab.lines.push({ drugId: null, progressSec: 0, loaded: false });
  if (p.lab.lines.length > wantLab) p.lab.lines.length = wantLab;
}

function earn(p: PlayerState, cash: number) {
  p.cash += cash;
  p.stats.cashEarned += cash;
}

export function gainXp(p: PlayerState, xp: number, events: GameEvent[]) {
  p.xp += xp;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    events.push({ type: 'level_up', level: p.level });
  }
}

/**
 * Soma procurado. `maxStars` é o teto do golpe: golpe pequeno nunca passa das estrelas dele
 * (policial a pé não vira SWAT), mas também não derruba o procurado que já estava alto.
 */
function addHeat(p: PlayerState, amount: number, t: number, events: GameEvent[], maxStars = 6) {
  const before = p.heat;
  const cap = Math.max(before, heatCapFor(maxStars));
  p.heat = Math.min(100, cap, p.heat + amount * equipamentoHeatMult(p));
  // 4 estrelas: a polícia reconhece a roupa e o carro da gangue
  if (before < RULES.lookBurnHeat && p.heat >= RULES.lookBurnHeat) burnLook(p, t, events);
  // 3 estrelas: a polícia fecha o cerco e a gangue precisa se esconder
  if (p.heat >= RULES.hideoutTriggerHeat && p.heat < 100 && !p.hideout && !p.heatWarning) {
    p.heatWarning = { at: t, notified: false };
    events.push({ type: 'heat_warning' });
  }
  // VIP: automação do advogado (como o "usar poção" do PokeIdle)
  if (isVip(p, t) && p.heat >= RULES.vipAutoLawyerAt && p.cash >= lawyerCost(p)) {
    p.cash -= lawyerCost(p);
    p.heat = Math.max(0, p.heat - RULES.lawyerHeatReduction);
  }
  if (p.heat >= 100) {
    // seguro: apreende menos grana suja e corta o tempo de cadeia (uso único)
    const insured = !!p.insurance && p.insurance.until > t;
    const taken = Math.floor(p.dirtyCash * (insured ? INSURANCE.confiscate : LAUNDER.confiscate));
    p.dirtyCash -= taken;
    if (insured) p.insurance = null;
    p.jailedUntil = t + RULES.jailSec * 1000 * (insured ? INSURANCE.jailMult : 1);
    p.heat = RULES.heatAfterJail;
    p.stats.timesJailed += 1;
    events.push({ type: 'jailed', until: p.jailedUntil });
    if (taken > 0) events.push({ type: 'confiscated', amount: taken, insured });
  }
}

// ---------------- visual queimado (4 estrelas) ----------------

/** Queima a roupa e o carro em uso: ficam bloqueados por 8 h (4 h no Clube Rockeiro). */
export function burnLook(p: PlayerState, t: number, events: GameEvent[]) {
  const hours = isVip(p, t) ? RULES.lookCooldownHoursVip : RULES.lookCooldownHours;
  const until = t + hours * 3600_000;
  const items = [p.equipped.character, p.equipped.vehicle];
  for (const id of items) p.burned[id] = until;
  p.lookBurn = { at: t, notified: false };
  events.push({ type: 'look_burned', items, until });
}

// ---------------- esconderijo ("barra suja") ----------------

/** Manda a gangue para a base: para de roubar e o procurado esfria rápido. */
export function enterHideout(p: PlayerState, now: number): GameEvent[] {
  const base = isVip(p, now) ? RULES.hideoutMinutesVip : RULES.hideoutMinutes;
  // 5 estrelas ou mais: helicóptero no ar, demora mais para a barra esfriar
  const minutes = starsFor(p.heat) >= 5 ? base * RULES.heliHideoutMult : base;
  const resume = p.robberies.map(s => s.jobId);
  for (const s of p.robberies) { s.jobId = null; s.progressSec = 0; }
  p.hideout = { since: now, until: now + minutes * 60_000, resume, readyNotified: false };
  p.heatWarning = null;
  return [{ type: 'hideout_start', until: p.hideout.until }];
}

/** Sai da base e retoma os assaltos que estavam rodando. */
export function leaveHideout(p: PlayerState, now: number, auto: boolean): GameEvent[] {
  const h = p.hideout;
  if (!h) return [];
  h.resume.forEach((jobId, i) => {
    const slot = p.robberies[i];
    if (slot && !slot.jobId && jobId) { slot.jobId = jobId; slot.progressSec = 0; slot.once = planIds.has(jobId) || undefined; }
  });
  p.hideout = null;
  return [{ type: 'hideout_done', auto }];
}

/** Roda a cada passo: esfria o procurado escondido e decide quando dá para voltar. */
function tickHideout(p: PlayerState, t: number, dt: number, events: GameEvent[]) {
  if (p.heatWarning && p.heat < RULES.hideoutClearHeat) p.heatWarning = null;
  const h = p.hideout;
  if (!h) return;
  p.heat = Math.max(0, p.heat - RULES.hideoutHeatDecayPerSec * dt);
  if (t < h.until) return;
  if (t - dt * 1000 < h.until) events.push({ type: 'hideout_ready' });
  // Clube Rockeiro volta sozinho; os demais voltam sozinhos só depois de um bom tempo
  if (isVip(p, t) || t >= h.since + RULES.hideoutAutoResumeMinutes * 60_000) {
    events.push(...leaveHideout(p, t, true));
  }
}

// ---------------- alerta "seu roubo está sendo monitorado" ----------------

function randomGapMs(p: PlayerState) {
  const [r, seed] = nextRandom(p.rngSeed);
  p.rngSeed = seed;
  const min = RULES.alertGapMinMinutes, max = RULES.alertGapMaxMinutes;
  return (min + (max - min) * r) * 60_000;
}

/** Agenda, cria e vence alertas. Roda a cada passo do motor. */
function tickAlert(p: PlayerState, t: number, events: GameEvent[]) {
  // bônus VIP que acabou volta ao normal
  for (const s of p.robberies) {
    if (s.mode === 'boosted' && (s.boostUntil ?? 0) <= t) { s.mode = 'normal'; s.boostUntil = undefined; }
  }
  const a = p.alert;
  if (a) {
    if (a.status === 'pending' && t > a.expiresAt) {
      a.status = 'missed';
      const slot = p.robberies[a.slot];
      if (slot) { slot.mode = 'weak'; slot.boostUntil = undefined; }
      events.push({ type: 'alert_missed', jobId: a.jobId });
    }
    return;
  }
  const activeSlot = p.robberies.findIndex(s => s.jobId);
  if (activeSlot < 0 || p.level < RULES.alertMinLevel || isJailed(p, t)) return;
  if (p.nextAlertAt === null) { p.nextAlertAt = t + randomGapMs(p); return; }
  if (t < p.nextAlertAt) return;
  const jobId = p.robberies[activeSlot].jobId!;
  p.alert = {
    id: `${Math.floor(t)}-${activeSlot}`, slot: activeSlot, jobId,
    createdAt: t, expiresAt: t + RULES.alertWindowSec * 1000, status: 'pending', notified: false,
  };
  p.nextAlertAt = null;
  events.push({ type: 'alert', jobId, expiresAt: p.alert.expiresAt });
}

/**
 * Despista a polícia. 'ad' = assistiu o anúncio (volta ao golpe normal).
 * 'vip' = Clube Rockeiro (pula o anúncio e ganha bônus por um tempo).
 */
export function resolveAlert(p: PlayerState, how: 'ad' | 'vip', now: number): GameEvent[] {
  const a = p.alert;
  if (!a) return [];
  const mode: RobberyMode = how === 'vip' ? 'boosted' : 'normal';
  const slot = p.robberies[a.slot];
  if (slot) {
    slot.mode = mode;
    slot.boostUntil = how === 'vip' ? now + RULES.boostMinutes * 60_000 : undefined;
  }
  p.alert = null;
  p.nextAlertAt = now + randomGapMs(p);
  return [{ type: 'alert_resolved', jobId: a.jobId, mode }];
}

function roll(p: PlayerState, [min, max]: [number, number]) {
  const [r, seed] = nextRandom(p.rngSeed);
  p.rngSeed = seed;
  return min + (max - min) * r;
}

// ---------------- drops (peças, planos e raros) ----------------

/** Quantidade sorteada a partir de um valor esperado: parte inteira + chance da fração. */
function count(p: PlayerState, expected: number) {
  const whole = Math.floor(expected);
  const [r, seed] = nextRandom(p.rngSeed); p.rngSeed = seed;
  return whole + (r < expected - whole ? 1 : 0);
}
function rnd(p: PlayerState) { const [r, seed] = nextRandom(p.rngSeed); p.rngSeed = seed; return r; }

/** Entrega um raro numerado. Se a tiragem acabou, vira peças. */
export function giveRare(p: PlayerState, t: number, events: GameEvent[]) {
  for (let tries = 0; tries < 6; tries++) {
    const total = RARE_ITEMS.reduce((s, i) => s + i.rare!.supply, 0);
    let x = rnd(p) * total;
    const item = RARE_ITEMS.find(i => (x -= i.rare!.supply) < 0) ?? RARE_ITEMS[0];
    const serial = allocSerial(item.id, item.rare!.supply);
    if (serial === null) continue;
    p.inventory.rares.push({ uid: `${item.id}#${serial}`, itemId: item.id, serial });
    p.stats.raresFound = (p.stats.raresFound ?? 0) + 1;
    events.push({ type: 'drop', kind: 'rare', id: item.id, qty: 1, serial });
    return;
  }
  const part = PARTS[Math.floor(rnd(p) * PARTS.length)];
  p.inventory.parts[part.id] += 3;
  events.push({ type: 'drop', kind: 'part', id: part.id, qty: 3 });
}

/** Golpe em equipe concluído: cada membro recebe a parte dele (grana suja, XP, peças e chance de raro). */
export function grantTeamReward(p: PlayerState, def: { cash: [number, number]; xp: number; parts: number; rareChance: number }, t: number) {
  const events: GameEvent[] = [];
  const cash = Math.round(roll(p, def.cash) * (isVip(p, t) ? 1.1 : 1));
  p.dirtyCash += cash; p.stats.cashEarned += cash;
  p.stats.biggestHeist = Math.max(p.stats.biggestHeist ?? 0, cash);
  p.stats.teamHeists = (p.stats.teamHeists ?? 0) + 1;
  gainXp(p, def.xp, events);
  const part = PARTS[Math.floor(rnd(p) * PARTS.length)];
  p.inventory.parts[part.id] += def.parts;
  events.push({ type: 'drop', kind: 'part', id: part.id, qty: def.parts });
  if (rnd(p) < def.rareChance) giveRare(p, t, events);
  return { cash, events };
}

/** Sorteia o que caiu num assalto concluído. Proporcional ao tempo do golpe e às estrelas dele. */
function rollDrops(p: PlayerState, job: RobberyJob & { rareChance?: number }, modeMult: number, t: number, events: GameEvent[]) {
  const vip = isVip(p, t) ? DROP_RULES.vipMult : 1;
  const hours = (job.durationSec / 3600) * Math.min(1, modeMult) * vip;
  const parts = count(p, (DROP_RULES.partsPerHourBase + DROP_RULES.partsPerHourPerStar * job.maxStars) * hours);
  if (parts > 0) {
    const part = PARTS[Math.floor(rnd(p) * PARTS.length)];
    p.inventory.parts[part.id] += parts;
    events.push({ type: 'drop', kind: 'part', id: part.id, qty: parts });
  }
  if (job.maxStars >= 3 && !planIds.has(job.id)) {
    const plans = count(p, DROP_RULES.plansPerHourPerStar * (job.maxStars - 2) * hours);
    if (plans > 0) {
      const pool = HEIST_PLANS.filter(h => job.maxStars >= 6 || h.maxStars <= job.maxStars);
      const plan = pool[Math.floor(rnd(p) * pool.length)] ?? HEIST_PLANS[0];
      p.inventory.plans[plan.id] = (p.inventory.plans[plan.id] ?? 0) + plans;
      events.push({ type: 'drop', kind: 'plan', id: plan.id, qty: plans });
    }
  }
  const rareRate = job.rareChance !== undefined ? job.rareChance * vip : (DROP_RULES.raresPerHour[job.maxStars] ?? 0) * hours;
  if (rareRate > 0 && rnd(p) < rareRate) giveRare(p, t, events);
}

/** Avança o estado até `now`. Ganho offline limitado a 8 h (free) ou 16 h (VIP). */
export function advance(p: PlayerState, now: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (now <= p.lastTick) return events;

  // Tempo além do limite offline é descartado (não acumula para sempre).
  const cap = offlineCapMs(p, p.lastTick);
  if (now - p.lastTick > cap) p.lastTick = now - cap;

  const stepMs = RULES.stepSec * 1000;
  let t = p.lastTick;
  while (t < now) {
    const dtMs = Math.min(stepMs, now - t);
    t += dtMs;
    step(p, t, dtMs / 1000, events);
  }
  p.lastTick = now;
  normalizeSlots(p, now);
  for (const [id, until] of Object.entries(p.burned)) if (until <= now) delete p.burned[id];
  if (p.insurance && p.insurance.until <= now) p.insurance = null;
  afterAdvance?.(p, events, now);
  return events;
}

function step(p: PlayerState, t: number, dt: number, events: GameEvent[]) {
  const wasJailed = p.jailedUntil !== null;
  if (wasJailed && !isJailed(p, t)) {
    p.jailedUntil = null;
    events.push({ type: 'released' });
  }
  const jailed = isJailed(p, t);
  const speed = isTurbo(p, t) ? RULES.turboSpeedMult : 1;
  const cm = cashMult(p, t), xm = xpMult(p, t);

  // 1) Renda passiva dos imóveis — roda mesmo preso (a fachada não fecha).
  for (const prop of PROPERTIES) {
    const lvl = p.properties[prop.id] ?? 0;
    if (lvl > 0) earn(p, prop.incomePerSec * lvl * dt * cm);
  }

  // Lavagem: os negócios passam a grana suja para limpa, com uma taxa.
  if (p.dirtyCash > 0) {
    const income = PROPERTIES.reduce((sum, prop) => sum + prop.incomePerSec * (p.properties[prop.id] ?? 0), 0);
    const moved = Math.min(p.dirtyCash, income * LAUNDER.perIncome * dt);
    if (moved > 0) {
      p.dirtyCash -= moved;
      p.cash += moved * (1 - (isVip(p, t) ? LAUNDER.feeVip : LAUNDER.fee));
      p.stats.laundered = (p.stats.laundered ?? 0) + moved;
    }
  }

  // Procurado esfria com o tempo.
  p.heat = Math.max(0, p.heat - RULES.heatDecayPerSec * dt);

  if (jailed) return;

  tickHideout(p, t, dt, events);
  tickAlert(p, t, events);
  if (p.lookBurn && !isLookBurned(p, t)) p.lookBurn = null;
  const lookBurned = isLookBurned(p, t);

  // 2) Assaltos em loop: "loot por tempo".
  for (const slot of p.robberies) {
    if (!slot.jobId || lookBurned) continue; // visual queimado: a gangue não sai até trocar de roupa e carro
    const job = robberyById.get(slot.jobId);
    if (!job) { slot.jobId = null; continue; }
    slot.progressSec += dt * speed * oficinaMult(p);
    while (slot.progressSec >= job.durationSec && !isJailed(p, t)) {
      slot.progressSec -= job.durationSec;
      const mm = robberyModeMult(slot, t); // golpe fraco, normal ou com bônus
      const night = isNight(t);
      const cash = Math.round(roll(p, job.cash) * cm * mm * arsenalMult(p) * (night ? NIGHT.cashMult : 1) * (1 + territoryBonus(p, job.district, t)));
      const xp = Math.max(1, Math.round(job.xp * xm * mm));
      // golpe grande rende grana suja: precisa passar pelos negócios antes de gastar
      const dirty = job.maxStars >= LAUNDER.dirtyFromStars;
      if (dirty) { p.dirtyCash += cash; p.stats.cashEarned += cash; } else earn(p, cash);
      p.stats.biggestHeist = Math.max(p.stats.biggestHeist ?? 0, cash);
      gainXp(p, xp, events);
      p.stats.robberiesDone += 1;
      p.stats.jobCounts[job.id] = (p.stats.jobCounts[job.id] ?? 0) + 1;
      events.push({ type: 'robbery_done', jobId: job.id, cash, xp, ...(dirty ? { dirty: true } : {}) });
      rollDrops(p, job, mm, t, events);
      addHeat(p, job.heat * (night ? NIGHT.heatMult : 1), t, events, job.maxStars);
      if (slot.once) { slot.jobId = null; slot.once = undefined; slot.progressSec = 0; break; }
    }
    if (isJailed(p, t)) slot.progressSec = 0;
  }
  if (isJailed(p, t)) return;

  // 3) Laboratório: consome 1 lote de insumo e entrega produto quando o timer fecha.
  const labSpeed = speed * (1 + RULES.labSpeedPerLevel * p.lab.level);
  for (const line of p.lab.lines) {
    if (!line.drugId) continue;
    const drug = drugById.get(line.drugId)!;
    if (!line.loaded) {
      if (p.supplies[drug.id] <= 0) continue;
      p.supplies[drug.id] -= 1;
      line.loaded = true;
      line.progressSec = 0;
    }
    line.progressSec += dt * labSpeed;
    if (line.progressSec >= drug.refineSec) {
      p.product[drug.id] += drug.batchYield;
      p.stats.batchesDone += 1;
      line.loaded = false;
      line.progressSec = 0;
      events.push({ type: 'batch_done', drugId: drug.id, units: drug.batchYield });
    }
  }

  // 4) Pontos de venda: cada ponto vende 1 unidade a cada N segundos.
  const sellId = p.dealing.drugId;
  if (sellId && p.product[sellId] > 0 && p.dealing.points > 0 && !p.hideout) { // escondido, os pontos também param
    const drug = drugById.get(sellId)!;
    const district = DISTRICTS.find(d => d.id === p.district)!;
    p.dealing.sellProgress += (dt * p.dealing.points) / RULES.sellSecPerUnit;
    const units = Math.min(Math.floor(p.dealing.sellProgress), p.product[sellId]);
    if (units > 0) {
      p.dealing.sellProgress -= units;
      p.product[sellId] -= units;
      const cash = units * drug.basePrice * district.streetPriceMult * cm;
      earn(p, cash);
      gainXp(p, units * Math.ceil(drug.basePrice / 10) * xm, events);
      p.stats.unitsSold += units;
      events.push({ type: 'sold', drugId: sellId, units, cash });
      addHeat(p, units * drug.heatPerUnit, t, events);
    }
  } else {
    p.dealing.sellProgress = 0;
  }
}

export function drugUnlocked(p: PlayerState, id: DrugId) {
  return p.level >= drugById.get(id)!.minLevel;
}
