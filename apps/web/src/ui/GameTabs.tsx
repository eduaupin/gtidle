// Abas Visual (guarda-roupa e garagem), Gangue (evolução) e Base (esconderijo).
import { useEffect, useRef, useState } from 'react';
import {
  DECOR_ITEMS, DECOR_SLOTS, TUNING, TUNING_SLOTS, DIAMOND_ITEMS, PARTS, PART_FOR, RARITY_NAME, RULES, ownsItem, partsForTier, rarityOf, UPGRADE_MAX, UPGRADE_TRACKS, UPGRADE_VIP_DISCOUNT,
  burnedUntil, formatCash, isVip, totalDiamonds, upgradeCost, upgradeMinLevel,
  type Action, type CosmeticSlot, type DecorSlot, type PlayerState,
} from '@gti/shared';
import { useNow } from './Hud';
import { DecorThumb, GangPreview, ItemPreview, RoomView } from './Preview';
import Icon from './Icon';
import { equippedLook } from '../game/look';

export { equippedLook };

type Act = (a: Action) => void;

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const left = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

// ---------------- Visual ----------------
export function LookPanel({ p, act }: { p: PlayerState; act: Act }) {
  const now = useNow(1000);
  const vip = isVip(p, now);
  const look = equippedLook(p);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => { const el = box.current; if (el) setW(Math.floor(el.clientWidth)); }, []);
  const optional = (slot: CosmeticSlot | 'rare') => slot === 'jewelry' || slot === 'weapon';

  const section = (slot: CosmeticSlot | 'rare', title: string, lead: string) => (
    <>
      <h3>{title}</h3>
      <p className="lead">{lead}</p>
      <div className="look-grid">
        {DIAMOND_ITEMS.filter(i => (slot === 'rare' ? !!i.rare : i.slot === slot && !i.rare) && (!i.exclusive || ownsItem(p, i.id)))
          .sort((a, b) => slot === 'rare' ? Number(ownsItem(p, b.id)) - Number(ownsItem(p, a.id)) : 0).map(i => {
          const owned = ownsItem(p, i.id);
          const serials = p.inventory.rares.filter(r => r.itemId === i.id).map(r => `#${String(r.serial).padStart(4, '0')}`);
          const on = i.slot ? p.equipped[i.slot] === i.id : false;
          const islot = i.slot ?? 'character';
          const burnt = burnedUntil(p, i.id);
          const hot = burnt > now;
          const r = rarityOf(i);
          return (
            <div key={i.id} className={`look r-${r} ${on ? 'on' : ''} ${hot ? 'hot' : ''}`} title={i.description}>
              {slot !== 'hideout' || i.sprite ? <ItemPreview item={i} /> : <span className="swatch big" style={{ background: i.color }} />}
              <span className="tag-row">
                <span className={`rarity r-${r}`}>{RARITY_NAME[r]}</span>
                {i.priceDiamonds > 0 && !i.priceCash && <Icon name="i_vip" size={1.3} title="VIP: custa diamantes" />}
              </span>
              <strong>{i.name}</strong>
              <span className="desc">{i.description}</span>
              {hot && <span className="badge weak">Queimado até {hhmm(burnt)}</span>}
              {i.rare && <span className="small muted">{serials.length ? serials.join(' ') : `Tiragem de ${i.rare.supply}`}</span>}
              {owned
                ? <button className={on && !optional(islot) ? 'ghost small' : on ? 'small ghost' : 'small'} disabled={(on && !optional(islot)) || hot}
                    onClick={() => act({ type: 'equip', itemId: i.id })}>
                    {on ? (optional(islot) ? 'Tirar' : 'Em uso') : hot ? `Volta em ${left(burnt - now)}` : 'Usar'}
                  </button>
                : i.rare ? <span className="small muted">Cai em golpes de 5★ e 6★ ou no Mercado</span>
                : <div className="buy-row">
                    {i.priceCash !== undefined && (
                      <button className="small" disabled={p.cash < i.priceCash} onClick={() => act({ type: 'buyCosmetic', itemId: i.id, pay: 'cash' })}>{formatCash(i.priceCash)}</button>
                    )}
                    {i.priceDiamonds > 0 && (
                      <button className="small ghost" disabled={totalDiamonds(p) < i.priceDiamonds} onClick={() => act({ type: 'buyCosmetic', itemId: i.id, pay: 'diamonds' })}>{i.priceDiamonds} ◆</button>
                    )}
                  </div>}
            </div>
          );
        })}
      </div>
    </>
  );
  return (
    <div className="panel">
      <div ref={box} className="look-hero">
        <GangPreview outfit={look.outfit} car={look.car} w={w} h={Math.round(w * 0.42)} />
        <div className="look-tags">
          <span>{look.outfitItem?.name}</span>
          {look.jewelryItem && <span>{look.jewelryItem.name}</span>}
          {look.weaponItem && <span>{look.weaponItem.name}</span>}
          <span>{look.carItem?.name}</span>
        </div>
      </div>
      <p className="lead">
        Com 4 estrelas a SWAT grava a roupa e o carro da gangue: os dois ficam queimados por {vip ? RULES.lookCooldownHoursVip : RULES.lookCooldownHours} h
        {vip ? ' (Clube Rockeiro)' : ` (${RULES.lookCooldownHoursVip} h no Clube Rockeiro)`} e a gangue só volta a roubar com outro visual. Tenha sempre um reserva. Acessórios e armas não queimam. Itens com selo VIP custam diamantes.
      </p>
      {section('rare', 'Raros numerados', 'Não estão na loja: caem em golpes de 5 e 6 estrelas e em planos de golpe, cada um com número de série. Compre e venda no Mercado.')}
      {section('character', 'Roupas', 'A gangue inteira usa a mesma roupa no mapa.')}
      {section('jewelry', 'Acessórios', 'Óculos, corrente, relógio e colete aparecem no personagem: no mapa, no esconderijo e no card de compartilhar.')}
      {section('weapon', 'Armas', 'Só visual: a gangue anda com ela na mão. Quem aumenta a grana dos assaltos é o Arsenal, na aba Gangue.')}
      {section('vehicle', 'Carros', 'O carro de fuga. Cada formato aparece diferente no mapa.')}
      <TuningSection p={p} act={act} />
      {section('hideout', 'Telhado do esconderijo', 'Como a sua base aparece no mapa.')}
    </div>
  );
}

