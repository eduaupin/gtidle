import { describe, expect, it } from 'vitest';
import { RULES, ROBBERIES } from '@gti/shared';
import { advance, migrate, newPlayer, resolveAlert } from '../src/engine/idle';
import { applyAction, applyGrant, canBuyProduct } from '../src/engine/actions';

const T0 = Date.parse('2026-11-01T12:00:00Z');
const H = 3600_000;

describe('motor idle', () => {
  it('assalto em loop gera grana e XP pelo tempo', () => {
    const p = newPlayer('a', 'teste', T0);
    advance(p, T0 + 60_000); // 60 s = 3 carteiras de 20 s
    expect(p.stats.robberiesDone).toBe(3);
    expect(p.cash).toBeGreaterThanOrEqual(50 + 3 * 8);
    expect(p.cash).toBeLessThanOrEqual(50 + 3 * 14);
  });

  it('limite offline: 24 h fora rende o mesmo que 8 h', () => {
    const a = newPlayer('a', 'x', T0); a.rngSeed = 1; a.robberies[0].jobId = null;
    a.properties.lanchonete = 1;
    const b = structuredClone(a);
    advance(a, T0 + 8 * H);
    advance(b, T0 + 24 * H);
    expect(Math.round(b.cash)).toBe(Math.round(a.cash));
  });

  it('procurado em 100 leva à cadeia e para os assaltos', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 30; p.robberies[0] = { jobId: 'joalheria', progressSec: 1795 }; // golpe de 6 estrelas
    p.nextAlertAt = T0 + 999 * H;
    p.heat = 99.5;
    advance(p, T0 + 21_000);
    expect(p.jailedUntil).not.toBeNull();
    expect(p.heat).toBeCloseTo(RULES.heatAfterJail, 0); // já esfriando
    const done = p.stats.robberiesDone;
    advance(p, T0 + 5 * 60_000);
    expect(p.stats.robberiesDone).toBe(done); // preso não rouba
  });

  it('laboratório consome insumo e o ponto vende o produto', () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 5; p.cash = 1000; p.robberies[0].jobId = null;
    applyAction(p, { type: 'buySupply', drugId: 'folha', qty: 2 }, T0);
    applyAction(p, { type: 'setLabLine', line: 0, drugId: 'folha' }, T0);
    applyAction(p, { type: 'setDealingDrug', drugId: 'folha' }, T0);
    advance(p, T0 + 605_000); // 1 lote pronto e o 2º carregado
    expect(p.supplies.folha).toBe(0); // o 2º lote já entrou na linha
    expect(p.stats.unitsSold + p.product.folha).toBe(10);
  });

  it('VIP dá slot extra de assalto e expira sozinho', () => {
    const p = newPlayer('a', 'x', T0);
    applyGrant(p, { vipDays: 1 }, T0);
    expect(p.robberies.length).toBe(2);
    advance(p, T0 + 25 * H);
    expect(p.robberies.length).toBe(1);
  });

  it('não deixa assaltar acima do nível', () => {
    const p = newPlayer('a', 'x', T0);
    const banco = ROBBERIES.find(r => r.id === 'posto')!;
    expect(() => applyAction(p, { type: 'startRobbery', slot: 0, jobId: banco.id }, T0)).toThrow(/nível/);
  });

  it('missões: só resgata quando concluída e avança para a próxima', () => {
    const p = newPlayer('a', 'x', T0);
    expect(() => applyAction(p, { type: 'claimMission' }, T0)).toThrow(/não concluída/);
    advance(p, T0 + 60_000); // 3 carteiras
    const cash = p.cash;
    applyAction(p, { type: 'claimMission' }, T0 + 60_000);
    expect(p.missionIndex).toBe(1);
    expect(p.cash).toBe(cash + 40);
  });

  it('save antigo sem campos novos é migrado', () => {
    const p = newPlayer('a', 'x', T0) as unknown as Record<string, unknown>;
    delete p.missionIndex;
    delete (p.stats as Record<string, unknown>).jobCounts;
    const m = migrate(p as never);
    expect(m.missionIndex).toBe(0);
    expect(m.stats.jobCounts).toEqual({});
  });

  it('Pacote Fundador é compra única e sai da loja depois de 19/11', () => {
    const p = newPlayer('a', 'x', T0);
    expect(canBuyProduct(p, 'founder_pack', T0).id).toBe('founder_pack');
    applyGrant(p, { founder: true }, T0);
    expect(() => canBuyProduct(p, 'founder_pack', T0)).toThrow();
    const q = newPlayer('b', 'y', T0);
    expect(() => canBuyProduct(q, 'founder_pack', Date.parse('2026-11-21T00:00:00Z'))).toThrow(/fora de venda/);
  });
});

