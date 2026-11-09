import { describe, expect, it } from 'vitest';
import { RMT, SUPPLY, VEHICLE_CLASSES, bulletPrice, gearSummary, jobNeeds, kitPrice, merchantValue, ROBBERIES, type RareInstance } from '@gti/shared';
import { advance, newPlayer } from '../src/engine/idle';
import { applyAction } from '../src/engine/actions';
import { FileStore } from '../src/store/store';
import { cancelRmt, completeRmt, listRmt, reserveRmt, rmtView, settleWallet, sweepRmt } from '../src/rmt';

const T = Date.parse('2026-11-02T15:00:00Z');
const H = 3600_000;
const job = (id: string) => ROBBERIES.find(r => r.id === id)!;
const setup = (level = 30) => {
  const p = newPlayer('a', 'x', T); p.level = level; p.nextAlertAt = T + 1e12; p.cash = 1e7;
  return p;
};

describe('vida, munição e kits', () => {
  it('jogador novo começa com revólver preso à conta, munição e kits', () => {
    const p = newPlayer('a', 'x', T);
    expect(p.equipped.weapon).toBe('arma_revolver');
    expect(p.inventory.rares[0]).toMatchObject({ bound: true, rarity: 'comum' });
    expect(p.vitals).toMatchObject({ hp: 100, ammo: 150, kits: 3, down: null });
  });

  it('golpe com arma gasta bala e machuca; carteira não gasta bala', () => {
    const p = setup();
    p.robberies[0] = { jobId: 'joalheria', progressSec: job('joalheria').durationSec - 1 };
    advance(p, T + 5000);
    const need = jobNeeds(job('joalheria'), 3);
    expect(p.vitals.ammo).toBeCloseTo(150 - need.ammo, 3);
    expect(p.vitals.hp).toBeLessThan(100);
    const q = setup(1);
    q.robberies[0] = { jobId: 'carteira', progressSec: 0 };
    advance(q, T + 600_000);
    expect(q.vitals.ammo).toBe(150);
  });

  it('sem bala o golpe quase sempre falha (1%)', () => {
    const p = setup();
    p.vitals.ammo = 0; p.vitals.kits = 60; p.vitals.hp = 100;
    p.robberies[0] = { jobId: 'carro', progressSec: 0 };
    const cash = p.cash;
    let fails = 0, done = 0;
    for (let i = 1; i <= 200; i++) {
      p.heat = 0; p.jailedUntil = null; p.vitals.hp = 100; p.vitals.down = null;
      const ev = advance(p, T + i * job('carro').durationSec * 1000);
      fails += ev.filter(e => e.type === 'robbery_failed').length;
      done += ev.filter(e => e.type === 'robbery_done').length;
    }
    expect(fails).toBeGreaterThan(150);
    expect(done).toBeLessThan(10);
    expect(p.cash - cash).toBeLessThan(5 * 700 * 3);
  });

  it('kit é usado sozinho; sem kit a gangue recua e para de farmar; volta com vida', () => {
    const p = setup();
    p.vitals.kits = 1; p.vitals.ammo = 3000;
    p.robberies[0] = { jobId: 'banco', progressSec: 0 };
    const ev = advance(p, T + 12 * H);
    expect(ev.some(e => e.type === 'kit_used')).toBe(true);
    expect(p.vitals.down).not.toBeNull();
    const done = p.stats.robberiesDone;
    advance(p, T + 20 * H);
    expect(p.stats.robberiesDone).toBe(done); // recolhida: não farma
    expect(p.vitals.hp).toBeGreaterThanOrEqual(SUPPLY.returnHp); // vida voltou no esconderijo
    applyAction(p, { type: 'backToStreet' }, T + 20 * H);
    expect(p.vitals.down).toBeNull();
  });

  it('vida zera: cai e não volta sem vida mínima', () => {
    const p = setup();
    p.vitals.kits = 0; p.vitals.hp = 5; p.vitals.ammo = 3000;
    p.robberies[0] = { jobId: 'banco', progressSec: job('banco').durationSec - 1 };
    advance(p, T + 5000);
    expect(p.vitals.down?.reason).toBe('morto');
    expect(() => applyAction(p, { type: 'backToStreet' }, T + 6000)).toThrow(/vida/);
  });

  it('Mercador: compra só com grana, preço sobe com o nível; compra automática repõe', () => {
    expect(bulletPrice(60)).toBeGreaterThan(bulletPrice(5));
    expect(kitPrice(60)).toBeGreaterThan(kitPrice(5));
    const p = setup(10); p.cash = 1000;
    applyAction(p, { type: 'buyConsumable', item: 'kit', qty: 1 }, T);
    expect(p.cash).toBe(1000 - kitPrice(10));
    expect(() => applyAction(p, { type: 'buyConsumable', item: 'ammo', qty: 3000 }, T)).toThrow(/grana/);
    const q = setup(); q.vitals.ammo = 0; q.vitals.autoBuy = true;
    q.robberies[0] = { jobId: 'joalheria', progressSec: job('joalheria').durationSec - 1 };
    const ev = advance(q, T + 5000);
    expect(ev.some(e => e.type === 'supply_bought')).toBe(true);
    expect(ev.some(e => e.type === 'robbery_done')).toBe(true);
  });

  it('arma branca: sem bala até 3★, não serve para 4★', () => {
    const p = setup();
    p.equipped.weapon = 'arma_taco'; p.gearOn = {}; p.vitals.ammo = 0; p.vitals.kits = 60;
    p.robberies[0] = { jobId: 'posto', progressSec: job('posto').durationSec - 1 };
    let ev = advance(p, T + 5000);
    expect(ev.some(e => e.type === 'robbery_done')).toBe(true);
    p.robberies[0] = { jobId: 'carro', progressSec: job('carro').durationSec - 1 };
    p.rngSeed = 1;
    ev = advance(p, T + 10_000);
    expect(ev.some(e => e.type === 'robbery_failed')).toBe(true);
  });
});

