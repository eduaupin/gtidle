// Monta o visual completo da gangue (roupa + joias + arma + carro) a partir dos itens equipados.
import { DIAMOND_ITEMS, TUNING, type DiamondItem, type PlayerState } from '@gti/shared';
import type { CarLook, Outfit } from './draw';

const byId = (id: string | null | undefined) => (id ? DIAMOND_ITEMS.find(i => i.id === id) : undefined);

export function outfitOf(item?: DiamondItem, jewelry?: DiamondItem, weapon?: DiamondItem): Outfit {
  const base: Outfit = item?.outfit ? { ...item.outfit } : { shirt: item?.color ?? '#8d949c', pants: '#3b4252' };
  if (item?.sprite) base.sprite = item.sprite;
  if (jewelry?.jewelry) Object.assign(base, jewelry.jewelry);
  if (jewelry?.sprite && jewelry.wear) base.acc = { sprite: jewelry.sprite, wear: jewelry.wear, ...(jewelry.tint ? { tint: jewelry.tint } : {}) };
  if (weapon?.weapon) base.weapon = weapon.weapon;
  if (weapon?.sprite) base.gun = weapon.sprite;
  if (weapon?.tint) base.gunTint = weapon.tint;
  return base;
}

export type TuningSet = Partial<Record<'paint' | 'neon' | 'wheels', string>>;
const tuneColor = (id?: string) => (id ? TUNING.find(t => t.id === id)?.color : undefined);

export const carOf = (item?: DiamondItem, rider?: string, tuning?: TuningSet): CarLook => {
  const paint = tuneColor(tuning?.paint), neon = tuneColor(tuning?.neon), wheels = tuneColor(tuning?.wheels);
  return {
    color: paint ?? item?.color ?? '#7a8b99', shape: item?.vehicleType ?? 'sedan', rider,
    ...(item?.sprite ? { sprite: item.sprite } : {}), ...(item?.stripe ? { stripe: item.stripe } : {}),
    ...(paint ? { paint } : {}), ...(neon ? { neon } : {}), ...(wheels ? { wheels } : {}),
  };
};

export function equippedLook(p: PlayerState) {
  const outfitItem = byId(p.equipped.character);
  const carItem = byId(p.equipped.vehicle);
  const jewelryItem = byId(p.equipped.jewelry);
  const weaponItem = byId(p.equipped.weapon);
  const outfit = outfitOf(outfitItem, jewelryItem, weaponItem);
  return { outfitItem, carItem, jewelryItem, weaponItem, outfit, car: carOf(carItem, outfit.shirt, p.tuning?.cars?.[p.equipped.vehicle]) };
}
