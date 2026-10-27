import { describe, expect, it } from 'vitest';
import { DIAMOND_ITEMS, RARE_ITEMS, REFERRAL, TERRITORY, raceMaxDistance } from '@gti/shared';
import { advance, newPlayer, setAfterAdvance, setSerialAllocator, setTerritoryBonus } from '../src/engine/idle';
import { FileStore } from '../src/store/store';
import * as social from '../src/social';

const T = Date.parse('2026-11-04T15:00:00Z'); // quarta, 12 h BRT
const W = 7 * 864e5;
const mk = () => {
  const s = new FileStore(`/tmp/gti-test-${Math.random()}.json`);
  setSerialAllocator((id, sup) => s.nextSerial(id, sup));
  return s;
};
const player = (s: FileStore, nick: string, level = 1) => {
  const p = newPlayer(nick, nick, T); p.level = level; p.cash = 100_000; p.nextAlertAt = T + 1e10;
  s.savePlayer(p); return p;
};

describe('bondes e territórios', () => {
  it('cria, entra pelo código e soma pontos na região do assalto', () => {
    const s = mk();
    setAfterAdvance(social.onAdvance(s));
    const a = player(s, 'ana'), b = player(s, 'bia');
    const c = social.createCrew(s, a, 'Os Brabos', 'brb', T);
    expect(c.tag).toBe('BRB');
    expect(() => social.createCrew(s, b, 'Outros', 'BRB', T)).toThrow(/sigla/);
    social.joinCrew(s, b, c.code, T);
    expect(b.crewId).toBe(c.id);
    advance(a, T + 60_000); // carteiras na periferia
    const v = social.crewView(s, a, T + 60_000);
    expect(v.crew!.members).toHaveLength(2);
    expect(v.crew!.weekPoints).toBeGreaterThanOrEqual(0);
    const top = v.standings.find(d => d.district === 'periferia')!.top;
    expect(top[0].tag).toBe('BRB');
    setAfterAdvance(null);
  });

  it('quem mais pontuou na semana passada domina e ganha bônus', () => {
    const s = mk();
    setAfterAdvance(social.onAdvance(s));
    const a = player(s, 'ana');
    social.createCrew(s, a, 'Os Brabos', 'BRB', T);
    advance(a, T + 120_000);
    setAfterAdvance(null);
    const next = T + W;
    expect(social.territoryOwners(s, next).periferia).toBe(a.crewId);
    const bonus = social.territoryBonusFor(s);
    expect(bonus(a, 'periferia', next)).toBe(TERRITORY.cashBonus);
    expect(bonus(a, 'centro', next)).toBe(0);
    social.settleTerritories(s, next);
    social.settleTerritories(s, next); // uma vez só
    expect(a.stats.territoriesWon).toBe(1);
    expect(social.newsFeed(s).some(n => n.kind === 'territory')).toBe(true);
    setTerritoryBonus(() => 0);
  });
});

describe('golpe em equipe', () => {
  it('fecha com 4 funções, começa e paga todo mundo em grana suja', () => {
    const s = mk();
    const ps = ['a', 'b', 'c', 'd'].map(n => player(s, n, 12));
    const t = social.createTeam(s, ps[0], 'carro_forte', 'motorista', T);
    expect(() => social.joinTeam(s, ps[1], t.code, 'motorista', T)).toThrow(/função/);
    social.joinTeam(s, ps[1], t.code, 'hacker', T);
    social.joinTeam(s, ps[2], t.code, 'arrombador', T);
    const full = social.joinTeam(s, ps[3], t.code, 'vigia', T);
    expect(full.startedAt).toBe(T);
    expect(() => social.leaveTeam(s, ps[0])).toThrow();
    social.sweepTeams(s, T + 61 * 60_000);
    for (const p of ps) {
      expect(p.dirtyCash).toBeGreaterThanOrEqual(25000);
      expect(p.stats.teamHeists).toBe(1);
      expect(p.inbox[0].text).toMatch(/concluído/);
    }
    expect(social.teamView(s, ps[0], T + 62 * 60_000).mine).toBeNull();
  });

  it('nível baixo não entra e equipe incompleta some em 2 h', () => {
    const s = mk();
    const a = player(s, 'a', 12), low = player(s, 'low', 3);
    const t = social.createTeam(s, a, 'carro_forte', 'hacker', T);
    expect(() => social.joinTeam(s, low, t.code, 'vigia', T)).toThrow(/nível/);
    social.sweepTeams(s, T + 3 * 3600_000);
    expect(social.teamView(s, a, T + 3 * 3600_000).mine).toBeNull();
  });
});