describe('Clube Rockeiro', () => {
  it('reanimação automática: levanta e continua farmando, até 4 por dia', () => {
    const p = setup();
    p.vipUntil = T + 100 * H;
    p.vitals.kits = 0; p.vitals.hp = 30; p.vitals.ammo = 3000;
    p.robberies[0] = { jobId: 'banco', progressSec: 0 };
    p.robberies[1] = { jobId: null, progressSec: 0 };
    const ev = advance(p, T + 8 * H);
    expect(ev.filter(e => e.type === 'revived').length).toBeGreaterThan(0);
    expect(p.stats.robberiesDone).toBeGreaterThan(2);
    const all = advance(p, T + 20 * H);
    const used = p.vitals.revive!.used;
    expect(used).toBeLessThanOrEqual(4);
    expect(all.length).toBeGreaterThanOrEqual(0);
  });
  it('sem Clube não levanta sozinho', () => {
    const p = setup();
    p.vitals.kits = 0; p.vitals.hp = 30; p.vitals.ammo = 3000;
    p.robberies[0] = { jobId: 'banco', progressSec: 0 };
    const ev = advance(p, T + 8 * H);
    expect(ev.some(e => e.type === 'revived')).toBe(false);
    expect(p.vitals.down).not.toBeNull();
  });
});

describe('carros e motos', () => {
  it('classe pela raridade e categoria pelo tipo', () => {
    const p = setup();
    const g: RareInstance = { uid: 'v1', itemId: 'esportivo_vermelho', serial: 0, rarity: 'epico', stats: {} };
    p.inventory.rares.push(g);
    applyAction(p, { type: 'equipGear', uid: 'v1' }, T);
    const v = gearSummary(p).vehicle;
    expect(v.category).toBe('Esportivo');
    expect(v.className).toBe('A');
    expect(v.speed).toBe(8 + VEHICLE_CLASSES.epico.speed);
    expect(v.cash).toBe(5 + VEHICLE_CLASSES.epico.cash);
  });
});

