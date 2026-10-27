// Cidade viva multijogador: bondes, territórios da semana, golpe em equipe, corrida de rua,
// Jornal da Costa Dourada, presentes, ficha criminal, convites e o leilão de raros.
// Tudo fica nos documentos genéricos do Store; as regras de balanceamento estão em @gti/shared (content/city.ts).
import { randomUUID } from 'node:crypto';
import {
  AUCTION, CREW, DIAMOND_ITEMS, DISTRICTS, MARKET, RACE, REFERRAL, TEAM_HEISTS, TEAM_LOBBY_HOURS, TEAM_ROLES, TERRITORY,
  auctionEnd, brDay, brWeek, formatCash, isAuctionWindow, isVip, marketFee, ownsItem, previousWeek, raceMaxDistance,
  raceReward, trophiesOf, type GameEvent, type PlayerState, type RareInstance, type TeamRole,
} from '@gti/shared';
import { gainXp, grantTeamReward, jobById, makeCode } from './engine/idle';
import type { Store } from './store/store';

export class SocialError extends Error { statusCode = 400; }
const fail = (msg: string): never => { throw new SocialError(msg); };

// ---------------- documentos ----------------
export interface Crew { id: string; name: string; tag: string; code: string; ownerId: string; members: string[]; createdAt: number }
/** points[semana][distrito][bonde] */
interface TerritoryDoc { points: Record<string, Record<string, Record<string, number>>>; settled: string[] }
export interface Team {
  id: string; code: string; heistId: string; leaderId: string;
  slots: Record<TeamRole, string | null>;
  createdAt: number; startedAt: number | null; endsAt: number | null;
}
export interface NewsItem { id: string; at: number; kind: 'rare' | 'heist' | 'level' | 'territory' | 'team' | 'race' | 'auction' | 'crew'; text: string; nick?: string }
interface RaceDoc { weeks: Record<string, Record<string, { nick: string; best: number }>> }
export interface Auction {
  id: string; sellerId: string; sellerNick: string; rare: RareInstance;
  start: number; bid: number; bidderId: string | null; bidderNick: string | null; bids: number;
  /** Quanto do lance atual saiu do saldo de mercado e dos diamantes comprados (para devolver certo) */
  hold: { balance: number; paid: number } | null;
  createdAt: number; endsAt: number; settled: boolean;
}

const crews = (s: Store) => s.getDoc<Record<string, Crew>>('crews', () => ({}));
const territory = (s: Store) => s.getDoc<TerritoryDoc>('territory', () => ({ points: {}, settled: [] }));
const teams = (s: Store) => s.getDoc<Record<string, Team>>('teams', () => ({}));
const news = (s: Store) => s.getDoc<NewsItem[]>('news', () => []);
const races = (s: Store) => s.getDoc<RaceDoc>('races', () => ({ weeks: {} }));
const auctions = (s: Store) => s.getDoc<Auction[]>('auctions', () => []);

// ---------------- caixa de entrada e jornal ----------------
export function inbox(p: PlayerState, text: string, now: number) {
  p.inbox.unshift({ id: randomUUID(), at: now, text, read: false });
  if (p.inbox.length > 30) p.inbox.length = 30;
}

export function addNews(s: Store, item: Omit<NewsItem, 'id' | 'at'>, now: number) {
  const list = news(s);
  list.unshift({ id: randomUUID(), at: now, ...item });
  if (list.length > 120) list.length = 120;
  s.touch();
}
export const newsFeed = (s: Store) => news(s).slice(0, 40);

const lastHeadline = new Map<string, number>();
const itemName = (id: string) => DIAMOND_ITEMS.find(i => i.id === id)?.name ?? id;
const districtName = (id: string) => DISTRICTS.find(d => d.id === id)?.name ?? id;
const serialStr = (n: number) => `#${String(n).padStart(4, '0')}`;

// ---------------- bondes ----------------
export function crewOf(s: Store, p: PlayerState) { return p.crewId ? crews(s)[p.crewId] : undefined; }

