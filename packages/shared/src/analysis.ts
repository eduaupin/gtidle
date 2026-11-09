// Análise do golpe: quanto um assalto rende e custa por hora para ESTE jogador agora
// (com Clube, equipamento, veículo, time de capangas e eventos). Não conta noite nem território.
import type { PlayerState, RobberyJob } from './types';
import { cashMult, isVip, xpMult } from './formulas';
import { arsenalMult, oficinaMult } from './content/upgrades';
import { GEAR, gearSummary } from './content/gear';
import { DROP_RULES } from './content/loot';
import { SUPPLY, bulletPrice, jobNeeds, kitPrice, isMelee, MELEE } from './content/supply';
import { RECRUIT, teamEffect, type Spec } from './content/recruits';
import { eventBonus } from './content/endgame';
import { DIAMOND_ITEMS } from './content/shop';

export function analyzeJob(p: PlayerState, job: RobberyJob, now: number, points: Spec[] = []) {
  const g = gearSummary(p), gs = g.stats;
  const team = teamEffect(p, job, points);
  const ev = eventBonus(now);
  const vip = isVip(p, now);
  const speed = oficinaMult(p) * (1 + gs.speed / 100) * (1 + g.vehicle.speed / 100) * team.speed;
  const runs = 3600 / (job.durationSec / speed);
  const avg = (job.cash[0] + job.cash[1]) / 2;
  const weapon = p.equipped.weapon ? DIAMOND_ITEMS.find(i => i.id === p.equipped.weapon) : undefined;
  const melee = isMelee(weapon?.weapon?.kind);
  const need = jobNeeds(job, gs.aim, gs.vest);
  const armed = !need.needsGun || (!!weapon && (!melee || job.maxStars <= MELEE.maxStars));
  const gearCash = 1 + (gs.cash + (job.maxStars >= 4 ? gs.intimidate : 0)) / 100;
  const cashRun = avg * cashMult(p, now) * arsenalMult(p) * gearCash * (1 + g.vehicle.cash / 100) * team.cash * (1 + ev.cash) * (melee && need.needsGun ? MELEE.cashMult : 1);
  const xpRun = job.xp * xpMult(p, now) * (1 + gs.xp / 100) * (1 + ev.xp);
  const ammoH = melee ? 0 : need.ammo * runs;
  const dmgH = need.damage * team.damage * runs;
  const kitsH = dmgH / SUPPLY.kitHeal;
  const supplyH = ammoH * bulletPrice(p.level) + kitsH * kitPrice(p.level);
  const hours = (job.durationSec / 3600) * runs; // horas de assalto por hora real
  const luck = (1 + gs.luck / 100) * (vip ? DROP_RULES.vipMult : 1) * (1 + ev.drop);
  return {
    runsPerHour: runs,
    cashPerHour: Math.round(cashRun * runs * (armed ? 1 : SUPPLY.unarmedSuccess)),
    xpPerHour: Math.round(xpRun * runs * (armed ? 1 : SUPPLY.unarmedSuccess)),
    ammoPerHour: Math.round(ammoH),
    damagePerHour: Math.round(dmgH),
    kitsPerHour: Math.round(kitsH * 10) / 10,
    supplyCostPerHour: Math.round(supplyH),
    netPerHour: Math.round(cashRun * runs * (armed ? 1 : SUPPLY.unarmedSuccess) - supplyH),
    gearPerHour: Math.round((GEAR.perHour[job.maxStars] ?? 0) * hours * luck * 100) / 100,
    partsPerHour: Math.round((DROP_RULES.partsPerHourBase + DROP_RULES.partsPerHourPerStar * job.maxStars) * hours * luck * 10) / 10,
    encountersPerHour: Math.round(RECRUIT.encountersPerHour * hours * (1 + ev.drop) * 10) / 10,
    teamRatio: Math.round(team.ratio * 100) / 100,
    armed,
  };
}