describe('corrida, convite, presente e leilão', () => {
  it('corrida recusa distância impossível e premia as primeiras do dia', () => {
    const s = mk();
    const p = player(s, 'piloto', 5);
    const r = social.startRace(p, T);
    expect(() => social.finishRace(s, p, r.raceId, 900, T + 5000)).toThrow(/rápido/);
    const r2 = social.startRace(p, T);
    expect(() => social.finishRace(s, p, r2.raceId, raceMaxDistance(30) + 50, T + 30_000)).toThrow(/impossível/);
    const r3 = social.startRace(p, T);
    const cash = p.cash;
    const out = social.finishRace(s, p, r3.raceId, 1200, T + 30_500);
    expect(out.cash).toBeGreaterThan(0);
    expect(p.cash).toBe(cash + out.cash);
    expect(social.raceBoard(s, p, T).top[0]).toMatchObject({ nick: 'piloto', best: 1200, me: true });
  });

  it('convite: novato ganha na hora e padrinho no nível 10', () => {
    const s = mk();
    setAfterAdvance(social.onAdvance(s));
    const a = player(s, 'padrinho');
    const n = newPlayer('novo', 'novo', T);
    const cash = n.cash;
    social.applyReferral(s, n, a.referral.code.toLowerCase(), T);
    s.savePlayer(n);
    expect(n.cash).toBe(cash + REFERRAL.newcomerCash);
    const d = a.diamondsEarned;
    n.level = 10;
    advance(n, T + 10_000);
    advance(n, T + 20_000);
    expect(a.diamondsEarned).toBe(d + REFERRAL.inviterDiamonds);
    expect(a.referral.rewarded).toBe(1);
    setAfterAdvance(null);
  });

  it('presente só com diamantes comprados', () => {
    const s = mk();
    const a = player(s, 'a'), b = player(s, 'b');
    a.diamondsEarned = 10_000; a.diamondsPaid = 0;
    const item = DIAMOND_ITEMS.find(i => i.kind === 'cosmetic' && !i.exclusive && !i.rare && (i.priceDiamonds ?? 0) > 0 && !b.cosmetics.includes(i.id))!;
    expect(() => social.giftCosmetic(s, a, b.referral.code, item.id, T)).toThrow(/comprados/);
    a.diamondsPaid = 10_000;
    const out = social.giftCosmetic(s, a, b.referral.code, item.id, T);
    expect(out.to).toBe('b');
    expect(b.cosmetics).toContain(item.id);
    expect(a.diamondsPaid).toBe(10_000 - item.priceDiamonds);
    expect(a.stats.giftsSent).toBe(1);
    expect(() => social.giftCosmetic(s, a, b.referral.code, item.id, T)).toThrow(/já tem/);
  });

  it('leilão: lance prende diamantes, devolve ao superado e entrega no fim', () => {
    const s = mk();
    const seller = player(s, 'vend'), x = player(s, 'x'), y = player(s, 'y');
    const rid = RARE_ITEMS[0].id;
    seller.inventory.rares.push({ uid: `${rid}#3`, itemId: rid, serial: 3 });
    x.diamondsPaid = 500; y.market.balance = 300; y.diamondsPaid = 300;
    const a = social.createAuction(s, seller, `${rid}#3`, 100, T, true);
    expect(seller.inventory.rares).toHaveLength(0);
    social.bidAuction(s, x, a.id, 100, T);
    expect(x.diamondsPaid).toBe(400);
    expect(() => social.bidAuction(s, y, a.id, 101, T)).toThrow(/mínimo/);
    const end0 = a.endsAt;
    social.bidAuction(s, y, a.id, 400, end0 - 60_000); // no fim: estende
    expect(x.diamondsPaid).toBe(500);
    expect(y.market.balance).toBe(0);
    expect(y.diamondsPaid).toBe(200);
    const view = social.auctionView(s, y, end0 - 30_000);
    expect(view.open[0].endsAt).toBe(end0 - 60_000 + 5 * 60_000);
    expect(view.open[0].highlight).toBe(true);
    social.sweepAuctions(s, view.open[0].endsAt + 1);
    expect(y.inventory.rares[0].uid).toBe(`${rid}#3`);
    expect(seller.market.balance).toBe(360); // 10% de taxa
  });
});