export function createCrew(s: Store, p: PlayerState, name: unknown, tag: unknown, now: number) {
  if (p.crewId && crews(s)[p.crewId]) fail('Saia do seu bonde antes de criar outro');
  const n = String(name ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, CREW.nameMax);
  const t = String(tag ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (n.length < 3) fail('Nome do bonde: pelo menos 3 letras');
  if (t.length < CREW.tagMin || t.length > CREW.tagMax) fail(`Sigla com ${CREW.tagMin} a ${CREW.tagMax} letras`);
  if (Object.values(crews(s)).some(c => c.tag === t)) fail('Essa sigla já tem dono');
  if (p.cash < CREW.cost) fail(`Fundar um bonde custa ${formatCash(CREW.cost)}`);
  p.cash -= CREW.cost;
  const crew: Crew = { id: randomUUID(), name: n, tag: t, code: makeCode(5), ownerId: p.id, members: [p.id], createdAt: now };
  crews(s)[crew.id] = crew;
  p.crewId = crew.id;
  addNews(s, { kind: 'crew', nick: p.nick, text: `Novo bonde na área: ${n} [${t}], fundado por ${p.nick}.` }, now);
  s.savePlayer(p);
  return crew;
}

export function joinCrew(s: Store, p: PlayerState, code: unknown, now: number) {
  if (p.crewId && crews(s)[p.crewId]) fail('Saia do seu bonde antes de entrar em outro');
  const c = Object.values(crews(s)).find(x => x.code === String(code ?? '').trim().toUpperCase()) ?? fail('Código de bonde não encontrado');
  if (c.members.length >= CREW.maxMembers) fail(`Bonde cheio (${CREW.maxMembers} membros)`);
  c.members.push(p.id);
  p.crewId = c.id;
  for (const id of c.members) {
    const m = s.getPlayer(id);
    if (m && m.id !== p.id) { inbox(m, `${p.nick} entrou no bonde ${c.name}.`, now); s.savePlayer(m); }
  }
  s.savePlayer(p); s.touch();
  return c;
}

export function leaveCrew(s: Store, p: PlayerState) {
  const c = crewOf(s, p);
  p.crewId = null;
  s.savePlayer(p);
  if (!c) return;
  c.members = c.members.filter(id => id !== p.id);
  if (!c.members.length) delete crews(s)[c.id];
  else if (c.ownerId === p.id) c.ownerId = c.members[0];
  s.touch();
}

// ---------------- territórios ----------------
/** Dono de cada região: quem fez mais pontos na semana passada. */
export function territoryOwners(s: Store, now: number): Record<string, string> {
  const week = territory(s).points[previousWeek(now)] ?? {};
  const out: Record<string, string> = {};
  for (const [district, byCrew] of Object.entries(week)) {
    const best = Object.entries(byCrew).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0 && crews(s)[best[0]]) out[district] = best[0];
  }
  return out;
}

/** Bônus que o motor aplica nos assaltos: só nas regiões que o bonde do jogador domina. */
export function territoryBonusFor(s: Store) {
  let cache = { week: '', owners: {} as Record<string, string> };
  return (p: PlayerState, district: string, t: number) => {
    if (!p.crewId) return 0;
    const week = brWeek(t);
    if (cache.week !== week) cache = { week, owners: territoryOwners(s, t) };
    return cache.owners[district] === p.crewId ? TERRITORY.cashBonus : 0;
  };
}

/** Virada da semana: anuncia os donos e conta o troféu para os membros (uma vez por semana). */
export function settleTerritories(s: Store, now: number) {
  const doc = territory(s);
  const week = previousWeek(now);
  if (doc.settled.includes(week)) return;
  doc.settled.push(week);
  if (doc.settled.length > 20) doc.settled.splice(0, doc.settled.length - 20);
  for (const k of Object.keys(doc.points)) if (k < previousWeek(now - 21 * 864e5)) delete doc.points[k];
  const owners = territoryOwners(s, now);
  const byCrew = new Map<string, string[]>();
  for (const [d, c] of Object.entries(owners)) byCrew.set(c, [...(byCrew.get(c) ?? []), d]);
  for (const [crewId, ds] of byCrew) {
    const c = crews(s)[crewId];
    const names = ds.map(districtName).join(', ');
    addNews(s, { kind: 'territory', text: `${c.name} [${c.tag}] domina ${names} nesta semana.` }, now);
    for (const id of c.members) {
      const m = s.getPlayer(id);
      if (!m) continue;
      m.stats.territoriesWon = (m.stats.territoriesWon ?? 0) + ds.length;
      inbox(m, `Seu bonde domina ${names} nesta semana: +${Math.round(TERRITORY.cashBonus * 100)}% de grana nos assaltos de lá.`, now);
      s.savePlayer(m);
    }
  }
  s.touch();
}

