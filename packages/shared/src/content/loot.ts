// Drops dos assaltos e regras do mercado entre jogadores.
// Tudo que cai aqui é negociável. Nada disso sai de anúncio: recompensa de anúncio fica presa à conta
// (política do Google para anúncios recompensados e proteção contra bots).
import type { HeistPlan, PartId, PlayerState, UpgradeTrack } from '../types';

export const PARTS: { id: PartId; name: string; track: UpgradeTrack; icon: string; description: string }[] = [
  { id: 'peca_arsenal', name: 'Peça de Arsenal', track: 'arsenal', icon: 'w_pistol', description: 'Molas, gatilhos e munição. Pedida nos níveis 4 a 8 do Arsenal.' },
  { id: 'peca_oficina', name: 'Peça de Oficina', track: 'oficina', icon: 'i_car', description: 'Turbo, pneu e injeção. Pedida nos níveis 4 a 8 da Oficina.' },
  { id: 'peca_equipamento', name: 'Peça de Equipamento', track: 'equipamento', icon: 'a_vest', description: 'Rádio, luvas e colete. Pedida nos níveis 4 a 8 do Equipamento.' },
];
export const PART_FOR: Record<UpgradeTrack, PartId> = { arsenal: 'peca_arsenal', oficina: 'peca_oficina', equipamento: 'peca_equipamento' };

/** Peças pedidas para chegar a um nível da trilha (os 3 primeiros são só grana). */
export const partsForTier = (tier: number) => (tier >= 4 ? (tier - 3) * 4 : 0);

/** Planos de golpe: caem em golpes de 3 estrelas para cima e rodam uma vez só. */
export const HEIST_PLANS: HeistPlan[] = [
  { id: 'plano_carroforte', planName: 'Plano: Carro-forte', name: 'Carro-forte na avenida', district: 'periferia', minLevel: 12,
    durationSec: 1800, cash: [15000, 25000], xp: 600, heat: 30, maxStars: 5, building: 'banco', rareChance: 0.15,
    description: 'Rota, horário e o motorista comprado. Paga bem e pode render item raro.' },
  { id: 'plano_cofre', planName: 'Plano: Cofre do Porto', name: 'Cofre do Porto', district: 'porto', minLevel: 20,
    durationSec: 3600, cash: [40000, 60000], xp: 1200, heat: 35, maxStars: 6, building: 'banco', rareChance: 0.25,
    description: 'A combinação do cofre da alfândega.' },
  { id: 'plano_iate', planName: 'Plano: Iate do Bilionário', name: 'Iate do bilionário', district: 'marina', minLevel: 35,
    durationSec: 7200, cash: [120000, 180000], xp: 3000, heat: 45, maxStars: 6, building: 'porto', rareChance: 0.4,
    description: 'A tripulação folga no domingo.' },
];

export const DROP_RULES = {
  /** Peças por hora de assalto, por estrela do golpe (mais 0,4 de base) */
  partsPerHourBase: 0.4,
  partsPerHourPerStar: 0.5,
  /** Planos por hora, por estrela acima de 2 */
  plansPerHourPerStar: 0.04,
  /** Raros por hora: só golpes de 5 e 6 estrelas */
  raresPerHour: { 5: 0.015, 6: 0.03 } as Record<number, number>,
  /** Clube Rockeiro: mais chance em tudo */
  vipMult: 1.25,
};

export const MARKET = {
  feeFree: 0.10,
  feeVip: 0.05,
  slotsFree: 3,
  slotsVip: 10,
  /** Vaga extra por assistir anúncio (só para quem não é VIP) */
  adSlotHours: 24,
  durationHoursFree: 48,
  durationHoursVip: 168,
  minPrice: 5,
  maxPrice: 1_000_000,
  maxQty: 500,
  /** Saque em cripto: desligado até ter parceiro autorizado pelo Banco Central e revisão jurídica */
  withdrawEnabled: false,
  withdrawMin: 1000,
  /** Previsão: 1.000 diamantes de saldo = US$ 6 */
  withdrawUsdPer1000: 6,
  holdDaysFree: 7,
  holdDaysVip: 2,
};

export const marketFee = (vip: boolean) => (vip ? MARKET.feeVip : MARKET.feeFree);
export const marketSlots = (p: PlayerState, vip: boolean, now: number) =>
  vip ? MARKET.slotsVip : MARKET.slotsFree + ((p.market?.adSlotUntil ?? 0) > now ? 1 : 0);

export const emptyInventory = () => ({
  parts: { peca_arsenal: 0, peca_oficina: 0, peca_equipamento: 0 } as Record<PartId, number>,
  plans: {} as Record<string, number>,
  rares: [] as PlayerState['inventory']['rares'],
});

/** O jogador tem esse item (cosmético comprado ou raro na mochila)? */
export const ownsItem = (p: PlayerState, itemId: string) =>
  p.cosmetics.includes(itemId) || (p.inventory?.rares ?? []).some(r => r.itemId === itemId);
