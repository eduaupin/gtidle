import { DIAMOND_ITEMS, RULES, formatCash, isJailed, isVip, lawyerCost, totalDiamonds, type Action, type PlayerState } from '@gti/shared';
import { useNow } from './Hud';

const ESCAPE = DIAMOND_ITEMS.find(i => i.id === 'rota_fuga')!;
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** "Barra suja" (3 estrelas) e a espera no esconderijo, em cima do mapa. */
export default function HideoutCard({ p, act, onShop }: { p: PlayerState; act: (a: Action) => void; onShop: () => void }) {
  const now = useNow(250);
  if (isJailed(p, now)) return null;
  const vip = isVip(p, now);
  const h = p.hideout;

  if (h) {
    const left = Math.max(0, Math.ceil((h.until - now) / 1000));
    const ready = left === 0;
    const total = (h.until - h.since) / 1000;
    return (
      <section className={`hide-card ${ready ? 'ready' : ''}`} role="status">
        <div className="hide-icon" aria-hidden="true">{ready ? '✓' : 'Zz'}</div>
        <div className="alert-body">
          <h3>{ready ? 'A barra esfriou' : 'Gangue escondida no esconderijo'}</h3>
          {ready
            ? <p>A polícia perdeu o rastro. Mande a gangue de volta para os mesmos assaltos.</p>
            : <p>Procurado esfriando. Dá para voltar ao corre em <strong>{clock(left)}</strong>.{vip && ' O Clube Rockeiro volta sozinho.'}</p>}
          {!ready && <div className="bar"><div style={{ width: `${(1 - left / total) * 100}%` }} /></div>}
          <div className="alert-actions">
            {ready
              ? <button onClick={() => act({ type: 'leaveHideout' })}>Voltar ao corre</button>
              : <button className="ghost" disabled={totalDiamonds(p) < ESCAPE.priceDiamonds}
                  onClick={() => act({ type: 'buyDiamondItem', itemId: ESCAPE.id })}>
                  {ESCAPE.name}: sair agora ({ESCAPE.priceDiamonds} diamantes)
                </button>}
            {!ready && totalDiamonds(p) < ESCAPE.priceDiamonds && <button className="ghost" onClick={onShop}>Comprar diamantes</button>}
          </div>
        </div>
      </section>
    );
  }

  if (!p.heatWarning) return null;
  const toJail = Math.max(0, Math.ceil(100 - p.heat));
  return (
    <section className="heat-card" role="alert" aria-live="assertive">
      <div className="stars-big" aria-label="3 estrelas">★★★</div>
      <div className="alert-body">
        <h3>Barra suja: a polícia está fechando o cerco</h3>
        <p>
          Esconda a gangue na base por {vip ? RULES.hideoutMinutesVip : RULES.hideoutMinutes} minutos, ou ela vai presa e tudo para por 10 minutos.
          Faltam <strong>{toJail} pontos</strong> de procurado para a cadeia.
        </p>
        <div className="bar heat-bar"><div style={{ width: `${p.heat}%` }} /></div>
        <div className="alert-actions">
          <button onClick={() => act({ type: 'goHideout' })}>Ir para o esconderijo</button>
          <button className="ghost" onClick={() => act({ type: 'payLawyer' })}>Pagar advogado ({formatCash(lawyerCost(p))})</button>
        </div>
        {!vip && <p className="small muted">No Clube Rockeiro a espera é de {RULES.hideoutMinutesVip} minutos e a gangue volta sozinha.</p>}
      </div>
    </section>
  );
}