export function crewView(s: Store, p: PlayerState, now: number) {
  const week = brWeek(now);
  const pts = territory(s).points[week] ?? {};
  const owners = territoryOwners(s, now);
  const tagOf = (id: string) => crews(s)[id]?.tag ?? '?';
  // placar desta semana por região: os 3 primeiros
  const standings = DISTRICTS.map(d => ({
    district: d.id, name: d.name,
    owner: owners[d.id] ? { tag: tagOf(owners[d.id]), mine: owners[d.id] === p.crewId } : null,
    top: Object.entries(pts[d.id] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([id, v]) => ({ tag: tagOf(id), points: Math.floor(v), mine: id === p.crewId })),
  }));
  const c = crewOf(s, p);
  const crew = c && {
    id: c.id, name: c.name, tag: c.tag, code: c.code, owner: c.ownerId === p.id,
    members: c.members.map(id => s.getPlayer(id)).filter(Boolean).map(m => ({
      nick: m!.nick, level: m!.level, code: m!.referral.code, vip: isVip(m!, now), owner: m!.id === c.ownerId,
    })),
    weekPoints: Math.floor(Object.values(pts).reduce((sum, byCrew) => sum + (byCrew[c.id] ?? 0), 0)),
  };
  const ranking = Object.values(crews(s)).map(cr => ({
    name: cr.name, tag: cr.tag, members: cr.members.length,
    points: Math.floor(Object.values(pts).reduce((sum, byCrew) => sum + (byCrew[cr.id] ?? 0), 0)),
    mine: cr.id === p.crewId,
  })).sort((a, b) => b.points - a.points).slice(0, 20);
  return { crew, standings, ranking, week, cost: CREW.cost, maxMembers: CREW.maxMembers, bonus: TERRITORY.cashBonus };
}

// ---------------- gancho do motor ----------------
/** Roda depois de cada avanço do jogador: pontos de território, jornal e prêmio de convite. */
export function onAdvance(s: Store) {
  return (p: PlayerState, events: GameEvent[], now: number) => {
    const week = brWeek(now);
    for (const e of events) {
      if (e.type === 'robbery_done') {
        const job = jobById(e.jobId);
        if (p.crewId && job) {
          const doc = territory(s);
          const byCrew = ((doc.points[week] ??= {})[job.district] ??= {});
          byCrew[p.crewId] = (byCrew[p.crewId] ?? 0) + e.cash * TERRITORY.pointsPerCash;
          s.touch();
        }
        // golpe grande vira manchete (no máximo uma por jogador a cada 30 min)
        if (job && e.cash >= 50_000 && now - (lastHeadline.get(p.id) ?? 0) > 30 * 60_000) {
          lastHeadline.set(p.id, now);
          addNews(s, { kind: 'heist', nick: p.nick, text: `${job.name} em ${districtName(job.district)}: ${p.nick} leva ${formatCash(e.cash)}.` }, now);
        }
      }
      if (e.type === 'drop' && e.kind === 'rare') {
        addNews(s, { kind: 'rare', nick: p.nick, text: `${p.nick} achou ${itemName(e.id)} ${serialStr(e.serial ?? 0)}.` }, now);
      }
      if (e.type === 'level_up' && e.level % 10 === 0) {
        addNews(s, { kind: 'level', nick: p.nick, text: `${p.nick} chegou ao nível ${e.level}.` }, now);
      }
    }
    // convite: quem chamou ganha quando o amigo chega ao nível certo (uma vez)
    if (p.referral.by && !p.referral.paidOut && p.level >= REFERRAL.rewardLevel) {
      p.referral.paidOut = true;
      const inviter = s.getPlayer(p.referral.by);
      if (inviter) {
        inviter.diamondsEarned += REFERRAL.inviterDiamonds;
        inviter.referral.rewarded += 1;
        inbox(inviter, `${p.nick} chegou ao nível ${REFERRAL.rewardLevel} pelo seu convite: +${REFERRAL.inviterDiamonds} diamantes.`, now);
        s.savePlayer(inviter);
      }
    }
  };
}

