// Disputas com os capangas: Pontos (dominar uma especialidade), PvP ranqueado com temporadas
// e a guerra de bondes diária. Todas usam o mesmo simulador de batalha e guardam o replay.
import { randomUUID } from 'node:crypto';
import {
  PVP, POINTS, SPECS, WAR, elo, fighterOf, npcTeam, pvpRank, pvpSeason, recruitScore, recruitStats, simulateBattle, speciesById,
  type BattleResult, type Fighter, type PlayerState, type Recruit, type Spec,
} from '@gti/shared';
import type { Store } from './store/store';
import { addNews, crewOf, inbox, type Crew } from './social';

export class ArenaError extends Error { statusCode = 400; }
const fail = (m: string): never => { throw new ArenaError(m); };

interface PointDoc { holderId: string | null; holderNick: string | null; team: Fighter[]; since: number; defenses: number }
interface Replay { id: string; at: number; kind: 'ponto' | 'pvp' | 'guerra'; title: string; sides: [string, string]; result: BattleResult }
interface WarDoc { settled: string[]; results: { day: string; a: { id: string; name: string; tag: string }; b: { id: string; name: string; tag: string }; winner: 0 | 1; replayId: string }[] }

const points = (s: Store) => s.getDoc<Record<Spec, PointDoc>>('points', () =>
  Object.fromEntries(SPECS.map(x => [x.id, { holderId: null, holderNick: null, team: [], since: 0, defenses: 0 }])) as unknown as Record<Spec, PointDoc>);
const replays = (s: Store) => s.getDoc<Record<string, Replay>>('replays', () => ({}));
const wars = (s: Store) => s.getDoc<WarDoc>('wars', () => ({ settled: [], results: [] }));
const seasons = (s: Store) => s.getDoc<{ settled: string[] }>('pvpSeasons', () => ({ settled: [] }));

const lastPoint = new Map<string, number>();

function saveReplay(s: Store, kind: Replay['kind'], title: string, sides: [string, string], result: BattleResult, now: number) {
  const all = replays(s);
  const id = randomUUID();
  all[id] = { id, at: now, kind, title, sides, result };
  const ids = Object.values(all).sort((a, b) => b.at - a.at).map(r => r.id);
  for (const old of ids.slice(400)) delete all[old];
  s.touch();
  return id;
}
export const getReplay = (s: Store, id: string) => replays(s)[id];

/** Especialidades que o jogador domina (bônus de +25% nos capangas delas) */
export const pointSpecsFor = (s: Store) => (p: PlayerState) =>
  (Object.entries(points(s)) as [Spec, PointDoc][]).filter(([, d]) => d.holderId === p.id).map(([k]) => k);

const team = (p: PlayerState, uids: string[]) =>
  uids.map(u => p.recruits.depot.find(r => r.uid === u)).filter((r): r is Recruit => !!r);
const fighters = (p: PlayerState, rs: Recruit[], s: Store) => {
  const specs = pointSpecsFor(s)(p);
  return rs.map(r => fighterOf(r, specs));
};
const seedOf = () => Math.floor(Math.random() * 2 ** 31);

// ---------------- Pontos ----------------
export function challengePoint(s: Store, p: PlayerState, spec: Spec, now: number) {
  if (!SPECS.some(x => x.id === spec)) fail('Ponto não existe');
  if (p.level < POINTS.minLevel) fail(`Os Pontos abrem no nível ${POINTS.minLevel}`);
  const key = `${p.id}:${spec}`;
  if (now - (lastPoint.get(key) ?? 0) < POINTS.cooldownMin * 60_000) fail(`Espere ${POINTS.cooldownMin} min entre desafios no mesmo Ponto`);
  const d = points(s)[spec];
  if (d.holderId === p.id) fail('Esse Ponto já é seu');
  const mine = team(p, p.recruits.team);
  if (!mine.some(r => speciesById(r.speciesId)?.spec === spec)) fail(`Leve pelo menos um ${SPECS.find(x => x.id === spec)!.name} no time`);
  lastPoint.set(key, now);
  const def = d.holderId ? d.team : npcTeam(70, spec, spec.length * 97);
  const res = simulateBattle(fighters(p, mine, s), def, seedOf());
  const name = POINTS.names[spec];
  const replayId = saveReplay(s, 'ponto', name, [p.nick, d.holderNick ?? 'Dono antigo'], res, now);
  if (res.winner === 0) {
    const old = d.holderId ? s.getPlayer(d.holderId) : undefined;
    if (old) { inbox(old, `${p.nick} tomou o ${name} de você.`, now); s.savePlayer(old); }
    // quem defende é o time de quem ganhou, só os capangas da especialidade
    const defenders = mine.filter(r => speciesById(r.speciesId)?.spec === spec);
    Object.assign(d, { holderId: p.id, holderNick: p.nick, team: defenders.map(r => fighterOf(r, [spec])), since: now, defenses: 0 });
    p.stats.pointsHeld = (p.stats.pointsHeld ?? 0) + 1;
    addNews(s, { kind: 'territory', nick: p.nick, text: `${p.nick} agora é o dono do ${name}.` }, now);
  } else if (d.holderId) d.defenses += 1;
  s.touch(); s.savePlayer(p);
  return { won: res.winner === 0, replayId };
}