describe('alerta "roubo monitorado"', () => {
  const MIN = 60_000;
  const setup = () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 3; p.rngSeed = 7;
    p.robberies[0].jobId = 'banca';
    p.heat = 0;
    return p;
  };

  it('aparece depois do intervalo sorteado e vence em 2 minutos', () => {
    const p = setup();
    advance(p, T0 + 5_000);
    expect(p.nextAlertAt).not.toBeNull();
    const at = p.nextAlertAt!;
    expect(at - T0).toBeGreaterThanOrEqual(RULES.alertGapMinMinutes * MIN - 5_000);
    expect(at - T0).toBeLessThanOrEqual(RULES.alertGapMaxMinutes * MIN + 5_000);
    const ev = advance(p, at + 5_000);
    expect(p.alert?.status).toBe('pending');
    expect(ev.some(e => e.type === 'alert')).toBe(true);
    advance(p, p.alert!.expiresAt + 5_000);
    expect(p.alert?.status).toBe('missed');
    expect(p.robberies[0].mode).toBe('weak');
  });

  it('golpe fraco rende bem menos; anúncio volta ao normal', () => {
    const p = setup();
    p.robberies[0].mode = 'weak';
    p.alert = { id: '1', slot: 0, jobId: 'banca', createdAt: T0, expiresAt: T0, status: 'missed', notified: true };
    const c0 = p.cash;
    advance(p, T0 + 60_000); // 1 banca
    const weakGain = p.cash - c0;
    expect(weakGain).toBeLessThanOrEqual(Math.round(50 * RULES.weakMult));
    resolveAlert(p, 'ad', T0 + 60_000);
    expect(p.robberies[0].mode).toBe('normal');
    expect(p.alert).toBeNull();
    expect(p.nextAlertAt).not.toBeNull();
  });

  it('VIP despista sem anúncio e ganha bônus que expira', () => {
    const p = setup();
    p.alert = { id: '1', slot: 0, jobId: 'banca', createdAt: T0, expiresAt: T0 + 120_000, status: 'pending', notified: false };
    expect(() => applyAction(p, { type: 'resolveAlertVip' }, T0)).toThrow(/Clube Rockeiro/);
    applyGrant(p, { vipDays: 1 }, T0);
    applyAction(p, { type: 'resolveAlertVip' }, T0);
    expect(p.robberies[0].mode).toBe('boosted');
    p.nextAlertAt = T0 + 999 * MIN; // isola o teste do próximo alerta
    const c0 = p.cash;
    advance(p, T0 + 60_000);
    expect(p.cash - c0).toBeGreaterThanOrEqual(Math.round(30 * RULES.boostMult * RULES.vipCashMult) - 1);
    advance(p, T0 + (RULES.boostMinutes + 1) * MIN);
    expect(p.robberies[0].mode).toBe('normal');
  });
});

describe('barra suja: 3 estrelas e esconderijo', () => {
  const MIN = 60_000;
  const setup = () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 5; p.robberies[0] = { jobId: 'conveniencia', progressSec: 170 }; // teto de 3 estrelas
    p.nextAlertAt = T0 + 999 * MIN; // isola do alerta de monitoramento
    p.heat = 39.5; // esfria 1,2 em 60 s e a loja soma 6: passa de 40 (3 estrelas)
    return p;
  };

  it('avisa ao chegar em 3 estrelas', () => {
    const p = setup();
    const ev = advance(p, T0 + 60_000); // 1 loja: +6 de procurado
    expect(p.heatWarning).not.toBeNull();
    expect(ev.some(e => e.type === 'heat_warning')).toBe(true);
  });

  it('escondido: para de roubar, esfria e só volta depois de 5 min', () => {
    const p = setup();
    advance(p, T0 + 60_000);
    applyAction(p, { type: 'goHideout' }, T0 + 60_000);
    expect(p.robberies[0].jobId).toBeNull();
    expect(p.heatWarning).toBeNull();
    const done = p.stats.robberiesDone;
    advance(p, T0 + 3 * MIN);
    expect(p.stats.robberiesDone).toBe(done);
    expect(() => applyAction(p, { type: 'leaveHideout' }, T0 + 3 * MIN)).toThrow(/Faltam/);
    const ev = advance(p, T0 + 6.2 * MIN);
    expect(ev.some(e => e.type === 'hideout_ready')).toBe(true);
    expect(p.heat).toBeLessThan(15);
    applyAction(p, { type: 'leaveHideout' }, T0 + 6.2 * MIN);
    expect(p.robberies[0].jobId).toBe('conveniencia');
    expect(p.hideout).toBeNull();
  });

  it('Clube Rockeiro: espera menor e volta sozinho', () => {
    const p = setup();
    applyGrant(p, { vipDays: 1 }, T0);
    p.robberies[1].jobId = 'carteira';
    applyAction(p, { type: 'goHideout' }, T0);
    expect(p.hideout!.until - T0).toBe(RULES.hideoutMinutesVip * MIN);
    advance(p, T0 + (RULES.hideoutMinutesVip * MIN) + 10_000);
    expect(p.hideout).toBeNull();
    expect(p.robberies.map(s => s.jobId)).toEqual(['conveniencia', 'carteira']);
  });

  it('quem não volta é trazido de volta sozinho depois de 20 min', () => {
    const p = setup();
    applyAction(p, { type: 'goHideout' }, T0);
    advance(p, T0 + (RULES.hideoutAutoResumeMinutes + 1) * MIN);
    expect(p.hideout).toBeNull();
    expect(p.robberies[0].jobId).toBe('conveniencia');
  });

  it('Rota de fuga tira do esconderijo na hora, por diamantes', () => {
    const p = setup();
    p.diamondsEarned = 10;
    applyAction(p, { type: 'goHideout' }, T0);
    applyAction(p, { type: 'buyDiamondItem', itemId: 'rota_fuga' }, T0 + 30_000);
    expect(p.hideout).toBeNull();
    expect(p.diamondsEarned).toBe(2);
    expect(p.robberies[0].jobId).toBe('conveniencia');
  });
});