// ---------------- convites ----------------
export function applyReferral(s: Store, p: PlayerState, code: unknown, now: number) {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return;
  const inviter = s.allPlayers().find(x => x.referral?.code === c);
  if (!inviter || inviter.id === p.id) return;
  p.referral.by = inviter.id;
  p.cash += REFERRAL.newcomerCash;
  p.diamondsEarned += REFERRAL.newcomerDiamonds;
  inbox(p, `Você chegou pelo convite de ${inviter.nick}: +${formatCash(REFERRAL.newcomerCash)} e ${REFERRAL.newcomerDiamonds} diamantes.`, now);
  inbox(inviter, `${p.nick} entrou pelo seu convite. Quando chegar ao nível ${REFERRAL.rewardLevel} você ganha ${REFERRAL.inviterDiamonds} diamantes.`, now);
  s.savePlayer(inviter);
}

export const findByCode = (s: Store, code: string) => {
  const c = code.trim().toUpperCase();
  return s.allPlayers().find(x => x.referral?.code === c);
};

// ---------------- golpe em equipe ----------------
const emptySlots = (): Record<TeamRole, string | null> => ({ motorista: null, hacker: null, arrombador: null, vigia: null });
const teamOf = (s: Store, playerId: string) =>
  Object.values(teams(s)).find(t => Object.values(t.slots).includes(playerId));

export function createTeam(s: Store, p: PlayerState, heistId: unknown, role: unknown, now: number) {
  sweepTeams(s, now);
  const def = TEAM_HEISTS.find(h => h.id === heistId) ?? fail('Golpe não existe');
  if (p.level < def.minLevel) fail(`Precisa do nível ${def.minLevel}`);
  if (teamOf(s, p.id)) fail('Você já está numa equipe');
  const r = (TEAM_ROLES.find(x => x.id === role)?.id ?? fail('Função não existe')) as TeamRole;
  const t: Team = { id: randomUUID(), code: makeCode(5), heistId: def.id, leaderId: p.id, slots: { ...emptySlots(), [r]: p.id }, createdAt: now, startedAt: null, endsAt: null };
  teams(s)[t.id] = t;
  s.touch();
  return t;
}

export function joinTeam(s: Store, p: PlayerState, code: unknown, role: unknown, now: number) {
  sweepTeams(s, now);
  if (teamOf(s, p.id)) fail('Você já está numa equipe');
  const t = Object.values(teams(s)).find(x => x.code === String(code ?? '').trim().toUpperCase()) ?? fail('Código de equipe não encontrado');
  if (t.startedAt) fail('Esse golpe já começou');
  const def = TEAM_HEISTS.find(h => h.id === t.heistId)!;
  if (p.level < def.minLevel) fail(`Precisa do nível ${def.minLevel}`);
  const r = (TEAM_ROLES.find(x => x.id === role)?.id ?? fail('Função não existe')) as TeamRole;
  if (t.slots[r]) fail('Essa função já tem alguém');
  t.slots[r] = p.id;
  if (Object.values(t.slots).every(Boolean)) {
    t.startedAt = now; t.endsAt = now + def.minutes * 60_000;
    for (const id of Object.values(t.slots)) {
      const m = s.getPlayer(id!);
      if (m) { inbox(m, `Equipe completa: ${def.name} começou. Volta em ${def.minutes} min.`, now); s.savePlayer(m); }
    }
  }
  s.touch();
  return t;
}