describe('Mercador e RMT', () => {
  it('Mercador compra item na hora; item em uso não', () => {
    const p = setup();
    const g: RareInstance = { uid: 'x1', itemId: 'arma_faca', serial: 0, rarity: 'epico', stats: { cash: 5 } };
    p.inventory.rares.push(g);
    const cash = p.cash;
    applyAction(p, { type: 'sellToMerchant', uid: 'x1' }, T);
    expect(p.cash - cash).toBe(merchantValue(g, p.level));
    expect(() => applyAction(p, { type: 'sellToMerchant', uid: 'inicial-revolver' }, T)).toThrow(/Tire/);
  });

  it('anuncia em reais, reserva, paga, entrega e retém o valor do vendedor', () => {
    const s = new FileStore(`/tmp/gti-rmt-${Math.random()}.json`);
    const seller = setup(); const buyer = newPlayer('b', 'y', T);
    s.savePlayer(seller); s.savePlayer(buyer);
    const g: RareInstance = { uid: 'r1', itemId: 'arma_fuzil', serial: 0, rarity: 'lendario', stats: { cash: 20 } };
    seller.inventory.rares.push(g);
    expect(() => listRmt(s, seller, 'r1', 50, T)).toThrow(/ligue sua conta/);
    seller.accounts = [{ provider: 'discord', method: 'Discord', name: 's', at: T }];
    expect(() => listRmt(s, seller, 'inicial-revolver', 50, T)).toThrow(/preso/);
    const l = listRmt(s, seller, 'r1', 50, T);
    expect(seller.inventory.rares.some(r => r.uid === 'r1')).toBe(false);
    expect(() => reserveRmt(s, buyer, l.id, 'o1', T + 30 * 60_000, T)).toThrow(/ligue sua conta/);
    buyer.accounts = [{ provider: 'firebase', method: 'Google', name: 'b', at: T }];
    reserveRmt(s, buyer, l.id, 'o1', T + 30 * 60_000, T);
    expect(() => cancelRmt(s, seller, l.id, T)).toThrow(/pagando/);
    expect(completeRmt(s, l.id, 'o1', buyer.id, T + 60_000)).toBe(true);
    expect(buyer.inventory.rares.some(r => r.uid === 'r1')).toBe(true);
    expect(seller.rmt.pending[0].amount).toBe(50 * (1 - RMT.fee));
    settleWallet(seller, T + (RMT.holdDays + 1) * 864e5);
    expect(seller.rmt.available).toBe(45);
    expect(rmtView(s, seller, T).wallet.payoutsEnabled).toBe(false);
  });

  it('reserva vence e o anúncio volta; anúncio vencido devolve o item', () => {
    const s = new FileStore(`/tmp/gti-rmt-${Math.random()}.json`);
    const seller = setup(); seller.accounts = [{ provider: 'discord', method: 'Discord', name: 's', at: T }];
    const buyer = newPlayer('b', 'y', T); buyer.accounts = [{ provider: 'discord', method: 'Discord', name: 'b', at: T }];
    s.savePlayer(seller); s.savePlayer(buyer);
    seller.inventory.rares.push({ uid: 'r2', itemId: 'arma_faca', serial: 0, rarity: 'raro', stats: {} });
    const l = listRmt(s, seller, 'r2', 10, T);
    reserveRmt(s, buyer, l.id, 'o2', T + 1000, T);
    sweepRmt(s, T + 2000);
    expect(l.status).toBe('open');
    sweepRmt(s, T + (RMT.listingDays + 1) * 864e5);
    expect(l.status).toBe('expired');
    expect(seller.inventory.rares.some(r => r.uid === 'r2')).toBe(true);
  });
});
