import { describe, expect, it } from 'vitest';
import {
  BOSSES, RECRUIT, advantage, fighterOf, npcTeam, powerClass, recruitStats, simulateBattle, teamEffect, ROBBERIES, pvpRank, eventBonus,
} from '@gti/shared';
import { advance, newPlayer, addRecruit, setPointSpecs } from '../src/engine/idle';
import { applyAction } from '../src/engine/actions';
import { FileStore } from '../src/store/store';
import { listItem } from '../src/market';
import * as arena from '../src/arena';
import { createCrew, joinCrew } from '../src/social';

const T = Date.parse('2026-11-04T15:00:00Z'); // quarta 12 h BRT (sem evento)
const H = 3600_000;
const job = (id: string) => ROBBERIES.find(r => r.id === id)!;
const setup = (level = 30) => {
  const p = newPlayer(`p${Math.random()}`, 'x', T); p.level = level; p.nextAlertAt = T + 1e12; p.cash = 1e9;
  p.vitals.autoBuy = true; p.vitals.kits = 60; p.vitals.ammo = 3000;
  p.robberies.forEach(r => { r.jobId = null; });
  return p;
};
const strong = (p: ReturnType<typeof setup>, level: number, n = 5, species = 'matador') => {
  for (let i = 0; i < n; i++) addRecruit(p, { speciesId: species, level, ivs: { hp: 31, atk: 31, def: 31, spd: 31 } }, T);
  p.recruits.team = p.recruits.depot.slice(-n).map(r => r.uid);
};

describe('capangas', () => {
  it('escolhe o inicial uma vez só', () => {
    const p = setup(1);
    applyAction(p, { type: 'pickStarter', speciesId: 'motoboy' }, T);
    expect(p.recruits.team).toHaveLength(1);
    expect(p.recruits.depot[0]).toMatchObject({ speciesId: 'motoboy', bound: true });
    expect(() => applyAction(p, { type: 'pickStarter', speciesId: 'camelo' }, T)).toThrow();
  });

  it('assaltos trazem encontros; o recrutamento automático usa convites', () => {
    const p = setup(10);
    applyAction(p, { type: 'pickStarter', speciesId: 'trombadinha' }, T);
    p.recruits.invites.otimo = 200;
    applyAction(p, { type: 'setAutoRecruit', on: true, invite: 'otimo', minRarity: 'comum', onlyNew: false }, T);
    p.robberies[0] = { jobId: 'carro', progressSec: 0 };
    const ev = advance(p, T + 6 * H);
    expect(ev.some(e => e.type === 'encounter')).toBe(true);
    expect(p.recruits.depot.length).toBeGreaterThan(1);
    expect(Object.keys(p.recruits.album).length).toBeGreaterThan(1);
    expect(p.recruits.invites.otimo).toBeLessThan(200);
  });

  it('recrutar na mão dentro da janela; depois dela o encontro some', () => {
    const p = setup(10);
    p.recruits.encounter = { id: 'e', speciesId: 'trombadinha', level: 8, ivs: { hp: 1, atk: 2, def: 3, spd: 4 }, lenda: false, expiresAt: T + 30_000, district: 'periferia' };
    p.recruits.invites.otimo = 50;
    for (let i = 0; i < 20 && p.recruits.encounter; i++) applyAction(p, { type: 'recruit', invite: 'otimo' }, T + 1000);
    expect(p.recruits.depot.some(r => r.speciesId === 'trombadinha')).toBe(true);
    p.recruits.encounter = { id: 'e2', speciesId: 'motoboy', level: 8, ivs: { hp: 1, atk: 2, def: 3, spd: 4 }, lenda: false, expiresAt: T, district: 'periferia' };
    expect(() => applyAction(p, { type: 'recruit', invite: 'otimo' }, T + 1000)).toThrow(/embora/);
  });

  it('sobe de nível com os assaltos e promove no nível certo', () => {
    const p = setup(30);
    addRecruit(p, { speciesId: 'trombadinha', level: 17, ivs: { hp: 10, atk: 10, def: 10, spd: 10 } }, T);
    p.robberies[0] = { jobId: 'joalheria', progressSec: 0 };
    const ev = advance(p, T + 10 * H);
    expect(ev.some(e => e.type === 'promoted')).toBe(true);
    expect(p.recruits.depot[0].speciesId).toBe('atirador');
  });

  it('time forte acelera e paga mais; fraco atrasa', () => {
    const p = setup(30);
    addRecruit(p, { speciesId: 'trombadinha', level: 5, ivs: { hp: 0, atk: 0, def: 0, spd: 0 } }, T);
    const weak = teamEffect(p, job('joalheria'));
    strong(p, 60);
    const good = teamEffect(p, job('joalheria'));
    expect(weak.speed).toBeLessThan(1);
    expect(good.speed).toBeGreaterThan(1.2);
    expect(good.damage).toBeLessThan(weak.damage);
  });

  it('atributos, potência P1 a P5 e Lenda', () => {
    expect(powerClass({ hp: 31, atk: 31, def: 31, spd: 31 })).toBe(5);
    expect(powerClass({ hp: 0, atk: 0, def: 0, spd: 0 })).toBe(1);
    const a = recruitStats({ speciesId: 'matador', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } });
    const b = recruitStats({ speciesId: 'matador', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 }, lenda: true });
    expect(b.atk).toBeGreaterThan(a.atk);
  });

  it('mercado: só nível 50 e P3 (Lenda e P5 em qualquer nível); inicial nunca', () => {
    const s = new FileStore(`/tmp/gti-rec-${Math.random()}.json`);
    const p = setup(30); s.savePlayer(p);
    applyAction(p, { type: 'pickStarter', speciesId: 'camelo' }, T);
    expect(() => listItem(s, p, { kind: 'recruit', uid: p.recruits.depot[0].uid, price: 100 }, T)).toThrow(/primeiro/);
    const low = addRecruit(p, { speciesId: 'motoboy', level: 10, ivs: { hp: 5, atk: 5, def: 5, spd: 5 } }, T);
    expect(() => listItem(s, p, { kind: 'recruit', uid: low.uid, price: 100 }, T)).toThrow(/nível 50/);
    const p5 = addRecruit(p, { speciesId: 'motoboy', level: 10, ivs: { hp: 31, atk: 31, def: 31, spd: 31 } }, T);
    const l = listItem(s, p, { kind: 'recruit', uid: p5.uid, price: 100 }, T);
    expect(l.recruit?.uid).toBe(p5.uid);
  });
});