export function leaveTeam(s: Store, p: PlayerState) {
  const t = teamOf(s, p.id) ?? fail('Você não está numa equipe');
  if (t.startedAt) fail('O golpe já começou: agora é até o fim');
  for (const r of Object.keys(t.slots) as TeamRole[]) if (t.slots[r] === p.id) t.slots[r] = null;
  if (!Object.values(t.slots).some(Boolean)) delete teams(s)[t.id];
  else if (t.leaderId === p.id) t.leaderId = Object.values(t.slots).find(Boolean)!;
  s.touch();
}

/** Paga golpes que terminaram e desfaz equipes que não fecharam a tempo. */
export function sweepTeams(s: Store, now: number) {
  for (const t of Object.values(teams(s))) {
    const def = TEAM_HEISTS.find(h => h.id === t.heistId);
    if (!def) { delete teams(s)[t.id]; continue; }
    if (!t.startedAt && now - t.createdAt > TEAM_LOBBY_HOURS * 3600_000) {
      for (const id of Object.values(t.slots)) {
        const m = id && s.getPlayer(id);
        if (m) { inbox(m, `A equipe do ${def.name} não fechou em ${TEAM_LOBBY_HOURS} h e foi desfeita.`, now); s.savePlayer(m); }
      }
      delete teams(s)[t.id]; s.touch(); continue;
    }
    if (t.endsAt && t.endsAt <= now) {
      const nicks: string[] = [];
      let total = 0;
      for (const [role, id] of Object.entries(t.slots)) {
        const m = id && s.getPlayer(id);
        if (!m) continue;
        const { cash, events } = grantTeamReward(m, def, now);
        total += cash; nicks.push(m.nick);
        const roleName = TEAM_ROLES.find(r => r.id === role)!.name.toLowerCase();
        inbox(m, `${def.name} concluído! Sua parte como ${roleName}: ${formatCash(cash)} em grana suja.`, now);
        for (const e of events) if (e.type === 'drop' && e.kind === 'rare') addNews(s, { kind: 'rare', nick: m.nick, text: `${m.nick} achou ${itemName(e.id)} ${serialStr(e.serial ?? 0)} no ${def.name}.` }, now);
        s.savePlayer(m);
      }
      addNews(s, { kind: 'team', text: `${def.name}: ${nicks.join(', ')} levaram ${formatCash(total)}.` }, now);
      delete teams(s)[t.id]; s.touch();
    }
  }
}

export function teamView(s: Store, p: PlayerState, now: number) {
  sweepTeams(s, now);
  const nick = (id: string | null) => (id ? s.getPlayer(id)?.nick ?? '?' : null);
  const show = (t: Team) => ({
    id: t.id, code: t.code, heistId: t.heistId, leader: nick(t.leaderId), mine: Object.values(t.slots).includes(p.id),
    slots: Object.fromEntries(Object.entries(t.slots).map(([r, id]) => [r, id ? { nick: nick(id), me: id === p.id } : null])),
    createdAt: t.createdAt, startedAt: t.startedAt, endsAt: t.endsAt, expiresAt: t.createdAt + TEAM_LOBBY_HOURS * 3600_000,
  });
  const mine = teamOf(s, p.id);
  // equipes abertas do mesmo bonde aparecem primeiro; depois as de qualquer um
  const crewIds = new Set(crewOf(s, p)?.members ?? []);
  const open = Object.values(teams(s)).filter(t => !t.startedAt && t !== mine)
    .sort((a, b) => Number(crewIds.has(b.leaderId)) - Number(crewIds.has(a.leaderId)) || b.createdAt - a.createdAt)
    .slice(0, 12).map(show);
  return { mine: mine ? show(mine) : null, open };
}

// ---------------- corrida de rua ----------------
const raceSessions = new Map<string, { id: string; startedAt: number; seed: number }>();

export function startRace(p: PlayerState, now: number) {
  const r = { id: randomUUID(), startedAt: now, seed: Math.floor(Math.random() * 2 ** 31) };
  raceSessions.set(p.id, r);
  return { raceId: r.id, seed: r.seed, seconds: RACE.seconds };
}

