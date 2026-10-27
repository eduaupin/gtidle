// Aba Mercado: vitrine entre jogadores, vender da mochila, seus anúncios e o saldo de vendas.
import { useCallback, useEffect, useState } from 'react';
import {
  DIAMOND_ITEMS, DROP_RULES, HEIST_PLANS, MARKET, PARTS, RARE_ITEMS, formatDuration,
  type PlayerState,
} from '@gti/shared';
import { api, type ListRequest, type MarketListing, type MarketResponse, type MarketView, type StateResponse } from '../api';
import { showRewardedAd } from '../ads';
import { DecorThumb, ItemPreview } from './Preview';
import Icon from './Icon';
import AuctionSection from './Auction';
import { useNow } from './Hud';

type Filter = 'tudo' | 'rare' | 'part' | 'plan';
const FILTERS: [Filter, string][] = [['tudo', 'Tudo'], ['rare', 'Raros numerados'], ['part', 'Peças'], ['plan', 'Planos de golpe']];

const PLAN_ICON: Record<string, string> = { plano_carroforte: 'vip_black', plano_cofre: 'e_safe_big', plano_iate: 'heli_red_white' };
const serial = (n: number, supply?: number) => `#${String(n).padStart(4, '0')}${supply ? ` de ${supply}` : ''}`;

/** Miniatura de qualquer coisa negociável. */
function Thumb({ kind, itemId, size = 64 }: { kind: MarketListing['kind']; itemId: string; size?: number }) {
  if (kind === 'rare') {
    const item = DIAMOND_ITEMS.find(i => i.id === itemId);
    return item ? <ItemPreview item={item} size={size} /> : null;
  }
  const sprite = kind === 'part' ? PARTS.find(p => p.id === itemId)?.icon : PLAN_ICON[itemId];
  return sprite ? <DecorThumb sprite={sprite} size={size} bg={kind === 'plan' ? '#3d2a10' : '#2f3a4f'} /> : null;
}

const defaultPrice = (kind: MarketListing['kind'], itemId: string, qty: number, stats: MarketView['stats']) => {
  const avg = stats[itemId]?.avg;
  if (avg) return Math.max(MARKET.minPrice, Math.round(avg * qty));
  return kind === 'part' ? 15 * qty : kind === 'plan' ? 120 * qty : 400;
};

