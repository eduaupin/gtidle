// Leilão de raros do fim de semana: lances ao vivo, números baixos (#0001 a #0010) em destaque.
import { useCallback, useEffect, useState } from 'react';
import { AUCTION, DIAMOND_ITEMS, formatDuration, type PlayerState } from '@gti/shared';
import { api, type AuctionView, type StateResponse, type With } from '../api';
import { ItemPreview } from './Preview';
import { useNow } from './Hud';

const serial = (n: number) => `#${String(n).padStart(4, '0')}`;

export default function AuctionSection({ p, onState }: { p: PlayerState; onState: (r: StateResponse) => void }) {
  const now = useNow(1000);
  const [v, setV] = useState<AuctionView | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [bids, setBids] = useState<Record<string, number>>({});
  const [uid, setUid] = useState('');
  const [start, setStart] = useState(200);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.auction().then(r => { setV(r.data); onState(r); }).catch(() => {}), [onState]);
  useEffect(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id); }, [load]);
  const run = async (fn: () => Promise<With<AuctionView>>, ok: string) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); setV(r.data); onState(r); setMsg({ text: ok }); }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); load(); }
    finally { setBusy(false); }
  };
  if (!v) return null;
  const canCreate = v.window || import.meta.env.DEV;

  return (
    <section className="auction">
      <h3>Leilão de raros <span className="badge">{v.window ? 'aberto neste fim de semana' : 'abre sábado e domingo'}</span></h3>
      <p className="small muted">Termina domingo às 22 h (Brasília). Lance nos últimos {AUCTION.extendMinutes} minutos estende o fim. Seus diamantes ficam reservados e voltam na hora se alguém cobrir. Números de #0001 a #0010 ficam em destaque.</p>
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}
      {v.open.length === 0 && <p className="muted small">Nenhum lote aberto.</p>}
      <div className="market-grid">
        {v.open.map(a => {
          const item = DIAMOND_ITEMS.find(i => i.id === a.itemId);
          const value = bids[a.id] ?? a.minBid;
          return (
            <div key={a.id} className={`listing ${a.highlight ? 'hot' : ''}`}>
              {a.highlight && <span className="flag">Número baixo</span>}
              {item && <ItemPreview item={item} size={72} />}
              <b>{a.name}</b>
              <span className="small">{serial(a.serial)}</span>
              <span className="small muted">de {a.seller} · {a.bids} lance{a.bids === 1 ? '' : 's'} · fecha em {formatDuration(Math.max(0, a.endsAt - now) / 1000)}</span>
              <span className="price">{a.bid ? `${a.bid.toLocaleString('pt-BR')} ◆` : `inicial ${a.start} ◆`}{a.bidder && <small> · {a.mineBid ? 'seu lance' : a.bidder}</small>}</span>
              {!a.mineSeller && !a.mineBid && (
                <div className="row">
                  <input type="number" min={a.minBid} value={value} onChange={e => setBids({ ...bids, [a.id]: Number(e.target.value) })} aria-label="Valor do lance" />
                  <button className="small" disabled={busy || value < a.minBid} onClick={() => run(() => api.auctionBid(a.id, value), 'Lance registrado.')}>Dar lance</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {v.recent.length > 0 && <p className="small muted">Últimos arremates: {v.recent.map(a => `${a.name} ${serial(a.serial)} por ${a.bid}◆`).join(' · ')}</p>}
      {p.inventory.rares.length > 0 && (
        <div className="card row">
          <span className="small">Leiloar um raro:</span>
          <select value={uid} onChange={e => setUid(e.target.value)} aria-label="Item para leiloar">
            <option value="">Escolha…</option>
            {p.inventory.rares.map(r => <option key={r.uid} value={r.uid}>{DIAMOND_ITEMS.find(i => i.id === r.itemId)?.name} {serial(r.serial)}</option>)}
          </select>
          <label className="field">Lance inicial ◆<input type="number" min={AUCTION.minStart} value={start} onChange={e => setStart(Number(e.target.value))} /></label>
          <button className="small" disabled={busy || !uid || !canCreate} onClick={() => run(() => api.auctionCreate(uid, start), 'Lote aberto.')}>{canCreate ? 'Abrir lote' : 'Só no fim de semana'}</button>
        </div>
      )}
    </section>
  );
}