export function finishRace(s: Store, p: PlayerState, raceId: unknown, distance: unknown, now: number) {
  const r = raceSessions.get(p.id);
  if (!r || r.id !== raceId) fail('Corrida não encontrada');
  raceSessions.delete(p.id);
  const elapsed = (now - r!.startedAt) / 1000;
  if (elapsed < RACE.seconds - 2) fail('Corrida terminou rápido demais');
  const d = Math.floor(Number(distance));
  // teto físico: ninguém anda mais do que acelerando sem bater o tempo todo
  if (!Number.isFinite(d) || d < 0 || d > raceMaxDistance(Math.min(elapsed, RACE.seconds + 5))) fail('Distância impossível');
  const day = brDay(now);
  if (p.race.day !== day) p.race = { day, runs: 0 };
  p.race.runs += 1;
  const rewarded = p.race.runs <= RACE.rewardedRunsPerDay;
  const cash = rewarded ? raceReward(d, p.level) : 0;
  if (cash) { p.cash += cash; p.stats.cashEarned += cash; }
  const events: GameEvent[] = [];
  if (rewarded) gainXp(p, Math.round(d / 20), events);
  p.stats.racesRun = (p.stats.racesRun ?? 0) + 1;
  const prevBest = p.stats.raceBest ?? 0;
  p.stats.raceBest = Math.max(prevBest, d);
  const week = brWeek(now);
  const board = (races(s).weeks[week] ??= {});
  const wasTop = Object.values(board).reduce((m, x) => Math.max(m, x.best), 0);
  const mine = board[p.id];
  if (!mine || d > mine.best) board[p.id] = { nick: p.nick, best: d };
  if (d > wasTop && d >= 800) addNews(s, { kind: 'race', nick: p.nick, text: `Recorde no Autódromo: ${p.nick} fez ${d} m em ${RACE.seconds} s.` }, now);
  for (const k of Object.keys(races(s).weeks)) if (k < brWeek(now - 21 * 864e5)) delete races(s).weeks[k];
  s.touch(); s.savePlayer(p);
  return { distance: d, cash, rewarded, runsLeft: Math.max(0, RACE.rewardedRunsPerDay - p.race.runs), best: p.stats.raceBest, newBest: d > prevBest, events };
}

export function raceBoard(s: Store, p: PlayerState, now: number) {
  const board = races(s).weeks[brWeek(now)] ?? {};
  const top = Object.entries(board).sort((a, b) => b[1].best - a[1].best);
  const rank = top.findIndex(([id]) => id === p.id);
  const day = brDay(now);
  return {
    top: top.slice(0, 10).map(([id, x]) => ({ nick: x.nick, best: x.best, me: id === p.id })),
    myRank: rank >= 0 ? rank + 1 : null,
    runsLeft: Math.max(0, RACE.rewardedRunsPerDay - (p.race.day === day ? p.race.runs : 0)),
    best: p.stats.raceBest ?? 0,
  };
}

// ---------------- presentes ----------------
/** Presente com diamantes: só valem diamantes COMPRADOS (o que vem de anúncio não vira valor para outra conta). */
export function giftCosmetic(s: Store, from: PlayerState, toCode: unknown, itemId: unknown, now: number) {
  const to = findByCode(s, String(toCode ?? '')) ?? s.findPlayerByNick(String(toCode ?? '')) ?? fail('Jogador não encontrado (use o código da ficha dele)');
  if (to.id === from.id) fail('Presente é para os outros');
  const item = DIAMOND_ITEMS.find(i => i.id === itemId) ?? fail('Item não existe');
  if (item.kind !== 'cosmetic' || item.exclusive || item.rare || !item.priceDiamonds) fail('Esse item não pode ser dado de presente');
  if (ownsItem(to, item.id)) fail(`${to.nick} já tem esse item`);
  if (from.diamondsPaid < item.priceDiamonds) fail('Presente só com diamantes comprados (os ganhos jogando ficam na sua conta)');
  from.diamondsPaid -= item.priceDiamonds;
  to.cosmetics.push(item.id);
  from.stats.giftsSent = (from.stats.giftsSent ?? 0) + 1;
  inbox(to, `${from.nick} te deu de presente: ${item.name}!`, now);
  s.savePlayer(to); s.savePlayer(from);
  return { to: to.nick, item: item.name };
}