export default function MarketPanel({ p, onState, onVip }: { p: PlayerState; onState: (r: StateResponse) => void; onVip: () => void }) {
  const now = useNow(1000);
  const [view, setView] = useState<MarketView | null>(null);
  const [filter, setFilter] = useState<Filter>('tudo');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { qty: number; price: number }>>({});
  const [ad, setAd] = useState<number | null>(null);

  const apply = useCallback((r: MarketResponse) => { setView(r.market); onState(r); }, [onState]);
  const load = useCallback(() => api.market().then(apply).catch(e => setMsg({ text: (e as Error).message, bad: true })), [apply]);
  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const run = async (key: string, fn: () => Promise<MarketResponse>, ok: string) => {
    setBusy(key); setMsg(null);
    try { apply(await fn()); setMsg({ text: ok }); }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); load(); }
    finally { setBusy(null); }
  };

  const watchForSlot = async () => {
    setMsg(null);
    try {
      const { token, minSec } = await api.adStart('market_slot');
      const started = Date.now();
      const result = await showRewardedAd();
      if (result === 'dismissed') { setMsg({ text: 'O anúncio foi fechado antes do fim.', bad: true }); return; }
      const wait = minSec * 1000 - (Date.now() - started);
      if (wait > 0) {
        await new Promise<void>(res => {
          const t0 = Date.now();
          const id = setInterval(() => {
            const left = Math.max(0, Math.ceil((wait - (Date.now() - t0)) / 1000));
            setAd(left);
            if (left <= 0) { clearInterval(id); res(); }
          }, 200);
        });
      }
      setAd(null);
      onState(await api.adComplete(token));
      await load();
      setMsg({ text: `Vaga extra liberada por ${MARKET.adSlotHours} h.` });
    } catch (e) { setAd(null); setMsg({ text: (e as Error).message, bad: true }); }
  };

  if (!view) return <div className="panel"><p className="muted">Abrindo o mercado…</p></div>;
  const me = view.me;
  const shown = view.listings.filter(l => filter === 'tudo' || l.kind === filter);
  const draft = (key: string, kind: MarketListing['kind'], itemId: string, max: number) =>
    drafts[key] ?? { qty: Math.min(max, kind === 'part' ? 5 : 1), price: defaultPrice(kind, itemId, Math.min(max, kind === 'part' ? 5 : 1), view.stats) };
  const setDraft = (key: string, d: { qty: number; price: number }) => setDrafts(s => ({ ...s, [key]: d }));
  const full = me.used >= me.slots;

  const sellRow = (key: string, kind: MarketListing['kind'], itemId: string, label: string, have: number, req: (d: { qty: number; price: number }) => ListRequest) => {
    const d = draft(key, kind, itemId, have);
    const stat = view.stats[itemId];
    return (
      <div key={key} className="sell-row">
        <Thumb kind={kind} itemId={itemId} size={48} />
        <div className="sell-info">
          <strong>{label}</strong>
          <span className="small muted">{kind === 'rare' ? 'Único' : `Você tem ${have}`}{stat ? ` · média ${Math.round(stat.avg)}◆ cada` : ''}</span>
        </div>
        {kind !== 'rare' && (
          <label className="field">Qtd
            <input type="number" min={1} max={have} value={d.qty} onChange={e => setDraft(key, { ...d, qty: Math.max(1, Math.min(have, Number(e.target.value) || 1)) })} />
          </label>
        )}
        <label className="field">Preço ◆
          <input type="number" min={MARKET.minPrice} value={d.price} onChange={e => setDraft(key, { ...d, price: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <button className="small" disabled={busy !== null || full || have < 1} onClick={() => run(key, () => api.marketList(req(d)), 'Anúncio publicado.')}>
          Anunciar
        </button>
      </div>
    );
  };

  const rares = p.inventory.rares;
  const parts = PARTS.filter(x => p.inventory.parts[x.id] > 0);
  const plans = HEIST_PLANS.filter(h => (p.inventory.plans[h.id] ?? 0) > 0);
  const usd = (me.balance / 1000) * view.withdraw.usdPer1000;

  return (
    <div className="panel market">
      <p className="lead">
        Compra e venda entre jogadores. Só itens que caem nos assaltos: <b>raros numerados</b>, <b>peças de evolução</b> e <b>planos de golpe</b>.
        Paga com diamantes comprados ou saldo de vendas.
      </p>

      <div className="card wallet">
        <div className="wallet-row">
          <div><small>Saldo de vendas</small><strong className="with-icon"><Icon name="i_diamond" size={1.2} />{me.balance.toLocaleString('pt-BR')}</strong></div>
          <div><small>Diamantes comprados</small><strong>{me.paid.toLocaleString('pt-BR')} ◆</strong></div>
          <div title="Ganhos com anúncio e missões: valem na loja, não no mercado"><small>Ganhos jogando</small><strong className="muted">{me.earned.toLocaleString('pt-BR')} ◆</strong></div>
        </div>
        <div className="withdraw">
          <button disabled title="Depende de parceiro autorizado pelo Banco Central">Sacar em Solana · em breve</button>
          <span className="small muted">
            Previsão: {view.withdraw.min.toLocaleString('pt-BR')} ◆ de saldo = US$ {view.withdraw.usdPer1000}. Seu saldo hoje equivale a ~US$ {usd.toFixed(2)}.
            O saque depende de parceiro autorizado e de verificação de identidade; o saldo fica guardado até lá.
          </span>
        </div>
      </div>

      <div className="perks">
        <span className="badge">Taxa {Math.round(me.fee * 100)}%</span>
        <span className={`badge ${full ? 'weak' : ''}`}>Vagas {me.used}/{me.slots}</span>
        <span className="badge">Anúncios duram {me.vip ? MARKET.durationHoursVip / 24 : MARKET.durationHoursFree / 24} dias</span>
        {me.vip
          ? <span className="badge vip">★ Clube Rockeiro: destaque e +{Math.round((DROP_RULES.vipMult - 1) * 100)}% de drops</span>
          : <>
              {(me.adSlotUntil ?? 0) > now
                ? <span className="badge boost">Vaga extra por mais {formatDuration(((me.adSlotUntil ?? 0) - now) / 1000)}</span>
                : <button className="small ghost" disabled={ad !== null} onClick={watchForSlot}>{ad !== null ? `Anúncio… ${ad}s` : 'Assistir anúncio: +1 vaga por 24 h'}</button>}
              <button className="small" onClick={onVip}>Clube: taxa 5%, 10 vagas, destaque</button>
            </>}
      </div>
      {msg && <p className={`small ${msg.bad ? 'heat' : 'cash'}`} role="status">{msg.text}</p>}

      <h3>Vitrine</h3>
      <div className="chips">
        {FILTERS.map(([id, label]) => <button key={id} className={filter === id ? 'chip active' : 'chip'} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      {shown.length === 0 && <p className="muted small">Nada à venda aqui ainda. Seja o primeiro a anunciar.</p>}
      <div className="market-grid">
        {shown.map(l => {
          const supply = l.kind === 'rare' ? RARE_ITEMS.find(i => i.id === l.itemId)?.rare?.supply : undefined;
          const stat = view.stats[l.itemId];
          return (
            <div key={l.id} className={`listing ${l.sellerVip ? 'hot' : ''}`}>
              {l.sellerVip && <span className="flag">Destaque</span>}
              <Thumb kind={l.kind} itemId={l.itemId} />
              <strong>{l.name}</strong>
              <span className="small">{l.rare ? serial(l.rare.serial, supply) : `${l.qty}×`}</span>
              <span className="small muted">{l.sellerVip && '★ '}{l.sellerNick} · vence em {formatDuration((l.expiresAt - now) / 1000)}</span>
              {stat && <span className="small muted">Média: {Math.round(stat.avg * l.qty)} ◆</span>}
              <button className="small" disabled={busy !== null || me.balance + me.paid < l.price}
                onClick={() => run(l.id, () => api.marketBuy(l.id), `Comprado: ${l.name}.`)}>
                {l.price.toLocaleString('pt-BR')} ◆
              </button>
            </div>
          );
        })}
      </div>

      <AuctionSection p={p} onState={onState} />

      <h3>Vender da mochila</h3>
      {full && <p className="small heat">Todas as vagas estão ocupadas.</p>}
      {rares.length + parts.length + plans.length === 0 && (
        <p className="muted small">
          Sua mochila está vazia. Peças caem em todo assalto (mais nos de mais estrelas e mais longos),
          planos caem a partir de 3 estrelas e raros só em golpes de 5 e 6 estrelas.
        </p>
      )}
      <div className="sell-list">
        {rares.map(r => {
          const item = DIAMOND_ITEMS.find(i => i.id === r.itemId);
          return sellRow(r.uid, 'rare', r.itemId, `${item?.name ?? r.itemId} ${serial(r.serial)}`, 1, d => ({ kind: 'rare', uid: r.uid, price: d.price }));
        })}
        {parts.map(x => sellRow(x.id, 'part', x.id, x.name, p.inventory.parts[x.id], d => ({ kind: 'part', itemId: x.id, qty: d.qty, price: d.price })))}
        {plans.map(h => sellRow(h.id, 'plan', h.id, h.planName, p.inventory.plans[h.id] ?? 0, d => ({ kind: 'plan', itemId: h.id, qty: d.qty, price: d.price })))}
      </div>

      <h3>Seus anúncios</h3>
      {view.mine.length === 0 && <p className="muted small">Nenhum anúncio ativo.</p>}
      {view.mine.map(l => (
        <div key={l.id} className="card row">
          <span><b>{l.name}</b> {l.rare ? serial(l.rare.serial) : `${l.qty}×`} por {l.price.toLocaleString('pt-BR')} ◆ · vence em {formatDuration((l.expiresAt - now) / 1000)}</span>
          <button className="small ghost" disabled={busy !== null} onClick={() => run(l.id, () => api.marketCancel(l.id), 'Anúncio cancelado. O item voltou para a mochila.')}>Cancelar</button>
        </div>
      ))}
      <p className="hint">
        Você recebe o preço menos a taxa ({Math.round(MARKET.feeFree * 100)}%, ou {Math.round(MARKET.feeVip * 100)}% no Clube Rockeiro).
        Anúncio que vence volta sozinho para a mochila.
      </p>
    </div>
  );
}