// ---------------- Oficina de tuning ----------------
function TuningSection({ p, act }: { p: PlayerState; act: Act }) {
  const car = p.tuning.cars[p.equipped.vehicle] ?? {};
  const carName = DIAMOND_ITEMS.find(i => i.id === p.equipped.vehicle)?.name ?? 'seu carro';
  return (
    <>
      <h3>Oficina de tuning</h3>
      <p className="lead">Pintura, neon embaixo e rodas para o carro em uso ({carName}). Cada carro guarda o próprio tuning; a peça comprada vale para todos. Aparece no mapa, na corrida, no modo foto e na ficha.</p>
      {TUNING_SLOTS.map(slot => (
        <div key={slot.id} className="tuning-row">
          <b>{slot.name}</b>
          <div className="tuning-opts">
            <button className={!car[slot.id] ? 'chip active' : 'chip'} onClick={() => act({ type: 'setTuning', slot: slot.id, optionId: null })}>Original</button>
            {TUNING.filter(o => o.slot === slot.id).map(o => {
              const owned = p.tuning.owned.includes(o.id);
              const on = car[slot.id] === o.id;
              const price = o.priceCash ? formatCash(o.priceCash) : `${o.priceDiamonds} ◆`;
              const afford = o.priceCash ? p.cash >= o.priceCash : totalDiamonds(p) >= (o.priceDiamonds ?? 0);
              return (
                <button key={o.id} className={on ? 'chip active' : 'chip'} disabled={!owned && !afford}
                  title={owned ? 'Instalar' : `Comprar por ${price}`}
                  onClick={() => owned
                    ? act({ type: 'setTuning', slot: slot.id, optionId: o.id })
                    : act({ type: 'buyTuning', optionId: o.id, pay: o.priceCash ? 'cash' : 'diamonds' })}>
                  <span className="swatch" style={{ background: o.color, boxShadow: slot.id === 'neon' ? `0 0 8px ${o.color}` : undefined }} />
                  {o.name}{!owned && <small> · {price}</small>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ---------------- Gangue (evolução) ----------------
export function GangPanel({ p, act, onShare }: { p: PlayerState; act: Act; onShare: () => void }) {
  const now = useNow(1000);
  const vip = isVip(p, now);
  const { outfit, car, outfitItem, carItem } = equippedLook(p);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => { const el = box.current; if (el) setW(Math.floor(el.clientWidth)); }, []);

  return (
    <div className="panel">
      <div ref={box}><GangPreview outfit={outfit} car={car} w={w} h={Math.round(w * 0.36)} /></div>
      <div className="row small"><span>{outfitItem?.name} e {carItem?.name}</span><button className="small" onClick={onShare}>Compartilhar perfil</button></div>
      <p className="lead">
        Evolução com grana do jogo. É caro de propósito: cada nível vale para sempre.
        {vip ? ` Você paga ${Math.round(UPGRADE_VIP_DISCOUNT * 100)}% do preço (Clube Rockeiro).` : ` No Clube Rockeiro sai ${Math.round((1 - UPGRADE_VIP_DISCOUNT) * 100)}% mais barato.`}
      </p>
      {UPGRADE_TRACKS.map(t => {
        const tier = p.upgrades[t.id];
        const next = tier + 1;
        const maxed = tier >= UPGRADE_MAX;
        const price = maxed ? 0 : upgradeCost(t.id, next, vip);
        const full = maxed ? 0 : upgradeCost(t.id, next, false);
        const needLvl = upgradeMinLevel(next);
        const partId = PART_FOR[t.id], needParts = maxed ? 0 : partsForTier(next), haveParts = p.inventory.parts[partId];
        const partName = PARTS.find(x => x.id === partId)!.name;
        return (
          <div key={t.id} className="card upgrade">
            <div className="row"><strong>{t.name}</strong><span className="muted small">{t.effect}</span></div>
            <div className="pips" aria-label={`Nível ${tier} de ${UPGRADE_MAX}`}>
              {Array.from({ length: UPGRADE_MAX }, (_, i) => <span key={i} className={i < tier ? 'on' : ''} />)}
            </div>
            <p className="small">Agora: <b>{tier ? t.tiers[tier - 1] : 'nada ainda'}</b>{!maxed && <> · Próximo: <b>{t.tiers[tier]}</b></>}</p>
            {needParts > 0 && <p className={`small ${haveParts >= needParts ? 'cash' : 'heat'}`}>Pede {needParts} {partName.toLowerCase()}s · você tem {haveParts} (caem nos assaltos ou no Mercado)</p>}
            {maxed
              ? <p className="small cash">No máximo.</p>
              : <button disabled={p.level < needLvl || p.cash < price || haveParts < needParts} onClick={() => act({ type: 'buyUpgrade', track: t.id })}>
                  {p.level < needLvl ? `Abre no nível ${needLvl}` : <>Comprar por {formatCash(price)}{vip && <s className="muted"> {formatCash(full)}</s>}</>}
                </button>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Base (esconderijo) ----------------
export function BasePanel({ p, act }: { p: PlayerState; act: Act }) {
  const { outfit, car } = equippedLook(p);
  const [slot, setSlot] = useState<DecorSlot>('sofa');
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => { const el = box.current; if (el) setW(Math.floor(el.clientWidth)); }, []);
  const items = DECOR_ITEMS.filter(d => d.slot === slot);
  const placed = p.decor.placed[slot];

  return (
    <div className="panel">
      <div ref={box}><RoomView placed={p.decor.placed} outfit={outfit} car={car} width={w} /></div>
      <p className="lead">Monte a base da gangue. O carro em uso fica na garagem e a decoração aparece no card de compartilhar.</p>
      <div className="chips">
        {DECOR_SLOTS.map(s => (
          <button key={s.id} className={s.id === slot ? 'chip active' : 'chip'} onClick={() => setSlot(s.id)}>{s.name}</button>
        ))}
      </div>
      {items.map(d => {
        const owned = p.decor.owned.includes(d.id);
        const on = placed === d.id;
        return (
          <div key={d.id} className={`card decor ${on ? 'selected' : ''}`}>
            {d.sprite && <DecorThumb sprite={d.sprite} />}
            <div className="decor-body">
            <div className="row">
              <strong>{!d.sprite && d.colors.map((c, i) => <span key={i} className="swatch" style={{ background: c }} />)}{d.name}</strong>
              {on && <span className="badge boost">Na sala</span>}
              {d.priceDiamonds !== undefined && <Icon name="i_vip" size={1.3} title="VIP: custa diamantes" />}
            </div>
            <p className="small muted">{d.description}</p>
            {owned
              ? <div className="buy-row">
                  <button className="small" disabled={on} onClick={() => act({ type: 'placeDecor', slot, itemId: d.id })}>{on ? 'Colocado' : 'Colocar'}</button>
                  {on && slot !== 'piso' && slot !== 'parede' && <button className="small ghost" onClick={() => act({ type: 'placeDecor', slot, itemId: null })}>Tirar</button>}
                </div>
              : <div className="buy-row">
                  {d.priceCash !== undefined && <button className="small" disabled={p.cash < d.priceCash} onClick={() => act({ type: 'buyDecor', itemId: d.id, pay: 'cash' })}>{formatCash(d.priceCash)}</button>}
                  {d.priceDiamonds !== undefined && <button className="small ghost" disabled={totalDiamonds(p) < d.priceDiamonds} onClick={() => act({ type: 'buyDecor', itemId: d.id, pay: 'diamonds' })}>{d.priceDiamonds} ◆</button>}
                </div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