// ---------------- PvP ----------------
function seasonRoll(p: PlayerState, now: number) {
  const season = pvpSeason(now);
  if (p.pvp.season !== season) {
    // temporada nova: a nota volta para perto do começo
    p.pvp.rating = p.pvp.season ? Math.round((p.pvp.rating + PVP.start) / 2) : PVP.start;
    p.pvp.season = season; p.pvp.wins = 0; p.pvp.losses = 0;
  }
}

export function leaderboard(s: Store, now: number) {
  const season = pvpSeason(now);
  return s.allPlayers().filter(x => x.pvp?.season === season && x.pvp.wins + x.pvp.losses > 0)
    .sort((a, b) => b.pvp.rating - a.pvp.rating);
}

export function pvpFight(s: Store, p: PlayerState, now: number) {
  if (p.level < PVP.minLevel) fail(`O PvP abre no nível ${PVP.minLevel}`);
  if (now - p.pvp.lastAt < PVP.cooldownSec * 1000) fail('Respira: a próxima luta sai em alguns segundos');
  seasonRoll(p, now);
  const mine = team(p, p.recruits.pvpTeam.length ? p.recruits.pvpTeam : p.recruits.team);
  if (!mine.length) fail('Monte o time de PvP (ou o time principal) primeiro');
  p.pvp.lastAt = now;
  const season = pvpSeason(now);
  // adversário de verdade com nota parecida; se não tiver, um time da rua do mesmo nível
  const pool = s.allPlayers().filter(x => x.id !== p.id && x.pvp?.season === season && Math.abs(x.pvp.rating - p.pvp.rating) <= 250
    && (x.recruits?.pvpTeam.length || x.recruits?.team.length));
  const opp = pool.length ? pool[Math.floor(Math.random() * pool.length)] : undefined;
  const oppTeam = opp ? fighters(opp, team(opp, opp.recruits.pvpTeam.length ? opp.recruits.pvpTeam : opp.recruits.team), s) : npcTeam(Math.max(1, Math.round(mine.reduce((t, r) => t + r.level, 0) / mine.length)), null, seedOf(), Math.max(1, mine.length));
  const oppRating = opp?.pvp.rating ?? p.pvp.rating;
  const res = simulateBattle(fighters(p, mine, s), oppTeam, seedOf());
  const won = res.winner === 0;
  const delta = elo(p.pvp.rating, oppRating, won);
  p.pvp.rating = Math.max(0, p.pvp.rating + delta);
  p.pvp.best = Math.max(p.pvp.best ?? PVP.start, p.pvp.rating);
  if (won) { p.pvp.wins += 1; p.stats.pvpWins = (p.stats.pvpWins ?? 0) + 1; } else p.pvp.losses += 1;
  if (opp) {
    opp.pvp.rating = Math.max(0, opp.pvp.rating - delta);
    if (won) opp.pvp.losses += 1; else opp.pvp.wins += 1;
    s.savePlayer(opp);
  }
  const replayId = saveReplay(s, 'pvp', 'Acerto de contas', [p.nick, opp?.nick ?? 'Gangue da rua'], res, now);
  s.savePlayer(p);
  return { won, delta, rating: p.pvp.rating, opponent: opp?.nick ?? 'Gangue da rua', replayId };
}

/** Fim de temporada: prêmio pelo rank (diamantes ganhos, presos à conta) */
export function settleSeasons(s: Store, now: number) {
  // mês anterior em Brasília (um milissegundo antes da meia-noite do dia 1º)
  const prev = pvpSeason(Date.parse(`${pvpSeason(now)}-01T03:00:00Z`) - 1);
  const doc = seasons(s);
  if (doc.settled.includes(prev)) return;
  doc.settled.push(prev);
  const ranked = s.allPlayers().filter(x => x.pvp?.season === prev && x.pvp.wins + x.pvp.losses > 0).sort((a, b) => b.pvp.rating - a.pvp.rating);
  ranked.forEach((x, i) => {
    const rank = pvpRank(x.pvp.rating, i + 1);
    const prize = PVP.seasonRewards[rank.id] ?? 0;
    x.diamondsEarned += prize;
    inbox(x, `Temporada ${prev} encerrada: você ficou ${rank.name} (${i + 1}º) e ganhou ${prize} diamantes.`, now);
    s.savePlayer(x);
  });
  s.touch();
}

