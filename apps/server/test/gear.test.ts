import { describe, expect, it } from 'vitest';
import { GEAR, GEAR_BASES, LAUNDER, RACE, STATS, gearSummary, lawyerCost, raceMaxDistance, raceParams, rollStats, type RareInstance } from '@gti/shared';
import { advance, giveGear, migrate, newPlayer } from '../src/engine/idle';
import { applyAction } from '../src/engine/actions';

const T = Date.parse('2026-11-02T15:00:00Z'); // 12 h em Brasília
const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };
const gear = (itemId: string, stats: RareInstance['stats'], extra: Partial<RareInstance> = {}): RareInstance =>
  ({ uid: `${itemId}-t${Math.random()}`, itemId, serial: 0, rarity: 'epico', stats, wear: 0, ...extra });

describe('equipamento com status', () => {
  it('sorteio respeita raridade: quantidade de status e faixa', () => {
    const base = GEAR_BASES.find(b => b.slot === 'weapon')!;
    const c = rollStats(base, 'comum', seq([0.5]));
    expect(Object.keys(c.stats!)).toHaveLength(1);
    const l = rollStats(base, 'lendario', seq([0.1, 0.9, 0.3, 0.7, 0.2, 0.6, 0.4, 0.8]));
    expect(Object.keys(l.stats!)).toHaveLength(3);
    expect(l.perk).toBeDefined();
    for (const [k, v] of Object.entries(l.stats!)) {
      const def = STATS.find(s => s.id === k)!;
      expect(def.slots).toContain('weapon');
      expect(v).toBeLessThanOrEqual(Math.round(def.base[1] * 3.2));
    }
  });

  it('assaltos soltam equipamento e a mochila tem limite', () => {
    const p = newPlayer('a', 'x', T); p.level = 30; p.nextAlertAt = T + 1e10;
    p.robberies[0] = { jobId: 'joalheria', progressSec: 0 };
    p.heat = 0;
    for (let i = 0; i < 40; i++) { p.heat = 0; p.jailedUntil = null; p.robberies[0].jobId = 'joalheria'; advance(p, T + (i + 1) * 3600_000); }
    expect(p.inventory.rares.length).toBeGreaterThan(0);
    const g = p.inventory.rares.find(r => r.serial === 0)!;
    expect(g.rarity).toBeDefined();
    expect(Object.keys(g.stats!).length).toBeGreaterThan(0);
    const q = newPlayer('b', 'y', T);
    for (let i = 0; i < GEAR.bagMax + 5; i++) giveGear(q, 3, T, []);
    expect(q.inventory.rares).toHaveLength(GEAR.bagMax);
  });

  it('equipar aplica status com teto e conjunto passa do teto', () => {
    const p = newPlayer('a', 'x', T);
    const arma = gear('arma_pistola', { cash: 50 }, { set: 'rua' });
    const joia = gear('acc_oculos', { cash: 40 }, { set: 'rua' });
    p.inventory.rares.push(arma, joia);
    applyAction(p, { type: 'equipGear', uid: arma.uid }, T);
    applyAction(p, { type: 'equipGear', uid: joia.uid }, T);
    expect(p.equipped.weapon).toBe('arma_pistola');
    const s = gearSummary(p);
    expect(s.raw.cash).toBe(90);
    expect(s.stats.cash).toBe(60 + 5); // teto 60 + conjunto de 2 peças
    applyAction(p, { type: 'unequipGear', slot: 'weapon' }, T);
    expect(p.equipped.weapon).toBeNull();
    expect(gearSummary(p).stats.cash).toBe(40);
  });

  it('grana do assalto sobe com o status', () => {
    const run = (cash: number) => {
      const p = newPlayer('a', 'x', T); p.rngSeed = 7; p.nextAlertAt = T + 1e10;
      const g = gear('arma_pistola', { cash });
      p.inventory.rares.push(g);
      applyAction(p, { type: 'equipGear', uid: g.uid }, T);
      advance(p, T + 600_000);
      return p.cash;
    };
    expect(run(50)).toBeGreaterThan(run(0) * 1.3);
  });

  it('desgaste: item gasto rende metade e conserto custa grana', () => {
    const p = newPlayer('a', 'x', T);
    const g = gear('arma_pistola', { cash: 20 }, { wear: 100, rarity: 'raro' });
    p.inventory.rares.push(g);
    applyAction(p, { type: 'equipGear', uid: g.uid }, T);
    expect(gearSummary(p).stats.cash).toBe(10);
    p.cash = 5000;
    applyAction(p, { type: 'repairGear', uid: g.uid }, T);
    expect(p.cash).toBe(3000);
    expect(gearSummary(p).stats.cash).toBe(20);
  });

  it('status de polícia: advogado mais barato, cadeia mais curta, Blindado protege a grana suja', () => {
    const p = newPlayer('a', 'x', T); p.level = 30;
    const before = lawyerCost(p);
    const j = gear('acc_oculos', { lawyer: 50, jail: 50 }, { rarity: 'lendario', perk: 'blindado' });
    p.inventory.rares.push(j);
    applyAction(p, { type: 'equipGear', uid: j.uid }, T);
    expect(lawyerCost(p)).toBe(Math.floor(before * 0.5));
    p.nextAlertAt = T + 1e10; p.dirtyCash = 10_000; p.heat = 99.5;
    p.robberies[0] = { jobId: 'joalheria', progressSec: 1795 };
    advance(p, T + 6000);
    expect(p.jailedUntil).not.toBeNull();
    expect(p.dirtyCash).toBeGreaterThanOrEqual(10_000); // Blindado: nada apreendido
    expect(LAUNDER.confiscate).toBe(0.5);
  });

  it('corrida: carro com status anda mais e o servidor aceita', () => {
    const p = newPlayer('a', 'x', T);
    const c = gear('sedan_amarelo', { accel: 30, topSpeed: 20, armor: 40 });
    p.inventory.rares.push(c);
    applyAction(p, { type: 'equipGear', uid: c.uid }, T);
    const prm = raceParams(p);
    expect(prm.maxSpeed).toBeCloseTo(RACE.maxSpeed * 1.2);
    expect(prm.crashKeep).toBeGreaterThan(RACE.crashKeep);
    expect(raceMaxDistance(30, prm)).toBeGreaterThan(raceMaxDistance(30));
  });

  it('save antigo: raros ganham status e equipamento sumido sai do corpo', () => {
    const p = newPlayer('a', 'x', T);
    p.inventory.rares.push({ uid: 'rare_cinza#7', itemId: 'rare_cinza', serial: 7 });
    p.gearOn = { weapon: 'nao-existe' };
    migrate(p);
    expect(p.inventory.rares[0].rarity).toBe('epico');
    expect(p.gearOn.weapon).toBeUndefined();
  });
});