describe('visual queimado, evolução e decoração', () => {
  const H = 3600_000;
  const setup = () => {
    const p = newPlayer('a', 'x', T0);
    p.level = 10; p.robberies[0] = { jobId: 'carro', progressSec: 290 }; // teto de 4 estrelas
    p.nextAlertAt = T0 + 999 * H;
    return p;
  };

  it('todo jogador começa com 2 roupas e 2 carros', () => {
    const p = newPlayer('a', 'x', T0);
    expect(p.cosmetics).toEqual(expect.arrayContaining(['skin_padrao', 'skin_regata', 'carro_padrao', 'carro_branco']));
  });

  it('4 estrelas queimam roupa e carro por 8 h e param os assaltos', () => {
    const p = setup();
    p.heat = 59.5;
    const ev = advance(p, T0 + 60_000);
    expect(ev.some(e => e.type === 'look_burned')).toBe(true);
    expect(p.burned.skin_padrao - T0).toBeGreaterThan(7.9 * H);
    const done = p.stats.robberiesDone;
    advance(p, T0 + 10 * 60_000);
    expect(p.stats.robberiesDone).toBe(done);
    expect(() => applyAction(p, { type: 'equip', itemId: 'skin_padrao' }, T0 + 10 * 60_000)).toThrow(/conhece esse visual/);
    applyAction(p, { type: 'equip', itemId: 'skin_regata' }, T0 + 10 * 60_000);
    applyAction(p, { type: 'equip', itemId: 'carro_branco' }, T0 + 10 * 60_000);
    advance(p, T0 + 16 * 60_000);
    expect(p.stats.robberiesDone).toBeGreaterThan(done);
    expect(p.lookBurn).toBeNull();
  });

  it('Clube Rockeiro: visual volta em 4 h', () => {
    const p = setup();
    applyGrant(p, { vipDays: 1 }, T0);
    p.heat = 59.5;
    advance(p, T0 + 60_000);
    const left = p.burned.skin_padrao - (T0 + 60_000);
    expect(left).toBeLessThanOrEqual(4 * H + 5_000);
    expect(left).toBeGreaterThan(3.9 * H);
  });

  it('roupa e carro novos com grana', () => {
    const p = setup();
    p.cash = 10_000;
    applyAction(p, { type: 'buyCosmetic', itemId: 'hatch_rebaixado', pay: 'cash' }, T0);
    expect(p.cosmetics).toContain('hatch_rebaixado');
    expect(p.cash).toBe(7_000);
    expect(() => applyAction(p, { type: 'buyCosmetic', itemId: 'skin_neon', pay: 'cash' }, T0)).toThrow(/grana/);
  });

  it('evolução: preço alto, VIP paga 70% e o arsenal aumenta a grana', () => {
    const p = setup();
    p.cash = 4000;
    applyAction(p, { type: 'buyUpgrade', track: 'arsenal' }, T0);
    expect(p.upgrades.arsenal).toBe(1);
    expect(p.cash).toBe(0);
    const q = setup();
    applyGrant(q, { vipDays: 1 }, T0);
    q.cash = 2800;
    applyAction(q, { type: 'buyUpgrade', track: 'arsenal' }, T0);
    expect(q.cash).toBe(0);
    const r = setup();
    expect(() => { r.level = 3; r.upgrades.arsenal = 1; r.cash = 1e9; applyAction(r, { type: 'buyUpgrade', track: 'arsenal' }, T0); }).toThrow(/nível 8/);
  });

  it('decoração: compra, coloca na sala e não deixa piso vazio', () => {
    const p = setup();
    p.cash = 6000;
    applyAction(p, { type: 'buyDecor', itemId: 'canto_som', pay: 'cash' }, T0);
    expect(p.decor.placed.canto).toBe('canto_som');
    expect(() => applyAction(p, { type: 'buyDecor', itemId: 'canto_fliperama', pay: 'cash' }, T0)).toThrow();
    applyAction(p, { type: 'placeDecor', slot: 'canto', itemId: null }, T0);
    expect(p.decor.placed.canto).toBeUndefined();
    expect(() => applyAction(p, { type: 'placeDecor', slot: 'piso', itemId: null }, T0)).toThrow(/vazios/);
  });
});

