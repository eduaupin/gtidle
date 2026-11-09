// Aba Inventário: vida, munição e kits; o Mercador; a mochila de equipamentos e a venda de cada item
// (Mercador na hora, Mercado em diamantes ou por dinheiro real).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DIAMOND_ITEMS, GEAR, GEAR_SETS, MARKET, PERKS, RMT, STATS, SUPPLY, VEHICLE_CLASSES, bulletPrice, equippedGear, formatBRL,
  formatCash, gearScore, gearSummary, isMelee, kitPrice, merchantValue, repairCost, statText, vehicleCategory,
  VIP_SUPPLY, bagMaxFor, brDay, isVip,
  type GearSlot, type PlayerState, type RareInstance, type StatId,
} from '@gti/shared';
import { api, type RmtView, type StateResponse } from '../api';
import { GearCard, gearName } from './Gear';
import { useNow } from './Hud';

type Act = (a: import('@gti/shared').Action) => Promise<void> | void;
type Filter = 'tudo' | 'weapon' | 'character' | 'jewelry' | 'carro' | 'moto';
const FILTERS: [Filter, string][] = [['tudo', 'Tudo'], ['weapon', 'Armas'], ['character', 'Roupas'], ['jewelry', 'Acessórios'], ['carro', 'Carros'], ['moto', 'Motos']];

const itemOf = (g: RareInstance) => DIAMOND_ITEMS.find(i => i.id === g.itemId);
const matches = (g: RareInstance, f: Filter) => {
  const it = itemOf(g);
  if (f === 'tudo') return true;
  if (f === 'carro') return it?.slot === 'vehicle' && it.vehicleType !== 'moto';
  if (f === 'moto') return it?.slot === 'vehicle' && it.vehicleType === 'moto';
  return it?.slot === f;
};

export default function InventoryPanel({ p, act, onState, onGoMarket }: {
  p: PlayerState; act: Act; onState: (r: StateResponse) => void; onGoMarket: () => void;
}) {
  const now = useNow(1000);
  const [filter, setFilter] = useState<Filter>('tudo');
  const [sel, setSel] = useState<string | null>(null);
  const [rmt, setRmt] = useState<RmtView | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const loadRmt = useCallback(() => api.rmt().then(r => { setRmt(r.data); onState(r); }).catch(() => {}), [onState]);
  useEffect(() => { loadRmt(); }, [loadRmt]);

  const summary = gearSummary(p);
  const onUids = new Set(Object.values(p.gearOn ?? {}));
  const bag = useMemo(() => [...p.inventory.rares].filter(g => matches(g, filter))
    .sort((a, b) => Number(onUids.has(b.uid)) - Number(onUids.has(a.uid)) || gearScore(b) - gearScore(a)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [p.inventory.rares, filter, p.gearOn]);
  const selected = p.inventory.rares.find(g => g.uid === sel) ?? null;
  const active = STATS.filter(st => summary.stats[st.id] > 0);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ text: ok }); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
  };

  return (
    <div className="panel inventory">
      <Vitals p={p} act={act} now={now} />
      <Merchant p={p} act={act} />

      <div className="card gang-stats">
        <div className="row">
          <strong>Status da gangue</strong>
          <span className="small muted">{equippedGear(p).length} de 4 peças com status · {summary.vehicle.category}{summary.vehicle.className ? ` classe ${summary.vehicle.className}` : ''}</span>
        </div>
        <ul className="stat-lines">
          {(summary.vehicle.speed || summary.vehicle.cash) ? (
            <li><span>Veículo ({summary.vehicle.category}{summary.vehicle.className ? ` ${summary.vehicle.className}` : ''})</span>
              <span>{summary.vehicle.speed >= 0 ? '+' : ''}{summary.vehicle.speed}% vel. · {summary.vehicle.cash >= 0 ? '+' : ''}{summary.vehicle.cash}% grana</span></li>
          ) : null}
          {active.map(st => (
            <li key={st.id}>
              <span>{st.name}</span>
              <span className={summary.raw[st.id] > st.cap ? 'capped' : ''} title={`Teto ${st.cap}%`}>{Math.round(summary.stats[st.id])}%<small> / {st.cap}%</small></span>
            </li>
          ))}
        </ul>
        {active.length === 0 && <p className="small muted">Nenhum status ativo. Equipamento com status cai nos assaltos.</p>}
        {summary.sets.map(set => <p key={set.id} className="small"><b>Conjunto {set.name}</b> ({set.pieces}/4)</p>)}
        {summary.perks.map(id => { const pk = PERKS.find(x => x.id === id)!; return <p key={id} className="small perk">★ {pk.name}: {pk.text}</p>; })}
      </div>

      <h3>Mochila ({p.inventory.rares.length}/{bagMaxFor(isVip(p, now))})</h3>
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}
      <div className="chips">
        {FILTERS.map(([id, name]) => <button key={id} className={filter === id ? 'chip active' : 'chip'} onClick={() => setFilter(id)}>{name}</button>)}
      </div>
      <div className="inv-layout">
        <div className="gear-grid">
          {bag.length === 0 && <p className="muted small">Nada nessa categoria.</p>}
          {bag.map(g => (
            <button key={g.uid} className={`gear-pick ${sel === g.uid ? 'sel' : ''}`} onClick={() => setSel(g.uid)} aria-pressed={sel === g.uid}>
              <GearCard g={g} on={onUids.has(g.uid)} size={52}>
                <VehicleLine g={g} />
                {g.bound && <span className="small muted">Preso à conta</span>}
              </GearCard>
            </button>
          ))}
        </div>
        <aside className="inv-detail" aria-live="polite">
          {selected
            ? <ItemDetail key={selected.uid} g={selected} p={p} act={act} on={onUids.has(selected.uid)} rmt={rmt}
                onRmt={async (price) => run(async () => { const r = await api.rmtList(selected.uid, price); setRmt(r.data); onState(r); setSel(null); }, 'Anunciado por dinheiro real.')}
                onMarket={async (price) => run(async () => { const r = await api.marketList({ kind: 'rare', uid: selected.uid, price }); onState(r); setSel(null); }, 'Anunciado no Mercado.')}
                onSold={() => setSel(null)} />
            : <p className="muted small">Toque num item para ver as opções: usar, consertar, vender ao Mercador, anunciar no Mercado (diamantes) ou por dinheiro real.</p>}
        </aside>
      </div>

      <RmtMine rmt={rmt} now={now} onCancel={id => run(async () => { const r = await api.rmtCancel(id); setRmt(r.data); onState(r); }, 'Anúncio cancelado: item de volta na mochila.')} onGoMarket={onGoMarket} />
    </div>
  );
}

