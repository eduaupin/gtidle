// Ações do jogador. Toda validação acontece aqui, no servidor.
import {
  DIAMOND_ITEMS, DISTRICTS, DRUGS, PROPERTIES, REAL_MONEY_PRODUCTS, ROBBERIES, RULES,
  costAt, dealingPointCost, isJailed, isVip, labUpgradeCost, lawyerCost, totalDiamonds,
  DECOR_ITEMS, HEIST_PLANS, INSURANCE, LAUNDER, TUNING, insuranceCost, PARTS, PART_FOR, STAR_HEAT, UPGRADE_MAX, isLookBurned, ownsItem, partsForTier, burnedUntil, currentMission, missionDone, upgradeCost, upgradeMinLevel,
  type Action, type GameEvent, type Grant, type PlayerState,
} from '@gti/shared';
import { enterHideout, gainXp, leaveHideout, normalizeSlots, resolveAlert } from './idle';

export class GameError extends Error {}
const fail = (msg: string): never => { throw new GameError(msg); };

function spendCash(p: PlayerState, amount: number) {
  if (p.cash < amount) fail('Grana insuficiente');
  p.cash -= amount;
}

/** Gasta primeiro os diamantes ganhos jogando, depois os comprados. */
function spendDiamonds(p: PlayerState, amount: number) {
  if (totalDiamonds(p) < amount) fail('Diamantes insuficientes');
  const fromEarned = Math.min(p.diamondsEarned, amount);
  p.diamondsEarned -= fromEarned;
  p.diamondsPaid -= amount - fromEarned;
}

/** Parar ou trocar um golpe de plano devolve o plano para a mochila. */
function refundPlan(p: PlayerState, slot: { jobId: string | null; once?: boolean }) {
  if (slot.once && slot.jobId) p.inventory.plans[slot.jobId] = (p.inventory.plans[slot.jobId] ?? 0) + 1;
  slot.once = undefined;
}

