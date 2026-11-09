// Equipamento com status: cartão do item (raridade, status, conjunto, efeito único e desgaste).
import {
  DIAMOND_ITEMS, GEAR_SETS, PERKS, RARITY_NAME, STATS, gearSerial, repairCost, statText,
  type RareInstance, type Rarity, type StatId,
} from '@gti/shared';
import { ItemPreview } from './Preview';
import type { ReactNode } from 'react';

export type GearLike = Pick<RareInstance, 'itemId' | 'serial' | 'rarity' | 'stats' | 'set' | 'perk' | 'wear'>;

export const gearName = (g: Pick<RareInstance, 'itemId' | 'serial'>) => {
  const name = DIAMOND_ITEMS.find(i => i.id === g.itemId)?.name ?? g.itemId;
  const s = gearSerial(g);
  return s ? `${name} ${s}` : name;
};

/** Linhas de status do item */
export function GearStats({ g, compact = false }: { g: GearLike; compact?: boolean }) {
  const stats = Object.entries(g.stats ?? {}) as [StatId, number][];
  const set = g.set ? GEAR_SETS.find(s => s.id === g.set) : null;
  const perk = g.perk ? PERKS.find(x => x.id === g.perk) : null;
  return (
    <ul className={`gear-stats ${compact ? 'compact' : ''}`}>
      {stats.map(([id, v]) => <li key={id}>{statText(id, v)}</li>)}
      {perk && <li className="perk" title={perk.text}>★ {perk.name}{!compact && `: ${perk.text}`}</li>}
      {set && <li className="set" title={`2 peças: ${bonus(set.two)} · 4 peças: ${bonus(set.four)}`}>Conjunto {set.name}</li>}
    </ul>
  );
}
const bonus = (b: Partial<Record<StatId, number>>) => Object.entries(b).map(([k, v]) => statText(k as StatId, v ?? 0)).join(', ');

export function RarityTag({ r }: { r?: Rarity }) {
  const rr = r ?? 'comum';
  return <span className={`rarity r-${rr}`}>{RARITY_NAME[rr]}</span>;
}

/** Cartão completo (mochila, mercado, leilão) */
export function GearCard({ g, children, on = false, size = 64 }: { g: GearLike; children?: ReactNode; on?: boolean; size?: number }) {
  const item = DIAMOND_ITEMS.find(i => i.id === g.itemId);
  const wear = g.wear ?? 0;
  return (
    <div className={`gear-card r-${g.rarity ?? 'comum'} ${on ? 'on' : ''}`}>
      <div className="gear-head">
        {item && <ItemPreview item={item} size={size} rarity={g.rarity} />}
        <div>
          <strong>{gearName(g)}</strong>
          <div className="tag-row"><RarityTag r={g.rarity} />{on && <span className="badge boost">Em uso</span>}</div>
          {wear > 0 && (
            <div className={`wear ${wear >= 100 ? 'worn' : ''}`} title={wear >= 100 ? 'Gasto: rende metade até consertar' : `Desgaste ${Math.floor(wear)}%`}>
              <div style={{ width: `${Math.min(100, wear)}%` }} />
            </div>
          )}
        </div>
      </div>
      <GearStats g={g} />
      {children}
    </div>
  );
}

export const repairLabel = (g: RareInstance) => (repairCost(g) > 0 ? repairCost(g) : 0);
export const STAT_ORDER = STATS.map(s => s.id);