function VehicleLine({ g }: { g: RareInstance }) {
  const it = itemOf(g);
  if (it?.slot !== 'vehicle') return null;
  const cat = vehicleCategory(it.vehicleType);
  const cls = VEHICLE_CLASSES[g.rarity ?? 'comum'];
  return <span className="veh-line">{cat.name} · classe <b>{cls.name}</b> · {cat.speed + cls.speed >= 0 ? '+' : ''}{cat.speed + cls.speed}% vel. · {cat.cash + cls.cash >= 0 ? '+' : ''}{cat.cash + cls.cash}% grana</span>;
}

function Vitals({ p, act, now }: { p: PlayerState; act: Act; now: number }) {
  const v = p.vitals;
  const hp = Math.round(v.hp);
  const weapon = p.equipped.weapon ? DIAMOND_ITEMS.find(i => i.id === p.equipped.weapon) : undefined;
  const melee = isMelee(weapon?.weapon?.kind);
  const regenMin = Math.ceil(Math.max(0, SUPPLY.returnHp - v.hp) / SUPPLY.regenPerSec / 60);
  const vip = isVip(p, now);
  const usedToday = v.revive?.day === brDay(now) ? v.revive.used : 0;
  return (
    <div className={`card vitals ${v.down ? 'down' : ''}`}>
      <div className="row">
        <strong>{v.down ? (v.down.reason === 'morto' ? 'Gangue derrubada' : 'Gangue recolhida: sem kit médico') : 'Gangue na rua'}</strong>
        <label className="check small"><input type="checkbox" checked={v.autoBuy} onChange={e => act({ type: 'setAutoBuy', on: e.target.checked })} /> Repor sozinha no Mercador</label>
      </div>
      <div className="hp-bar" role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hp}>
        <div style={{ width: `${hp}%` }} className={hp < SUPPLY.retreatBelow ? 'low' : hp < SUPPLY.autoHealBelow ? 'mid' : ''} />
        <span>Vida {hp}/{SUPPLY.maxHp}</span>
      </div>
      <div className="vitals-row">
        <span className={Math.floor(v.ammo) < 20 ? 'warn' : ''}><b>{Math.floor(v.ammo)}</b> balas</span>
        <span className={v.kits < 1 ? 'warn' : ''}><b>{v.kits}</b> kits médicos</span>
        <span className="small muted">{weapon ? `${weapon.name}${melee ? ' (arma branca: sem bala, até 3★)' : ''}` : 'Sem arma: golpe de 2★+ só dá certo 1% das vezes'}</span>
      </div>
      {v.down && (
        <p className="small">
          {v.down.reason === 'morto' ? 'A vida zerou.' : 'Os kits acabaram com a vida baixa.'} A gangue está no esconderijo e <b>não farma</b> até você mandar de volta.
          {v.hp < SUPPLY.returnHp ? ` Precisa de ${SUPPLY.returnHp} de vida: use um kit ou espere ~${regenMin} min.` : ''}
        </p>
      )}
      <p className={`small ${vip ? '' : 'muted'}`}>
        {vip
          ? <>Clube Rockeiro: reanimação automática <b>{VIP_SUPPLY.revivesPerDay - usedToday} de {VIP_SUPPLY.revivesPerDay}</b> hoje. Se a gangue cair, ela levanta sozinha e continua farmando.</>
          : <>No Clube Rockeiro a gangue levanta sozinha até {VIP_SUPPLY.revivesPerDay} vezes por dia e continua farmando enquanto você está fora.</>}
      </p>
      {!v.down && Math.floor(v.ammo) <= 0 && !melee && <p className="small warn">Sem bala: golpes de 2★ ou mais só dão certo 1% das vezes.</p>}
      <div className="buy-row">
        <button className="small ghost" disabled={v.kits <= 0 || v.hp >= SUPPLY.maxHp} onClick={() => act({ type: 'useKit' })}>Usar kit (+{SUPPLY.kitHeal})</button>
        {v.down && <button className="small" disabled={v.hp < SUPPLY.returnHp} onClick={() => act({ type: 'backToStreet' })}>Voltar para a rua</button>}
      </div>
    </div>
  );
}