export function applyAction(p: PlayerState, a: Action, now: number): GameEvent[] | void {
  switch (a.type) {
    case 'startRobbery': {
      const slot = p.robberies[a.slot] ?? fail('Slot inválido');
      const job = ROBBERIES.find(r => r.id === a.jobId) ?? fail('Assalto não existe');
      if (p.level < job.minLevel) fail(`Precisa do nível ${job.minLevel}`);
      if (job.district !== p.district) fail('Esse assalto é em outro distrito');
      if (p.robberies.some((s, i) => i !== a.slot && s.jobId === job.id)) fail('Esse assalto já está rodando');
      refundPlan(p, slot);
      slot.jobId = job.id;
      slot.progressSec = 0;
      return;
    }
    case 'stopRobbery': {
      const slot = p.robberies[a.slot] ?? fail('Slot inválido');
      refundPlan(p, slot);
      slot.jobId = null;
      slot.progressSec = 0;
      return;
    }
    case 'launderNow': {
      const amount = Math.floor(Math.min(p.dirtyCash, Number(a.amount) || 0));
      if (amount < 1) fail('Sem grana suja para lavar');
      p.dirtyCash -= amount;
      p.cash += Math.floor(amount * (1 - LAUNDER.instantFee));
      p.stats.laundered = (p.stats.laundered ?? 0) + amount;
      return [{ type: 'laundered', amount }];
    }
    case 'buyInsurance': {
      if (p.insurance && p.insurance.until > now) fail('Você já tem seguro');
      spendCash(p, insuranceCost(p));
      p.insurance = { until: now + INSURANCE.hours * 3600_000 };
      return;
    }
    case 'buyTuning': {
      const opt = TUNING.find(o => o.id === a.optionId) ?? fail('Peça não existe');
      if (p.tuning.owned.includes(opt.id)) fail('Você já tem essa peça');
      if (a.pay === 'cash') {
        if (!opt.priceCash) fail('Essa peça não se compra com grana');
        spendCash(p, opt.priceCash!);
      } else {
        if (!opt.priceDiamonds) fail('Essa peça não se compra com diamantes');
        spendDiamonds(p, opt.priceDiamonds!);
      }
      p.tuning.owned.push(opt.id);
      (p.tuning.cars[p.equipped.vehicle] ??= {})[opt.slot] = opt.id; // já instala no carro em uso
      return;
    }
    case 'setTuning': {
      const car = (p.tuning.cars[p.equipped.vehicle] ??= {});
      if (a.optionId === null) { delete car[a.slot]; return; }
      const opt = TUNING.find(o => o.id === a.optionId && o.slot === a.slot) ?? fail('Peça não existe');
      if (!p.tuning.owned.includes(opt.id)) fail('Compre a peça primeiro');
      car[a.slot] = opt.id;
      return;
    }
    case 'startPlan': {
      const plan = HEIST_PLANS.find(h => h.id === a.planId) ?? fail('Plano não existe');
      if ((p.inventory.plans[plan.id] ?? 0) < 1) fail('Você não tem esse plano');
      if (p.level < plan.minLevel) fail(`Precisa do nível ${plan.minLevel}`);
      if (isJailed(p, now)) fail('Você está preso');
      if (p.hideout) fail('A gangue está escondida');
      if (isLookBurned(p, now)) fail('Troque o visual queimado antes');
      const slot = p.robberies.find(s => !s.jobId) ?? fail('Libere um espaço de assalto para executar o plano');
      p.inventory.plans[plan.id] -= 1;
      if (!p.inventory.plans[plan.id]) delete p.inventory.plans[plan.id];
      Object.assign(slot, { jobId: plan.id, progressSec: 0, once: true, mode: 'normal', boostUntil: undefined });
      return;
    }
    case 'buySupply': {
      const drug = DRUGS.find(d => d.id === a.drugId) ?? fail('Produto não existe');
      if (p.level < drug.minLevel) fail(`Precisa do nível ${drug.minLevel}`);
      const qty = Math.floor(a.qty);
      if (qty < 1 || qty > 1000) fail('Quantidade inválida');
      spendCash(p, drug.supplyCost * qty);
      p.supplies[drug.id] += qty;
      return;
    }
    case 'setLabLine': {
      const line = p.lab.lines[a.line] ?? fail('Linha inválida');
      if (a.drugId) {
        const drug = DRUGS.find(d => d.id === a.drugId) ?? fail('Produto não existe');
        if (p.level < drug.minLevel) fail(`Precisa do nível ${drug.minLevel}`);
      }
      if (line.loaded && line.drugId) p.supplies[line.drugId] += 1; // devolve o lote não terminado
      line.drugId = a.drugId;
      line.loaded = false;
      line.progressSec = 0;
      return;
    }
    case 'upgradeLab': {
      if (p.lab.level >= RULES.labMaxLevel) fail('Laboratório no máximo');
      spendCash(p, labUpgradeCost(p));
      p.lab.level += 1;
      normalizeSlots(p, now);
      return;
    }
    case 'buyDealingPoint': {
      if (p.dealing.points >= RULES.dealingMaxPoints) fail('Limite de pontos');
      spendCash(p, dealingPointCost(p));
      p.dealing.points += 1;
      return;
    }
    case 'setDealingDrug': {
      p.dealing.drugId = a.drugId;
      p.dealing.sellProgress = 0;
      return;
    }
    case 'buyProperty': {
      const prop = PROPERTIES.find(x => x.id === a.propertyId) ?? fail('Imóvel não existe');
      if (p.level < prop.minLevel) fail(`Precisa do nível ${prop.minLevel}`);
      const lvl = p.properties[prop.id] ?? 0;
      if (lvl >= prop.maxLevel) fail('Imóvel no máximo');
      spendCash(p, costAt(prop.baseCost, lvl));
      p.properties[prop.id] = lvl + 1;
      return;
    }
    case 'payLawyer': {
      if (p.heat < 1 && !isJailed(p, now)) fail('Você não está sendo procurado');
      spendCash(p, lawyerCost(p));
      p.heat = Math.max(0, p.heat - RULES.lawyerHeatReduction);
      p.stats.lawyerUses += 1;
      return;
    }
    case 'travel': {
      const d = DISTRICTS.find(x => x.id === a.district) ?? fail('Distrito não existe');
      if (p.level < d.minLevel) fail(`Precisa do nível ${d.minLevel}`);
      if (isJailed(p, now)) fail('Você está preso');
      p.district = d.id;
      // Assaltos do distrito antigo param ao mudar.
      for (const s of p.robberies) {
        const job = ROBBERIES.find(r => r.id === s.jobId);
        if (job && job.district !== d.id) { s.jobId = null; s.progressSec = 0; }
      }
      return;
    }
    case 'buyDiamondItem': {
      const item = DIAMOND_ITEMS.find(i => i.id === a.itemId) ?? fail('Item não existe');
      if (item.exclusive) fail('Item exclusivo, não está à venda');
      if (item.kind === 'cosmetic' && p.cosmetics.includes(item.id)) fail('Você já tem esse item');
      if (item.id === 'sair_cadeia' && !isJailed(p, now)) fail('Você não está preso');
      if (item.id === 'rota_fuga' && !p.hideout) fail('A gangue não está escondida');
      spendDiamonds(p, item.priceDiamonds);
      if (item.kind === 'cosmetic') p.cosmetics.push(item.id);
      if (item.id === 'sair_cadeia') p.jailedUntil = now;
      if (item.id === 'rota_fuga') return leaveHideout(p, now, false);
      if (item.id === 'turbo_1h') p.turboUntil = Math.max(now, p.turboUntil ?? 0) + 3600_000;
      // troca_nick: o nick novo vem por rota própria (validação de nome) — TODO
      return;
    }
    case 'equip': {
      const item = DIAMOND_ITEMS.find(i => i.id === a.itemId) ?? fail('Item não existe');
      const slot = item.slot;
      if (!slot || !ownsItem(p, item.id)) return fail('Item não equipável');
      const burnt = burnedUntil(p, item.id);
      if (burnt > now) {
        const hhmm = new Date(burnt - 3 * 3600_000).toISOString().slice(11, 16);
        fail(`A polícia conhece esse visual até ${hhmm}`);
      }
      // joia e arma são opcionais: equipar de novo o mesmo item tira
      if ((slot === 'jewelry' || slot === 'weapon') && p.equipped[slot] === item.id) { p.equipped[slot] = null; return; }
      p.equipped[slot] = item.id;
      return;
    }
    case 'claimMission': {
      const m = currentMission(p) ?? fail('Sem missão ativa');
      if (!missionDone(p)) fail('Missão ainda não concluída');
      if (m.reward.cash) p.cash += m.reward.cash;
      if (m.reward.diamonds) p.diamondsEarned += m.reward.diamonds;
      const events: GameEvent[] = [];
      if (m.reward.xp) gainXp(p, m.reward.xp, events);
      p.missionIndex += 1;
      return events;
    }
    case 'resolveAlertVip': {
      if (!p.alert) fail('Não tem polícia de olho agora');
      if (!isVip(p, now)) fail('Despistar sem anúncio é do Clube Rockeiro');
      return resolveAlert(p, 'vip', now);
    }
    case 'buyCosmetic': {
      const item = DIAMOND_ITEMS.find(i => i.id === a.itemId) ?? fail('Item não existe');
      if (item.kind !== 'cosmetic' || item.exclusive) fail('Item não está à venda');
      if (item.rare) fail('Item raro: só cai em golpes grandes ou no mercado');
      if (p.cosmetics.includes(item.id)) fail('Você já tem esse item');
      if (a.pay === 'cash') {
        if (!item.priceCash) fail('Esse item não se compra com grana');
        spendCash(p, item.priceCash!);
      } else {
        if (!item.priceDiamonds) fail('Esse item não se compra com diamantes');
        spendDiamonds(p, item.priceDiamonds);
      }
      p.cosmetics.push(item.id);
      return;
    }
    case 'buyUpgrade': {
      const cur = p.upgrades[a.track] ?? fail('Trilha não existe');
      const tier = cur + 1;
      if (tier > UPGRADE_MAX) fail('Já está no máximo');
      if (p.level < upgradeMinLevel(tier)) fail(`Precisa do nível ${upgradeMinLevel(tier)}`);
      const partId = PART_FOR[a.track], need = partsForTier(tier);
      if (p.inventory.parts[partId] < need) fail(`Precisa de ${need} ${PARTS.find(x => x.id === partId)!.name.toLowerCase()}s (caem nos assaltos ou no mercado)`);
      spendCash(p, upgradeCost(a.track, tier, isVip(p, now)));
      p.inventory.parts[partId] -= need;
      p.upgrades[a.track] = tier;
      return;
    }
    case 'buyDecor': {
      const item = DECOR_ITEMS.find(d => d.id === a.itemId) ?? fail('Item não existe');
      if (p.decor.owned.includes(item.id)) fail('Você já tem esse item');
      if (a.pay === 'cash') {
        if (!item.priceCash) fail('Esse item não se compra com grana');
        spendCash(p, item.priceCash!);
      } else {
        if (!item.priceDiamonds) fail('Esse item não se compra com diamantes');
        spendDiamonds(p, item.priceDiamonds!);
      }
      p.decor.owned.push(item.id);
      p.decor.placed[item.slot] = item.id; // já coloca na sala
      return;
    }
    case 'placeDecor': {
      if (a.itemId === null) {
        if (a.slot === 'piso' || a.slot === 'parede') fail('Piso e parede não ficam vazios');
        delete p.decor.placed[a.slot];
        return;
      }
      const item = DECOR_ITEMS.find(d => d.id === a.itemId) ?? fail('Item não existe');
      if (item.slot !== a.slot) fail('Esse item não vai nesse lugar');
      if (!p.decor.owned.includes(item.id)) fail('Você não tem esse item');
      p.decor.placed[a.slot] = item.id;
      return;
    }
    case 'goHideout': {
      if (isJailed(p, now)) fail('Você está preso');
      if (p.hideout) fail('A gangue já está escondida');
      if (p.heat < STAR_HEAT[1]) fail('Não tem polícia atrás de você agora');
      return enterHideout(p, now);
    }
    case 'leaveHideout': {
      if (!p.hideout) fail('A gangue não está escondida');
      const left = Math.ceil((p.hideout!.until - now) / 1000);
      if (left > 0) fail(`Ainda está quente lá fora. Faltam ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}.`);
      return leaveHideout(p, now, false);
    }
    case 'dismissIntro': {
      p.seenIntro = true;
      return;
    }
    default:
      fail('Ação desconhecida');
  }
}

