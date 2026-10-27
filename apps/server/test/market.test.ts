import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MARKET, RARE_ITEMS } from '@gti/shared';
import { FileStore } from '../src/store/store';
import { advance, giveRare, newPlayer } from '../src/engine/idle';
import { applyAction, applyGrant } from '../src/engine/actions';
import { buyListing, cancelListing, listItem, marketView, sweepExpired } from '../src/market';

const T0 = Date.parse('2026-11-01T12:00:00Z');
const H = 3600_000;
const freshStore = () => new FileStore(join(mkdtempSync(join(tmpdir(), 'gti-')), 'db.json'));

function two() {
  const store = freshStore();
  const seller = newPlayer('s', 'Vendedor', T0);
  const buyer = newPlayer('b', 'Comprador', T0);
  store.savePlayer(seller); store.savePlayer(buyer);
  return { store, seller, buyer };
}

describe('drops dos assaltos', () => {
  it('golpes longos e de mais estrelas dão peças com o tempo', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 30; p.district = 'centro'; p.nextAlertAt = T0 + 999 * H;
    p.robberies[0] = { jobId: 'banco', progressSec: 0 };
    p.vipUntil = T0 + 100 * H; // dois espaços e advogado automático
    p.cash = 1e9;
    advance(p, T0 + 8 * H);
    const parts = Object.values(p.inventory.parts).reduce((a, b) => a + b, 0);
    expect(parts).toBeGreaterThan(5);
  });

  it('raro sai com número de série único e acaba quando a tiragem acaba', () => {
    const p = newPlayer('a', 'x', T0);
    const ev: never[] = [];
    for (let i = 0; i < 30; i++) giveRare(p, T0, ev);
    const uids = new Set(p.inventory.rares.map(r => r.uid));
    expect(uids.size).toBe(p.inventory.rares.length);
    for (const r of p.inventory.rares) expect(r.serial).toBeGreaterThan(0);
  });

  it('plano de golpe roda uma vez e libera o espaço', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 15; p.nextAlertAt = T0 + 999 * H; p.robberies[0].jobId = null;
    p.inventory.plans.plano_carroforte = 1;
    applyAction(p, { type: 'startPlan', planId: 'plano_carroforte' }, T0);
    expect(p.robberies[0].once).toBe(true);
    expect(p.inventory.plans.plano_carroforte).toBeUndefined();
    const cash = p.cash + p.dirtyCash;
    advance(p, T0 + 31 * 60_000);
    expect(p.cash + p.dirtyCash - cash).toBeGreaterThanOrEqual(15000);
    expect(p.robberies[0].jobId).toBeNull();
  });

  it('parar um plano devolve o plano', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 15; p.robberies[0].jobId = null;
    p.inventory.plans.plano_carroforte = 1;
    applyAction(p, { type: 'startPlan', planId: 'plano_carroforte' }, T0);
    applyAction(p, { type: 'stopRobbery', slot: 0 }, T0 + 1000);
    expect(p.inventory.plans.plano_carroforte).toBe(1);
  });

  it('níveis 4 a 8 da evolução pedem peças', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 20; p.cash = 1e9; p.upgrades.arsenal = 3;
    expect(() => applyAction(p, { type: 'buyUpgrade', track: 'arsenal' }, T0)).toThrow(/peça/);
    p.inventory.parts.peca_arsenal = 4;
    applyAction(p, { type: 'buyUpgrade', track: 'arsenal' }, T0);
    expect(p.upgrades.arsenal).toBe(4);
    expect(p.inventory.parts.peca_arsenal).toBe(0);
  });
});