describe('procurado de 0 a 6 estrelas', () => {
  it('estrelas seguem as faixas do procurado', async () => {
    const { starsFor } = await import('@gti/shared');
    expect([0, 9, 10, 25, 40, 60, 75, 90, 100].map(starsFor)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 6]);
  });

  it('golpe pequeno só chama policial a pé: carteira nunca passa de 1 estrela', async () => {
    const { starsFor } = await import('@gti/shared');
    const p = newPlayer('a', 'x', T0);
    p.nextAlertAt = T0 + 999 * H;
    p.heat = 20;
    advance(p, T0 + 10 * 60_000);
    expect(starsFor(p.heat)).toBeLessThanOrEqual(1);
    expect(p.heatWarning).toBeNull();
    expect(p.jailedUntil).toBeNull();
  });

  it('golpe pequeno não derruba procurado alto', () => {
    const p = newPlayer('a', 'x', T0);
    p.nextAlertAt = T0 + 999 * H;
    p.heat = 70;
    advance(p, T0 + 20_000);
    expect(p.heat).toBeGreaterThan(69); // só esfriou, não caiu para o teto da carteira
  });

  it('5 estrelas: helicóptero dobra a espera no esconderijo', () => {
    const p = newPlayer('a', 'x', T0);
    p.heat = 80;
    applyAction(p, { type: 'goHideout' }, T0);
    expect(p.hideout!.until - T0).toBe(RULES.hideoutMinutes * RULES.heliHideoutMult * 60_000);
  });
});

describe('joias e armas', () => {
  it('compra com grana, equipa e tira', () => {
    const p = newPlayer('a', 'x', T0);
    p.cash = 20_000;
    expect(p.equipped.jewelry).toBeNull();
    applyAction(p, { type: 'buyCosmetic', itemId: 'acc_oculos', pay: 'cash' }, T0);
    applyAction(p, { type: 'equip', itemId: 'acc_oculos' }, T0);
    expect(p.equipped.jewelry).toBe('acc_oculos');
    applyAction(p, { type: 'equip', itemId: 'acc_oculos' }, T0);
    expect(p.equipped.jewelry).toBeNull();
    applyAction(p, { type: 'buyCosmetic', itemId: 'arma_pistola', pay: 'cash' }, T0);
    applyAction(p, { type: 'equip', itemId: 'arma_pistola' }, T0);
    expect(p.equipped.weapon).toBe('arma_pistola');
  });

  it('save antigo ganha os campos novos', () => {
    const p = newPlayer('a', 'x', T0) as unknown as { equipped: Record<string, unknown> };
    delete p.equipped.jewelry; delete p.equipped.weapon;
    const m = migrate(p as never);
    expect(m.equipped.jewelry).toBeNull();
    expect(m.equipped.weapon).toBeNull();
  });
});

describe('troca de folha de sprites', () => {
  it('save antigo com itens que saíram da loja volta para o visual inicial', () => {
    const p = newPlayer('a', 'x', T0);
    p.cosmetics.push('item_que_nao_existe');
    p.equipped.character = 'skin_que_saiu';
    p.equipped.weapon = 'arma_que_saiu';
    p.decor.owned.push('sofa_oncinha');
    p.decor.placed.sofa = 'sofa_oncinha';
    migrate(p);
    expect(p.cosmetics).not.toContain('item_que_nao_existe');
    expect(p.equipped.character).toBe('skin_padrao');
    expect(p.equipped.weapon).toBeNull();
    expect(p.decor.owned).not.toContain('sofa_oncinha');
    expect(p.decor.placed.sofa).toBeUndefined();
  });

  it('GRÁTIS custa grana e VIP custa diamantes', async () => {
    const { DIAMOND_ITEMS } = await import('@gti/shared');
    for (const i of DIAMOND_ITEMS.filter(x => x.sprite && !x.starter && !x.exclusive && !x.rare)) {
      expect(i.priceDiamonds > 0 || (i.priceCash ?? 0) > 0).toBe(true);
    }
  });
});