// ---------------- ficha criminal ----------------
export function profile(s: Store, target: PlayerState, now: number) {
  const c = crewOf(s, target);
  const rares = [...target.inventory.rares].sort((a, b) => a.serial - b.serial).slice(0, 12)
    .map(r => ({ itemId: r.itemId, serial: r.serial, name: itemName(r.itemId) }));
  return {
    nick: target.nick, code: target.referral.code, level: target.level, vip: isVip(target, now), founder: target.flags.founder,
    crew: c ? { name: c.name, tag: c.tag } : null,
    district: target.district,
    since: target.createdAt,
    equipped: target.equipped,
    tuning: target.tuning.cars[target.equipped.vehicle] ?? {},
    trophies: trophiesOf(target),
    rares,
    stats: {
      cashEarned: target.stats.cashEarned, robberies: target.stats.robberiesDone, jailed: target.stats.timesJailed,
      biggestHeist: target.stats.biggestHeist ?? 0, laundered: target.stats.laundered ?? 0, teamHeists: target.stats.teamHeists ?? 0,
      raceBest: target.stats.raceBest ?? 0, territories: target.stats.territoriesWon ?? 0,
      playDays: Math.max(1, Math.ceil((now - target.createdAt) / 864e5)),
    },
  };
}

// ---------------- leilão de raros (fim de semana) ----------------
export function sweepAuctions(s: Store, now: number) {
  for (const a of auctions(s)) {
    if (a.settled || a.endsAt > now) continue;
    a.settled = true;
    const seller = s.getPlayer(a.sellerId);
    const buyer = a.bidderId ? s.getPlayer(a.bidderId) : undefined;
    const name = `${itemName(a.rare.itemId)} ${serialStr(a.rare.serial)}`;
    if (buyer) {
      buyer.inventory.rares.push(a.rare);
      buyer.market.bought += 1;
      inbox(buyer, `Você arrematou ${name} por ${a.bid} diamantes.`, now);
      s.savePlayer(buyer);
      if (seller) {
        seller.market.balance += Math.floor(a.bid * (1 - marketFee(isVip(seller, now))));
        seller.market.sold += 1;
        inbox(seller, `Seu ${name} saiu no leilão por ${a.bid} diamantes.`, now);
      }
      s.addSale({ itemId: a.rare.itemId, kind: 'rare', qty: 1, price: a.bid, at: now });
      addNews(s, { kind: 'auction', nick: buyer.nick, text: `Leilão: ${name} vendido por ${a.bid} diamantes para ${buyer.nick}.` }, now);
    } else if (seller) {
      seller.inventory.rares.push(a.rare);
      inbox(seller, `Ninguém deu lance no ${name}: ele voltou para a sua mochila.`, now);
    }
    if (seller) s.savePlayer(seller);
    s.touch();
  }
  const list = auctions(s);
  const keep = list.filter(a => !a.settled || now - a.endsAt < 7 * 864e5);
  if (keep.length !== list.length) { list.length = 0; list.push(...keep); s.touch(); }
}

