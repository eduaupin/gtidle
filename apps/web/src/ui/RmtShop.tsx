// Vitrine de itens por dinheiro real (RMT): compra com Pix ou cartão, o item cai na mochila na hora.
import { useCallback, useEffect, useState } from 'react';
import { RMT, formatBRL, type PlayerState, type RealMoneyProduct } from '@gti/shared';
import { api, type RmtListingView, type RmtView, type StateResponse } from '../api';
import CheckoutModal from './CheckoutModal';
import { GearCard, gearName } from './Gear';

export default function RmtShop({ p, onState }: { p: PlayerState; onState: (r: StateResponse) => void }) {
  const [v, setV] = useState<RmtView | null>(null);
  const [flags, setFlags] = useState({ pixLive: false, cardLive: false });
  const [buying, setBuying] = useState<RmtListingView | null>(null);
  const load = useCallback(() => api.rmt().then(r => { setV(r.data); onState(r); }).catch(() => {}), [onState]);
  useEffect(() => { load(); api.shop().then(s => setFlags({ pixLive: s.pixLive, cardLive: s.cardLive })).catch(() => {}); }, [load]);
  if (!v) return null;
  const product = buying && ({
    id: `rmt:${buying.id}`, name: `${gearName(buying.item)} (de ${buying.seller})`, kind: 'rmt',
    priceBRL: buying.price, priceUSD: buying.price, grants: {},
  } as unknown as RealMoneyProduct);
  return (
    <section className="rmt-shop">
      <h3>Itens por dinheiro real <span className="badge">{v.enabled ? 'beta' : 'em breve'}</span></h3>
      <p className="small muted">
        Itens que outros jogadores acharam nos assaltos, vendidos em reais (Pix ou cartão). O item chega na sua mochila quando o pagamento é aprovado.
        Para comprar ou vender é preciso ligar uma conta Google ou Discord. O jogo fica com {Math.round(RMT.fee * 100)}% de taxa.
      </p>
      {!v.enabled && <p className="small warn">A venda por dinheiro real ainda não foi liberada neste servidor.</p>}
      {v.enabled && !v.linked && <p className="small warn">Ligue sua conta (botão Conta no topo) para comprar.</p>}
      {v.enabled && v.open.length === 0 && <p className="small muted">Nenhum item à venda agora.</p>}
      <div className="gear-grid">
        {v.open.map(l => (
          <GearCard key={l.id} g={l.item} size={52}>
            <div className="row">
              <span className="price-brl">{formatBRL(l.price)}</span>
              <span className="small muted">de {l.seller}</span>
            </div>
            <button className="small" disabled={!v.linked || !v.enabled} onClick={() => setBuying(l)}>{l.reservedByMe ? 'Continuar pagamento' : 'Comprar'}</button>
          </GearCard>
        ))}
      </div>
      {buying && product && (
        <CheckoutModal product={product} currency="BRL" pixLive={flags.pixLive} cardLive={flags.cardLive} rmtListingId={buying.id}
          onClose={() => { setBuying(null); load(); }} onPaid={() => load()} />
      )}
      {p.level < 0 && null}
    </section>
  );
}