/** Aplica o que uma compra com dinheiro real entrega. Chamado só pelo webhook de pagamento aprovado. */
export function applyGrant(p: PlayerState, g: Grant, now: number) {
  if (g.vipDays) p.vipUntil = Math.max(now, p.vipUntil ?? 0) + g.vipDays * 86400_000;
  if (g.diamonds) p.diamondsPaid += g.diamonds;
  if (g.cash) p.cash += g.cash;
  for (const c of g.cosmetics ?? []) if (!p.cosmetics.includes(c)) p.cosmetics.push(c);
  if (g.founder) p.flags.founder = true;
  if (g.starterPack) p.flags.starterPack = true;
  if (g.battlePassSeason) p.flags.battlePassSeason = g.battlePassSeason;
  normalizeSlots(p, now);
}

export function canBuyProduct(p: PlayerState, productId: string, now: number) {
  const prod = REAL_MONEY_PRODUCTS.find(x => x.id === productId) ?? fail('Produto não existe');
  if (prod.availableUntil && Date.parse(prod.availableUntil) < now) fail('Produto fora de venda');
  if (prod.id === 'founder_pack' && p.flags.founder) fail('Você já é Fundador');
  if (prod.id === 'starter_pack' && p.flags.starterPack) fail('Compra única já feita');
  return prod;
}