export function arenaView(s: Store, p: PlayerState, now: number) {
  seasonRoll(p, now);
  const lb = leaderboard(s, now);
  const pos = lb.findIndex(x => x.id === p.id);
  const pts = points(s);
  const recent = Object.values(replays(s)).filter(r => r.sides.includes(p.nick)).sort((a, b) => b.at - a.at).slice(0, 8)
    .map(r => ({ id: r.id, at: r.at, kind: r.kind, title: r.title, sides: r.sides, winner: r.result.winner }));
  const crew = crewOf(s, p);
  return {
    points: SPECS.map(x => ({
      spec: x.id, name: POINTS.names[x.id], holder: pts[x.id].holderNick, mine: pts[x.id].holderId === p.id,
      since: pts[x.id].since, defenses: pts[x.id].defenses, strength: Math.round(pts[x.id].team.reduce((t, f) => t + f.atk + f.def + f.spd + f.max / 2, 0)),
      cooldownUntil: (lastPoint.get(`${p.id}:${x.id}`) ?? 0) + POINTS.cooldownMin * 60_000,
    })),
    pointMinLevel: POINTS.minLevel,
    pvp: {
      ...p.pvp, minLevel: PVP.minLevel, cooldownSec: PVP.cooldownSec,
      position: pos >= 0 ? pos + 1 : null, rank: pvpRank(p.pvp.rating, pos >= 0 ? pos + 1 : undefined).name,
      top: lb.slice(0, 20).map((x, i) => ({ nick: x.nick, rating: x.pvp.rating, rank: pvpRank(x.pvp.rating, i + 1).name, me: x.id === p.id })),
      season: pvpSeason(now),
    },
    wars: crew ? wars(s).results.filter(w => w.a.id === crew.id || w.b.id === crew.id).slice(-7).reverse() : [],
    recent,
  };
}

// ---------------- guerra de bondes ----------------
/** O melhor capanga de cada membro (até 6) forma o time do bonde */
function crewTeam(s: Store, c: Crew): Fighter[] {
  const out: Fighter[] = [];
  for (const id of c.members) {
    const m = s.getPlayer(id);
    if (!m?.recruits?.depot.length) continue;
    const best = [...m.recruits.depot].sort((a, b) => recruitScore(recruitStats(b)) - recruitScore(recruitStats(a)))[0];
    out.push(fighterOf(best, pointSpecsFor(s)(m)));
  }
  return out.sort((a, b) => b.atk + b.def - (a.atk + a.def)).slice(0, WAR.membersPerSide);
}

export function settleWars(s: Store, now: number) {
  const d = new Date(now);
  if (d.getUTCHours() < WAR.hourUtc) return;
  const day = d.toISOString().slice(0, 10);
  const doc = wars(s);
  if (doc.settled.includes(day)) return;
  doc.settled.push(day);
  if (doc.settled.length > 30) doc.settled.splice(0, doc.settled.length - 30);
  const crews = Object.values(s.getDoc<Record<string, Crew>>('crews', () => ({})))
    .map(c => ({ c, team: crewTeam(s, c) })).filter(x => x.team.length)
    .sort((a, b) => b.team.length - a.team.length || Math.random() - 0.5);
  for (let i = 0; i + 1 < crews.length; i += 2) {
    const A = crews[i], B = crews[i + 1];
    const res = simulateBattle(A.team, B.team, seedOf());
    const replayId = saveReplay(s, 'guerra', `Guerra: ${A.c.tag} x ${B.c.tag}`, [A.c.tag, B.c.tag], res, now);
    const win = res.winner === 0 ? A.c : B.c, lose = res.winner === 0 ? B.c : A.c;
    doc.results.push({ day, a: { id: A.c.id, name: A.c.name, tag: A.c.tag }, b: { id: B.c.id, name: B.c.name, tag: B.c.tag }, winner: res.winner, replayId });
    for (const id of win.members) {
      const m = s.getPlayer(id); if (!m) continue;
      m.diamondsEarned += WAR.winDiamonds; m.stats.warsWon = (m.stats.warsWon ?? 0) + 1;
      inbox(m, `Seu bonde venceu a guerra contra [${lose.tag}]: +${WAR.winDiamonds} diamantes. Veja o replay na aba Arena.`, now);
      s.savePlayer(m);
    }
    for (const id of lose.members) {
      const m = s.getPlayer(id); if (!m) continue;
      inbox(m, `Seu bonde perdeu a guerra contra [${win.tag}]. Amanhã tem revanche às ${WAR.hourUtc} h (UTC).`, now);
      s.savePlayer(m);
    }
    addNews(s, { kind: 'territory', text: `Guerra de bondes: [${win.tag}] venceu [${lose.tag}].` }, now);
  }
  if (doc.results.length > 500) doc.results.splice(0, doc.results.length - 500);
  s.touch();
}
