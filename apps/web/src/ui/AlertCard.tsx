import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ROBBERIES, RULES, isVip, type PlayerState } from '@gti/shared';
import { api, type StateResponse } from '../api';
import { showRewardedAd, adsConfigured } from '../ads';
import { useNow } from './Hud';

const pct = (m: number) => `${Math.round(m * 100)}%`;
const bonus = `+${Math.round((RULES.boostMult - 1) * 100)}%`;

/** Aviso "seu roubo está sendo monitorado", em cima do mapa. */
export default function AlertCard({ p, onState, onVip, onShop }: {
  p: PlayerState;
  onState: (r: StateResponse) => void;
  onVip: () => void;
  onShop: () => void;
}) {
  const now = useNow(250);
  const [ad, setAd] = useState<{ left: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const a = p.alert;
  if (!a) return null;
  const job = ROBBERIES.find(r => r.id === a.jobId);
  const vip = isVip(p, now);
  const left = Math.max(0, Math.ceil((a.expiresAt - now) / 1000));
  const missed = a.status === 'missed';

  const watchAd = async () => {
    setError('');
    try {
      const { token, minSec } = await api.adStart();
      const started = Date.now();
      const result = await showRewardedAd();
      if (result === 'dismissed') { setError('O anúncio foi fechado antes do fim. A polícia continua de olho.'); return; }
      // Sem anúncio disponível (ou modo de teste): espera curta no lugar, para não travar o jogador.
      const waitMs = minSec * 1000 - (Date.now() - started);
      if (waitMs > 0) {
        await new Promise<void>(res => {
          const total = Math.ceil(waitMs / 1000);
          setAd({ left: total, total });
          const t0 = Date.now();
          const id = setInterval(() => {
            const l = Math.max(0, total - Math.floor((Date.now() - t0) / 1000));
            setAd({ left: l, total });
            if (Date.now() - t0 >= waitMs) { clearInterval(id); res(); }
          }, 200);
        });
      }
      setAd(null);
      onState(await api.adComplete(token));
    } catch (e) { setAd(null); setError((e as Error).message); }
  };

  return (
    <>
      <section className={`alert-card ${missed ? 'missed' : ''}`} role="alert" aria-live="assertive">
        <div className="siren" aria-hidden="true"><span /><span /></div>
        <div className="alert-body">
          <h3>{missed ? 'A polícia está na sua cola' : 'Seu roubo está sendo monitorado'}</h3>
          <p>
            {missed
              ? <>“{job?.name}” virou golpe fraco: rende só {pct(RULES.weakMult)} até você despistar.</>
              : <>A polícia está de olho em “{job?.name}”. Despiste em <strong>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong> ou o golpe fica fraco ({pct(RULES.weakMult)} da recompensa).</>}
          </p>
          <div className="alert-actions">
            {vip
              ? <button onClick={onVip}>Despistar agora ({bonus} por {RULES.boostMinutes} min)</button>
              : <>
                  <button onClick={watchAd}>Assistir anúncio e despistar</button>
                  <button className="ghost" onClick={onShop}>Clube Rockeiro: sem anúncio e {bonus}</button>
                </>}
          </div>
          {error && <p className="alert-error">{error}</p>}
        </div>
      </section>

      {ad && createPortal(
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="ad-title">
          <div className="modal ad-wait">
            <h2 id="ad-title">{adsConfigured() ? 'Despistando a polícia' : 'Anúncio de teste'}</h2>
            <p className="muted">
              {adsConfigured()
                ? 'Sem anúncio disponível agora. Sua gangue está trocando de rota.'
                : 'Aqui vai aparecer o anúncio recompensado quando o AdSense estiver configurado.'}
            </p>
            <div className="bar"><div style={{ width: `${(1 - ad.left / ad.total) * 100}%` }} /></div>
            <p className="small muted">{ad.left}s</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
