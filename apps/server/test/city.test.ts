import { describe, expect, it } from 'vitest';
import { LAUNDER, INSURANCE, isNight, brWeek, auctionEnd, raceMaxDistance, trophiesOf, insuranceCost } from '@gti/shared';
import { advance, newPlayer, setTerritoryBonus } from '../src/engine/idle';
import { applyAction } from '../src/engine/actions';

const DAY = Date.parse('2026-11-02T15:00:00Z'); // 12 h em Brasília
const NIGHT = Date.parse('2026-11-02T01:00:00Z'); // 22 h em Brasília

describe('cidade viva', () => {
  it('noite e semana seguem o relógio de Brasília', () => {
    expect(isNight(DAY)).toBe(false);
    expect(isNight(NIGHT)).toBe(true);
    expect(brWeek(Date.parse('2026-11-02T12:00:00Z'))).toBe('2026-W45');
    const end = auctionEnd(DAY);
    expect(new Date(end).toISOString()).toBe('2026-11-09T01:00:00.000Z'); // domingo 22 h BRT
  });

  it('golpe grande rende grana suja que os negócios lavam com taxa', () => {
    const p = newPlayer('a', 'x', DAY);
    p.level = 30; p.nextAlertAt = DAY + 1e9;
    p.robberies[0] = { jobId: 'joalheria', progressSec: 1795 };
    const cash = p.cash;
    advance(p, DAY + 6_000);
    expect(p.dirtyCash).toBeGreaterThan(0);
    expect(p.cash).toBe(cash);
    p.robberies[0].jobId = null;
    const dirty = p.dirtyCash;
    p.properties.lanchonete = 5;
    advance(p, DAY + 3600_000);
    expect(p.dirtyCash).toBeLessThan(dirty);
    const moved = dirty - p.dirtyCash;
    expect(p.stats.laundered).toBeCloseTo(moved, 0);
  });

  it('lavar na hora cobra a taxa maior', () => {
    const p = newPlayer('a', 'x', DAY);
    p.dirtyCash = 1000; p.cash = 0;
    applyAction(p, { type: 'launderNow', amount: 1000 }, DAY);
    expect(p.cash).toBe(1000 * (1 - LAUNDER.instantFee));
    expect(p.dirtyCash).toBe(0);
  });

  it('seguro reduz apreensão e tempo de cadeia', () => {
    const run = (insured: boolean) => {
      const p = newPlayer('a', 'x', DAY);
      p.level = 30; p.nextAlertAt = DAY + 1e9; p.cash = 1e6;
      if (insured) applyAction(p, { type: 'buyInsurance' }, DAY);
      p.dirtyCash = 10000; p.heat = 99.5;
      p.robberies[0] = { jobId: 'joalheria', progressSec: 1795 };
      advance(p, DAY + 6_000);
      return p;
    };
    const a = run(false), b = run(true);
    expect(b.cash).toBeLessThan(1e6); // pagou
    expect(1e6 - b.cash).toBe(insuranceCost(newPlayer('z', 'z', DAY)) * 30 / 1);
    expect(b.dirtyCash).toBeGreaterThan(a.dirtyCash);
    expect(b.jailedUntil! - DAY).toBeLessThan(a.jailedUntil! - DAY);
    expect(b.insurance).toBeNull(); // uso único
    expect(INSURANCE.jailMult).toBe(0.5);
  });

  it('noite paga mais e território soma bônus', () => {
    const run = (t: number, bonus = 0) => {
      setTerritoryBonus(() => bonus);
      const p = newPlayer('a', 'x', t); p.rngSeed = 7; p.nextAlertAt = t + 1e9;
      advance(p, t + 60_000);
      setTerritoryBonus(() => 0);
      return p.cash;
    };
    expect(run(NIGHT)).toBeGreaterThan(run(DAY));
    expect(run(DAY, 0.5)).toBeGreaterThan(run(DAY));
  });

  it('tuning: compra, instala e troca no carro equipado', () => {
    const p = newPlayer('a', 'x', DAY); p.cash = 10000;
    applyAction(p, { type: 'buyTuning', optionId: 'neon_azul', pay: 'cash' }, DAY);
    expect(p.tuning.cars[p.equipped.vehicle].neon).toBe('neon_azul');
    applyAction(p, { type: 'setTuning', slot: 'neon', optionId: null }, DAY);
    expect(p.tuning.cars[p.equipped.vehicle].neon).toBeUndefined();
    expect(() => applyAction(p, { type: 'setTuning', slot: 'paint', optionId: 'pint_ouro' }, DAY)).toThrow();
    expect(() => applyAction(p, { type: 'buyTuning', optionId: 'pint_ouro', pay: 'cash' }, DAY)).toThrow();
  });

  it('corrida tem teto físico e troféus saem dos números', () => {
    expect(raceMaxDistance(30)).toBeGreaterThan(1500);
    expect(raceMaxDistance(30)).toBeLessThan(2200);
    const p = newPlayer('a', 'x', DAY);
    expect(trophiesOf(p)).toEqual([]);
    p.stats.robberiesDone = 1; p.stats.raceBest = 1600;
    expect(trophiesOf(p)).toEqual(['primeiro_corre', 'piloto']);
  });
});