function Merchant({ p, act }: { p: PlayerState; act: Act }) {
  const off = isVip(p, Date.now()) ? 1 - VIP_SUPPLY.merchantDiscount : 1;
  const bp = Math.max(1, Math.round(bulletPrice(p.level) * off)), kp = Math.max(1, Math.round(kitPrice(p.level) * off));
  return (
    <div className="card merchant">
      <div className="row"><strong>Mercador</strong><span className="small muted">Só aceita grana do jogo · preços do seu nível{off < 1 ? ' · -10% Clube' : ''}</span></div>
      <div className="merchant-grid">
        <div>
          <span className="small">Munição · {formatCash(bp)} cada</span>
          <div className="buy-row">
            {SUPPLY.ammoPacks.map(n => <button key={n} className="small" disabled={p.cash < n * bp || p.vitals.ammo + n > SUPPLY.maxAmmo} onClick={() => act({ type: 'buyConsumable', item: 'ammo', qty: n })}>{n} · {formatCash(n * bp)}</button>)}
          </div>
        </div>
        <div>
          <span className="small">Kit médico (+{SUPPLY.kitHeal} de vida) · {formatCash(kp)} cada</span>
          <div className="buy-row">
            {SUPPLY.kitPacks.map(n => <button key={n} className="small" disabled={p.cash < n * kp || p.vitals.kits + n > SUPPLY.maxKits} onClick={() => act({ type: 'buyConsumable', item: 'kit', qty: n })}>{n} · {formatCash(n * kp)}</button>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemDetail({ g, p, act, on, rmt, onRmt, onMarket, onSold }: {
  g: RareInstance; p: PlayerState; act: Act; on: boolean; rmt: RmtView | null;
  onRmt: (price: number) => void; onMarket: (price: number) => void; onSold: () => void;
}) {
  const it = itemOf(g);
  const slot = it?.slot as GearSlot;
  const cost = repairCost(g);
  const value = merchantValue(g, p.level);
  const [mode, setMode] = useState<'none' | 'merchant' | 'market' | 'rmt'>('none');
  const [dia, setDia] = useState(Math.max(MARKET.minPrice, Math.round(gearScore(g) / 2)));
  const [brl, setBrl] = useState(Math.max(RMT.minPrice, Math.round(gearScore(g) / 40)));
  const tradable = !g.bound;
  const net = Math.round(brl * (1 - RMT.fee) * 100) / 100;
  return (
    <div className="item-detail">
      <GearCard g={g} on={on} size={72}><VehicleLine g={g} /></GearCard>
      {g.set && (() => { const set = GEAR_SETS.find(x => x.id === g.set)!; return <p className="small muted">Conjunto {set.name}: 2 peças {Object.entries(set.two).map(([k, v]) => statText(k as StatId, v ?? 0)).join(', ')}; 4 peças {Object.entries(set.four).map(([k, v]) => statText(k as StatId, v ?? 0)).join(', ')}.</p>; })()}
      <div className="buy-row">
        {on
          ? <button className="small ghost" onClick={() => act({ type: 'unequipGear', slot })}>Tirar</button>
          : <button className="small" onClick={() => act({ type: 'equipGear', uid: g.uid })}>Usar</button>}
        {cost > 0 && <button className="small ghost" disabled={p.cash < cost} onClick={() => act({ type: 'repairGear', uid: g.uid })}>Consertar {formatCash(cost)}</button>}
      </div>
      <h4>Vender</h4>
      {on && <p className="small muted">Tire o item para vender.</p>}
      <div className="sell-modes">
        <button className={mode === 'merchant' ? 'chip active' : 'chip'} disabled={on} onClick={() => setMode('merchant')}>Mercador · {formatCash(value)}</button>
        <button className={mode === 'market' ? 'chip active' : 'chip'} disabled={on || !tradable} onClick={() => setMode('market')}>Mercado ◆</button>
        <button className={mode === 'rmt' ? 'chip active' : 'chip'} disabled={on || !tradable} onClick={() => setMode('rmt')}>Dinheiro real R$</button>
      </div>
      {!tradable && <p className="small muted">Item inicial: preso à conta. Só o Mercador compra.</p>}
      {mode === 'merchant' && !on && (
        <div className="sell-box">
          <p className="small">Venda na hora para o Mercador por <b>{formatCash(value)}</b> em grana limpa. Não tem volta.</p>
          <button className="small danger" onClick={async () => { await act({ type: 'sellToMerchant', uid: g.uid }); onSold(); }}>Vender ao Mercador</button>
        </div>
      )}
      {mode === 'market' && !on && tradable && (
        <div className="sell-box">
          <label className="field">Preço em diamantes<input type="number" min={MARKET.minPrice} max={MARKET.maxPrice} value={dia} onChange={e => setDia(Number(e.target.value))} /></label>
          <p className="small muted">Quem compra paga com diamantes comprados. O valor entra no seu saldo de mercado, menos a taxa.</p>
          <button className="small" onClick={() => onMarket(dia)}>Anunciar por {dia} ◆</button>
        </div>
      )}
      {mode === 'rmt' && !on && tradable && (
        <div className="sell-box">
          {!rmt?.enabled && <p className="small warn">Venda por dinheiro real ainda não está liberada neste servidor.</p>}
          {rmt?.enabled && !rmt.linked && <p className="small warn">Ligue sua conta Google ou Discord (botão Conta) para vender por dinheiro real.</p>}
          {rmt?.enabled && rmt.linked && p.level < RMT.sellerMinLevel && <p className="small warn">Liberado a partir do nível {RMT.sellerMinLevel}.</p>}
          <label className="field">Preço em reais<input type="number" min={RMT.minPrice} max={RMT.maxPrice} step="0.5" value={brl} onChange={e => setBrl(Number(e.target.value))} /></label>
          <p className="small muted">Você recebe <b>{formatBRL(net)}</b> ({Math.round(RMT.fee * 100)}% de taxa). O valor fica retido {RMT.holdDays} dias contra estorno. Saque para o banco: em breve.</p>
          <button className="small" disabled={!rmt?.canSell} onClick={() => onRmt(brl)}>Anunciar por {formatBRL(brl)}</button>
        </div>
      )}
    </div>
  );
}

function RmtMine({ rmt, now, onCancel, onGoMarket }: { rmt: RmtView | null; now: number; onCancel: (id: string) => void; onGoMarket: () => void }) {
  if (!rmt) return null;
  const pending = rmt.wallet.pending.reduce((s, e) => s + e.amount, 0);
  const status: Record<string, string> = { open: 'À venda', reserved: 'Alguém pagando', sold: 'Vendido', cancelled: 'Cancelado', expired: 'Venceu' };
  return (
    <div className="card rmt-mine">
      <div className="row">
        <strong>Vendas por dinheiro real</strong>
        <button className="small ghost" onClick={onGoMarket}>Ver vitrine no Mercado</button>
      </div>
      <div className="wallet">
        <div><small>Retido ({rmt.rules.holdDays} dias)</small><b>{formatBRL(pending)}</b></div>
        <div><small>Disponível</small><b>{formatBRL(rmt.wallet.available)}</b></div>
        <div><small>Vendidos / comprados</small><b>{rmt.wallet.sold} / {rmt.wallet.bought}</b></div>
      </div>
      <button className="small" disabled={!rmt.wallet.payoutsEnabled || rmt.wallet.available <= 0} title="Saque para conta bancária: em breve">
        {rmt.wallet.payoutsEnabled ? 'Sacar' : 'Saque para o banco: em breve'}
      </button>
      {rmt.mine.length === 0 && <p className="small muted">Nenhum anúncio. Escolha um item na mochila e use "Dinheiro real R$".</p>}
      <ul className="rmt-list">
        {rmt.mine.map(l => (
          <li key={l.id}>
            <span>{gearName(l.item)}</span>
            <span>{formatBRL(l.price)}</span>
            <span className={`badge ${l.status === 'sold' ? 'boost' : ''}`}>{status[l.status] ?? l.status}</span>
            {l.status === 'open' && <><span className="small muted">vence em {Math.max(0, Math.ceil((l.expiresAt - now) / 864e5))} d</span><button className="small ghost" onClick={() => onCancel(l.id)}>Cancelar</button></>}
          </li>
        ))}
      </ul>
    </div>
  );
}
