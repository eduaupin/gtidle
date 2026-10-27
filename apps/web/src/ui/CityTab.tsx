// Aba Cidade: Jornal da Costa Dourada, corrida no Autódromo, convite de amigos, presentes e recados.
import { useCallback, useEffect, useState } from 'react';
import { DIAMOND_ITEMS, RACE, REFERRAL, formatCash, ownsItem, type PlayerState } from '@gti/shared';
import { api, type NewsItem, type RaceBoard, type StateResponse } from '../api';
import { inviteUrl, renderHeadline } from '../game/socialCards';
import ShareImage from './ShareImage';
import RaceModal from './Race';
import { ItemPreview } from './Preview';
import { useNow } from './Hud';

const ago = (at: number, now: number) => {
  const m = Math.max(0, Math.floor((now - at) / 60_000));
  return m < 1 ? 'agora' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h` : `${Math.floor(m / 1440)} d`;
};

export default function CityPanel({ p, onState, onProfile }: { p: PlayerState; onState: (r: StateResponse) => void; onProfile: (code: string) => void }) {
  const now = useNow(30_000);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [board, setBoard] = useState<RaceBoard | null>(null);
  const [headline, setHeadline] = useState<NewsItem | null>(null);
  const [racing, setRacing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [giftTo, setGiftTo] = useState('');
  const [giftItem, setGiftItem] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.news().then(r => setNews(r.news)).catch(() => {});
    api.race().then(r => { setBoard(r.data); onState(r); }).catch(() => {});
  }, [onState]);
  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const unread = p.inbox.filter(m => !m.read).length;
  useEffect(() => {
    if (!unread) return;
    const id = setTimeout(() => api.inboxRead().then(onState).catch(() => {}), 4000);
    return () => clearTimeout(id);
  }, [unread, onState]);

  const copy = async (text: string, ok: string) => {
    try { await navigator.clipboard.writeText(text); setMsg({ text: ok }); } catch { setMsg({ text: text }); }
  };
  // presentes: itens de diamante que dá para comprar na loja
  const giftable = DIAMOND_ITEMS.filter(i => i.kind === 'cosmetic' && !i.exclusive && !i.rare && (i.priceDiamonds ?? 0) > 0);
  const chosen = giftable.find(i => i.id === giftItem);

  const sendGift = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api.gift(giftTo, giftItem); onState(r); setMsg({ text: `Presente entregue para ${r.data.to}: ${r.data.item}.` }); setGiftItem(''); }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
    finally { setBusy(false); }
  };

  return (
    <div className="panel city">
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}

      {p.inbox.length > 0 && (
        <div className="card inbox">
          <h3>Recados {unread > 0 && <span className="badge boost">{unread} novo{unread > 1 ? 's' : ''}</span>}</h3>
          {p.inbox.slice(0, 5).map(m => <p key={m.id} className={m.read ? 'small muted' : 'small'}>{m.text} <time>{ago(m.at, now)}</time></p>)}
        </div>
      )}

      <div className="card race-card">
        <div className="row">
          <h3>Corrida no Autódromo</h3>
          <button onClick={() => setRacing(true)}>Correr</button>
        </div>
        <p className="small muted">{RACE.seconds} s desviando do trânsito. Seu recorde: <b>{board?.best ?? p.stats.raceBest ?? 0} m</b>. Corridas pagas hoje: {board?.runsLeft ?? RACE.rewardedRunsPerDay} de {RACE.rewardedRunsPerDay}. O tuning do seu carro aparece na pista.</p>
        {board && board.top.length > 0 && (
          <ol className="ranking">
            {board.top.map((r, i) => <li key={i} className={r.me ? 'me' : ''}><span>{r.nick}</span><span>{r.best} m</span></li>)}
          </ol>
        )}
      </div>

      <h3>Jornal da Costa Dourada</h3>
      <div className="news">
        {news.length === 0 && <p className="muted small">Cidade calma demais. Faça a primeira manchete.</p>}
        {news.map(n => (
          <article key={n.id} className={`news-item ${n.kind}`}>
            <p>{n.text}</p>
            <div className="row">
              <time className="small muted">{ago(n.at, now)}</time>
              <button className="small ghost" onClick={() => setHeadline(n)}>Compartilhar manchete</button>
            </div>
          </article>
        ))}
      </div>

      <div className="card invite">
        <h3>Chame a galera</h3>
        <p className="small">Quem entra pelo seu convite ganha {formatCash(REFERRAL.newcomerCash)} e {REFERRAL.newcomerDiamonds} diamantes. Quando a pessoa chegar ao nível {REFERRAL.rewardLevel}, você ganha {REFERRAL.inviterDiamonds} diamantes. Amigos que chegaram lá: <b>{p.referral.rewarded}</b>.</p>
        <div className="row">
          <span>Seu código: <b className="code">{p.referral.code}</b></span>
          <button className="small" onClick={() => copy(`Entra na minha gangue no ${location.host}: ${inviteUrl(p.referral.code)}`, 'Link de convite copiado.')}>Copiar link</button>
          <button className="small ghost" onClick={() => onProfile(p.referral.code)}>Ver minha ficha</button>
        </div>
      </div>

      <div className="card gift">
        <h3>Dar um presente</h3>
        <p className="small muted">Escolha um visual e mande para um amigo pelo código da ficha dele. Presentes saem dos diamantes comprados. Para dar um mês de Clube Rockeiro, use "Dar de presente" na Loja.</p>
        <div className="row">
          <input value={giftTo} onChange={e => setGiftTo(e.target.value.toUpperCase())} maxLength={16} placeholder="Código do amigo" aria-label="Código do amigo" />
          <select value={giftItem} onChange={e => setGiftItem(e.target.value)} aria-label="Presente">
            <option value="">Escolha o item…</option>
            {giftable.map(i => <option key={i.id} value={i.id}>{i.name} · {i.priceDiamonds}◆</option>)}
          </select>
          {chosen && <ItemPreview item={chosen} size={48} />}
          <button className="small" disabled={busy || !giftTo || !chosen || p.diamondsPaid < (chosen?.priceDiamonds ?? 0)} onClick={sendGift}>Presentear</button>
        </div>
        {chosen && p.diamondsPaid < (chosen.priceDiamonds ?? 0) && <p className="small muted">Você tem {p.diamondsPaid} diamantes comprados.</p>}
        {chosen && ownsItem(p, chosen.id) && <p className="small muted">Você também tem esse.</p>}
      </div>

      {racing && <RaceModal p={p} onState={onState} onClose={() => { setRacing(false); load(); }} />}
      {headline && (
        <ShareImage title="Manchete" filename="jornal-costa-dourada.png"
          text={`${headline.text} — Jornal da Costa Dourada. Entra também: ${inviteUrl(p.referral.code)}`}
          make={() => renderHeadline(headline, p.referral.code)} onClose={() => setHeadline(null)} />
      )}
    </div>
  );
}