describe('mercado', () => {
  it('vende peças: item fica em custódia, comprador paga com diamantes comprados, vendedor recebe sem a taxa', () => {
    const { store, seller, buyer } = two();
    seller.inventory.parts.peca_oficina = 10;
    const l = listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 6, price: 100 }, T0);
    expect(seller.inventory.parts.peca_oficina).toBe(4);
    buyer.diamondsPaid = 150;
    buyListing(store, buyer, l.id, T0 + 1000);
    expect(buyer.inventory.parts.peca_oficina).toBe(6);
    expect(buyer.diamondsPaid).toBe(50);
    expect(seller.market.balance).toBe(90); // 10% de taxa
    expect(store.listings()).toHaveLength(0);
    expect(store.sales()).toHaveLength(1);
  });

  it('Clube Rockeiro paga 5% de taxa e tem 10 vagas', () => {
    const { store, seller, buyer } = two();
    applyGrant(seller, { vipDays: 30 }, T0);
    seller.inventory.parts.peca_arsenal = 100;
    for (let i = 0; i < MARKET.slotsVip; i++) listItem(store, seller, { kind: 'part', itemId: 'peca_arsenal', qty: 1, price: 100 }, T0);
    expect(() => listItem(store, seller, { kind: 'part', itemId: 'peca_arsenal', qty: 1, price: 100 }, T0)).toThrow(/vagas/);
    buyer.diamondsPaid = 100;
    buyListing(store, buyer, store.listings()[0].id, T0);
    expect(seller.market.balance).toBe(95);
  });

  it('quem não é VIP tem 3 vagas', () => {
    const { store, seller } = two();
    seller.inventory.parts.peca_arsenal = 10;
    for (let i = 0; i < MARKET.slotsFree; i++) listItem(store, seller, { kind: 'part', itemId: 'peca_arsenal', qty: 1, price: 10 }, T0);
    expect(() => listItem(store, seller, { kind: 'part', itemId: 'peca_arsenal', qty: 1, price: 10 }, T0)).toThrow(/anúncio/);
    seller.market.adSlotUntil = T0 + H; // assistiu o anúncio da vaga extra
    listItem(store, seller, { kind: 'part', itemId: 'peca_arsenal', qty: 1, price: 10 }, T0);
  });

  it('diamantes ganhos jogando não compram no mercado', () => {
    const { store, seller, buyer } = two();
    seller.inventory.parts.peca_oficina = 1;
    const l = listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 1, price: 50 }, T0);
    buyer.diamondsEarned = 1000;
    expect(() => buyListing(store, buyer, l.id, T0)).toThrow(/comprados/);
  });

  it('saldo de vendas também compra', () => {
    const { store, seller, buyer } = two();
    seller.inventory.parts.peca_oficina = 1;
    const l = listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 1, price: 50 }, T0);
    buyer.market.balance = 30; buyer.diamondsPaid = 20;
    buyListing(store, buyer, l.id, T0);
    expect(buyer.market.balance).toBe(0);
    expect(buyer.diamondsPaid).toBe(0);
  });

  it('raro vendido troca de dono com o mesmo número de série e sai do visual do vendedor', () => {
    const { store, seller, buyer } = two();
    giveRare(seller, T0, []);
    const rare = seller.inventory.rares[0];
    const item = RARE_ITEMS.find(i => i.id === rare.itemId)!;
    applyAction(seller, { type: 'equip', itemId: rare.itemId }, T0);
    const l = listItem(store, seller, { kind: 'rare', uid: rare.uid, price: 500 }, T0);
    expect(seller.inventory.rares).toHaveLength(0);
    expect(Object.values(seller.equipped)).not.toContain(item.id);
    buyer.diamondsPaid = 500;
    buyListing(store, buyer, l.id, T0);
    expect(buyer.inventory.rares[0].serial).toBe(rare.serial);
    applyAction(buyer, { type: 'equip', itemId: rare.itemId }, T0);
  });

  it('cancelar e vencer devolvem o item', () => {
    const { store, seller } = two();
    seller.inventory.plans.plano_cofre = 2;
    const a = listItem(store, seller, { kind: 'plan', itemId: 'plano_cofre', qty: 1, price: 80 }, T0);
    listItem(store, seller, { kind: 'plan', itemId: 'plano_cofre', qty: 1, price: 80 }, T0);
    expect(seller.inventory.plans.plano_cofre).toBeUndefined();
    cancelListing(store, seller, a.id);
    expect(seller.inventory.plans.plano_cofre).toBe(1);
    sweepExpired(store, T0 + (MARKET.durationHoursFree + 1) * H);
    expect(seller.inventory.plans.plano_cofre).toBe(2);
    expect(store.listings()).toHaveLength(0);
  });

  it('não compra o próprio anúncio e não aceita preço fora da faixa', () => {
    const { store, seller } = two();
    seller.inventory.parts.peca_oficina = 5;
    expect(() => listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 1, price: 1 }, T0)).toThrow(/Preço/);
    const l = listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 1, price: 10 }, T0);
    seller.diamondsPaid = 100;
    expect(() => buyListing(store, seller, l.id, T0)).toThrow(/próprio/);
  });

  it('a vitrine esconde o id do vendedor e mostra o saque desligado', () => {
    const { store, seller, buyer } = two();
    seller.inventory.parts.peca_oficina = 1;
    listItem(store, seller, { kind: 'part', itemId: 'peca_oficina', qty: 1, price: 10 }, T0);
    const v = marketView(store, buyer, T0);
    expect(v.listings[0].sellerId).toBeUndefined();
    expect(v.withdraw.enabled).toBe(false);
  });
});