describe('batalha, chefões, Pontos, PvP e guerra', () => {
  it('simulador: determinístico, vantagem de especialidade conta', () => {
    expect(advantage('pistoleiro', 'brutamonte')).toBe(1.25);
    expect(advantage('brutamonte', 'pistoleiro')).toBe(0.8);
    const A = npcTeam(50, 'pistoleiro', 1), B = npcTeam(50, 'brutamonte', 2);
    const r1 = simulateBattle(A, B, 42), r2 = simulateBattle(A, B, 42);
    expect(r1).toEqual(r2);
    expect(r1.turns.length).toBeGreaterThan(5);
  });

  it('chefão: time fraco perde a ficha; time forte vence e solta equipamento épico+', () => {
    const boss = BOSSES[0];
    const weak = setup(40);
    addRecruit(weak, { speciesId: 'trombadinha', level: 5, ivs: { hp: 0, atk: 0, def: 0, spd: 0 } }, T);
    weak.inventory.plans[boss.id] = 1;
    applyAction(weak, { type: 'startPlan', planId: boss.id }, T);
    let ev = advance(weak, T + 2 * boss.durationSec * 1000);
    expect(ev.find(e => e.type === 'boss_result')).toMatchObject({ won: false });
    const p = setup(40); strong(p, 60);
    p.inventory.plans[boss.id] = 2;
    applyAction(p, { type: 'setAutoBoss', on: true }, T);
    applyAction(p, { type: 'startPlan', planId: boss.id }, T);
    ev = advance(p, T + 2 * boss.durationSec * 1000 + 20_000);
    expect(ev.filter(e => e.type === 'boss_result' && e.won).length).toBe(2);
    expect(p.inventory.rares.some(r => r.rarity === 'epico' || r.rarity === 'lendario')).toBe(true);
  });

  it('Ponto: vence o dono (NPC), ganha bônus na especialidade; PvP mexe na nota', () => {
    const s = new FileStore(`/tmp/gti-arena-${Math.random()}.json`);
    setPointSpecs(arena.pointSpecsFor(s));
    const p = setup(80); s.savePlayer(p); strong(p, 90, 5, 'mestre_cofre');
    const r = arena.challengePoint(s, p, 'arrombador', T);
    expect(r.won).toBe(true);
    expect(arena.pointSpecsFor(s)(p)).toEqual(['arrombador']);
    expect(() => arena.challengePoint(s, p, 'arrombador', T + 1000)).toThrow();
    expect(arena.getReplay(s, r.replayId)?.result.turns.length).toBeGreaterThan(0);
    const before = p.pvp.rating;
    const f = arena.pvpFight(s, p, T);
    expect(p.pvp.rating).not.toBe(before);
    expect(f.replayId).toBeTruthy();
    expect(() => arena.pvpFight(s, p, T + 1000)).toThrow(/Respira/);
    expect(pvpRank(2100, 1).name).toBe('Desafiante');
    expect(pvpRank(2100, 600).name).toBe('Diamante');
    setPointSpecs(() => []);
  });

  it('guerra de bondes às 22 h UTC: pareia, simula, paga quem venceu uma vez por dia', () => {
    const s = new FileStore(`/tmp/gti-war-${Math.random()}.json`);
    const a = setup(30), b = setup(30); s.savePlayer(a); s.savePlayer(b);
    strong(a, 80, 1); strong(b, 10, 1, 'trombadinha');
    createCrew(s, a, 'Bonde A', 'AAA', T); createCrew(s, b, 'Bonde B', 'BBB', T);
    const at22 = Date.parse('2026-11-04T22:05:00Z');
    arena.settleWars(s, at22); arena.settleWars(s, at22 + 1000);
    expect(a.stats.warsWon).toBe(1);
    expect(a.diamondsEarned).toBeGreaterThan(0);
    expect(arena.arenaView(s, a, at22).wars).toHaveLength(1);
    void joinCrew;
  });

  it('eventos globais seguem o relógio de Brasília', () => {
    expect(eventBonus(Date.parse('2026-11-07T15:00:00Z')).drop).toBe(0.5); // sábado
    expect(eventBonus(Date.parse('2026-11-04T23:00:00Z')).xp).toBe(0.5); // quarta 20 h
    expect(eventBonus(T)).toEqual({ xp: 0, drop: 0, cash: 0 });
    expect(fighterOf).toBeTypeOf('function');
    expect(RECRUIT.teamSize).toBe(5);
  });
});