export function createAuction(s: Store, p: PlayerState, uid: unknown, start: unknown, now: number, dev: boolean) {
  sweepAuctions(s, now);
  if (!dev && !isAuctionWindow(now)) fail('O leilão abre no sábado e no domingo');
  if (auctions(s).filter(a => !a.settled && a.sellerId === p.id).length >= (isVip(p, now) ? 3 : 1)) fail('Limite de leilões abertos (1, ou 3 no Clube Rockeiro)');
  const price = Math.floor(Number(start));
  if (!Number.isFinite(price) || price < AUCTION.minStart || price > MARKET.maxPrice) fail(`Lance inicial entre ${AUCTION.minStart} e ${MARKET.maxPrice} diamantes`);
  const idx = p.inventory.rares.findIndex(r => r.uid === uid);
  if (idx < 0) fail('Você não tem esse item');
  const [rare] = p.inventory.rares.splice(idx, 1);
  const e = p.equipped;
  if (!ownsItem(p, rare.itemId)) {
    if (e.character === rare.itemId) e.character = 'skin_padrao';
    if (e.vehicle === rare.itemId) e.vehicle = 'carro_padrao';
    if (e.jewelry === rare.itemId) e.jewelry = null;
    if (e.weapon === rare.itemId) e.weapon = null;
  }
  const a: Auction = {
    id: randomUUID(), sellerId: p.id, sellerNick: p.nick, rare, start: price, bid: 0, bidderId: null, bidderNick: null, bids: 0,
    hold: null, createdAt: now, endsAt: auctionEnd(now), settled: false,
  };
  auctions(s).push(a);
  // número baixo é manchete
  if (rare.serial <= 10) addNews(s, { kind: 'auction', nick: p.nick, text: `No leilão: ${itemName(rare.itemId)} ${serialStr(rare.serial)}, lance inicial ${price} diamantes.` }, now);
  s.savePlayer(p); s.touch();
  return a;
}

export const minBid = (a: Auction) => (a.bidderId ? Math.ceil(a.bid * (1 + AUCTION.minIncrement)) : a.start);

/** Lance: o valor fica preso (custódia) e volta para quem foi superado. Só saldo de mercado e diamantes comprados. */
export function bidAuction(s: Store, p: PlayerState, id: unknown, amount: unknown, now: number) {
  sweepAuctions(s, now);
  const a = auctions(s).find(x => x.id === id && !x.settled) ?? fail('Leilão encerrado');
  if (a.sellerId === p.id) fail('Você não pode dar lance no próprio leilão');
  if (a.bidderId === p.id) fail('O maior lance já é seu');
  const bid = Math.floor(Number(amount));
  if (!Number.isFinite(bid) || bid < minBid(a)) fail(`Lance mínimo: ${minBid(a)} diamantes`);
  if (p.market.balance + p.diamondsPaid < bid) fail('No leilão só valem diamantes comprados e saldo de vendas');
  // devolve o lance anterior
  if (a.bidderId && a.hold) {
    const prev = s.getPlayer(a.bidderId);
    if (prev) {
      prev.market.balance += a.hold.balance; prev.diamondsPaid += a.hold.paid;
      inbox(prev, `Seu lance no ${itemName(a.rare.itemId)} ${serialStr(a.rare.serial)} foi superado (${bid} diamantes). Os diamantes voltaram.`, now);
      s.savePlayer(prev);
    }
  }
  const fromBalance = Math.min(p.market.balance, bid);
  p.market.balance -= fromBalance;
  p.diamondsPaid -= bid - fromBalance;
  a.hold = { balance: fromBalance, paid: bid - fromBalance };
  a.bid = bid; a.bidderId = p.id; a.bidderNick = p.nick; a.bids += 1;
  // lance no fim estende (sem "sniper" de último segundo)
  if (a.endsAt - now < AUCTION.extendMinutes * 60_000) a.endsAt = now + AUCTION.extendMinutes * 60_000;
  s.savePlayer(p); s.touch();
  return a;
}

export function auctionView(s: Store, p: PlayerState, now: number) {
  sweepAuctions(s, now);
  const show = (a: Auction) => ({
    id: a.id, seller: a.sellerNick, mineSeller: a.sellerId === p.id, itemId: a.rare.itemId, serial: a.rare.serial, name: itemName(a.rare.itemId),
    start: a.start, bid: a.bid, bidder: a.bidderNick, mineBid: a.bidderId === p.id, bids: a.bids, minBid: minBid(a), endsAt: a.endsAt,
    highlight: a.rare.serial <= 10,
  });
  const open = auctions(s).filter(a => !a.settled)
    .sort((a, b) => Number(b.rare.serial <= 10) - Number(a.rare.serial <= 10) || a.endsAt - b.endsAt).map(show);
  const recent = auctions(s).filter(a => a.settled && a.bidderId).sort((a, b) => b.endsAt - a.endsAt).slice(0, 6).map(show);
  return { open, recent, window: isAuctionWindow(now), nextEnd: auctionEnd(now) };
}
