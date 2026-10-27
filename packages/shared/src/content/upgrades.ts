// Evolução da gangue: três trilhas compradas com grana do jogo.
// Preço muito alto de propósito (é o grande ralo de dinheiro do jogo); o Clube Rockeiro
// paga menos, mas a diferença é de conveniência, não de poder: todo mundo chega no mesmo topo.
import type { PlayerState, UpgradeTrack } from '../types';

export interface TrackDef {
  id: UpgradeTrack;
  name: string;
  /** O que cada nível faz, em uma frase */
  effect: string;
  /** Nomes dos níveis 1 a 8 */
  tiers: string[];
  baseCost: number;
  growth: number;
  perTier: number;
}

export const UPGRADE_TRACKS: TrackDef[] = [
  { id: 'arsenal', name: 'Arsenal', effect: '+10% de grana em cada assalto', perTier: 0.10, baseCost: 4000, growth: 2.6,
    tiers: ['Canivete', 'Soco-inglês', 'Taco de beisebol', 'Revólver .38', 'Pistola 9 mm', 'Escopeta', 'Submetralhadora', 'Fuzil de assalto'] },
  { id: 'oficina', name: 'Oficina', effect: '+8% de velocidade nos assaltos', perTier: 0.08, baseCost: 5000, growth: 2.6,
    tiers: ['Pneus recapados', 'Escapamento esportivo', 'Suspensão rebaixada', 'Injeção eletrônica', 'Turbo', 'Nitro', 'Câmbio de corrida', 'Motor V8 preparado'] },
  { id: 'equipamento', name: 'Equipamento', effect: '−6% de procurado em cada assalto', perTier: 0.06, baseCost: 3500, growth: 2.6,
    tiers: ['Luvas', 'Touca ninja', 'Rádio da polícia', 'Placas clonadas', 'Bloqueador de sinal', 'Kit hacker', 'Colete', 'Contato na delegacia'] },
];

export const UPGRADE_MAX = 8;
/** Clube Rockeiro paga esta fração do preço */
export const UPGRADE_VIP_DISCOUNT = 0.7;

/** Nível mínimo de Respeito para comprar o nível `tier` (1 a 8) de qualquer trilha */
export const upgradeMinLevel = (tier: number) => 3 + (tier - 1) * 5;

export function upgradeCost(track: UpgradeTrack, tier: number, vip: boolean) {
  const t = UPGRADE_TRACKS.find(x => x.id === track)!;
  const full = Math.round(t.baseCost * Math.pow(t.growth, tier - 1) / 100) * 100;
  return vip ? Math.round(full * UPGRADE_VIP_DISCOUNT / 100) * 100 : full;
}

export const arsenalMult = (p: PlayerState) => 1 + 0.10 * (p.upgrades?.arsenal ?? 0);
export const oficinaMult = (p: PlayerState) => 1 + 0.08 * (p.upgrades?.oficina ?? 0);
export const equipamentoHeatMult = (p: PlayerState) => 1 - 0.06 * (p.upgrades?.equipamento ?? 0);

export const tierName = (track: UpgradeTrack, tier: number) =>
  tier <= 0 ? 'Nada ainda' : UPGRADE_TRACKS.find(x => x.id === track)!.tiers[tier - 1];
