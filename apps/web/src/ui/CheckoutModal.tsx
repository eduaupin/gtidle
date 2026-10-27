import { useEffect, useState } from 'react';
import { formatPrice, priceIn, type Currency, type RealMoneyProduct } from '@gti/shared';
import { api, type OrderState, type PixCharge } from '../api';

const EMAIL_KEY = 'nh_email';
const readEmail = () => { try { return localStorage.getItem(EMAIL_KEY) ?? ''; } catch { return ''; } };
const saveEmail = (v: string) => { try { localStorage.setItem(EMAIL_KEY, v); } catch { /* sem storage */ } };

/** Consulta o pedido a cada 3 s até ele sair de "pendente". */
export function useOrderStatus(orderId: string | null, onApproved?: () => void) {
  const [status, setStatus] = useState<OrderState>('pending');
  useEffect(() => {
    if (!orderId) return;
    setStatus('pending');
    let stop = false;
    const tick = async () => {
      try {
        const r = await api.order(orderId);
        if (stop) return;
        if (r.status !== 'pending') {
          setStatus(r.status);
          if (r.status === 'approved') onApproved?.();
          return;
        }
      } catch { /* tenta de novo */ }
      if (!stop) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [orderId, onApproved]);
  return status;
}

type Step = 'choose' | 'pix' | 'card-test';

export default function CheckoutModal({ product, currency, pixLive, cardLive, onClose, onPaid }: {
  product: RealMoneyProduct; currency: Currency; pixLive: boolean; cardLive: boolean;
  onClose: () => void; onPaid: () => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState(readEmail);
  const [pix, setPix] = useState<PixCharge | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  // presente: o produto vai para outra conta (Clube e diamantes; pacotes de compra única não)
  const giftable = !product.oneTime;
  const [gift, setGift] = useState(false);
  const [giftTo, setGiftTo] = useState('');
  const to = gift && giftable ? giftTo.trim() || undefined : undefined;
  const status = useOrderStatus(orderId, onPaid);
  const price = formatPrice(priceIn(product, currency), currency);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const payPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      saveEmail(email);
      const charge = await api.pix(product.id, email, to);
      setPix(charge); setOrderId(charge.orderId); setStep('pix');
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const payCard = async () => {
    setError(''); setBusy(true);
    try {
      if (email) saveEmail(email);
      const r = await api.card(product.id, currency, email || undefined, to);
      if (r.checkoutUrl) { window.location.href = r.checkoutUrl; return; } // vai para a página segura do Stripe
      setOrderId(r.orderId); setStep('card-test');
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  const copy = async () => {
    if (!pix) return;
    try { await navigator.clipboard.writeText(pix.qrCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError('Não deu para copiar. Selecione o código e copie manualmente.'); }
  };

  const simulate = () => orderId && api.devApprove(orderId);
  const left = pix ? Math.max(0, Math.floor((pix.expiresAt - now) / 1000)) : 0;
  const done = status === 'approved';
  const failed = status === 'expired' || status === 'rejected';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal checkout ${step === 'pix' ? 'pix' : ''}`}>
        <div className="row">
          <h2 id="checkout-title">{done ? 'Pagamento confirmado' : 'Finalizar compra'}</h2>
          <button className="ghost small" onClick={onClose}>Fechar</button>
        </div>
        <div className="row">
          <strong>{product.name}</strong>
          <span className="price">{price}</span>
        </div>

        {done && <>
          <p className="status ok">{to ? `Presente entregue: ${product.name} já está na conta de ${to}.` : `${product.name} já está na sua conta.`}</p>
          <button onClick={onClose}>Voltar ao jogo</button>
        </>}

        {failed && <>
          <p className="status err">{status === 'expired' ? 'O pagamento expirou sem ser concluído.' : 'O pagamento não foi aprovado.'}</p>
          <button onClick={() => { setOrderId(null); setPix(null); setStep('choose'); }}>Tentar de novo</button>
        </>}

        {!done && !failed && step === 'choose' && <>
          {giftable && (
            <div className="gift-box">
              <label className="check"><input type="checkbox" checked={gift} onChange={e => setGift(e.target.checked)} /> Dar de presente para um amigo</label>
              {gift && <input value={giftTo} maxLength={16} onChange={e => setGiftTo(e.target.value.toUpperCase())} placeholder="Código da ficha do amigo" aria-label="Código do amigo" />}
            </div>
          )}
          <label className="field">
            <span>E-mail para o comprovante</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />
          </label>

          {currency === 'BRL' && (
            <form onSubmit={payPix} className="method">
              <div>
                <b>Pix</b>
                <p className="small muted">Aprovação em segundos. Pague pelo app do seu banco.</p>
                {!pixLive && <p className="small warn">Modo de teste: não cobra de verdade.</p>}
              </div>
              <button className="pay-pix" disabled={busy || !email || (gift && !giftTo.trim())}>Pagar com Pix</button>
            </form>
          )}

          <div className="method">
            <div>
              <b>Cartão de crédito ou débito</b>
              <p className="small muted">
                {currency === 'USD'
                  ? 'Cartões do mundo todo, Apple Pay e Google Pay. Cobrança em dólar.'
                  : 'Visa, Mastercard, Elo, Amex, Apple Pay e Google Pay.'}
              </p>
              {!cardLive && <p className="small warn">Modo de teste: não cobra de verdade.</p>}
            </div>
            <button className="ghost" disabled={busy || (gift && !giftTo.trim())} onClick={payCard}>{busy ? 'Abrindo…' : 'Pagar com cartão'}</button>
          </div>

          {currency === 'USD' && <p className="hint">No Brasil? Mude os preços para R$ na loja para pagar com Pix.</p>}
          <p className="hint">O pagamento com cartão acontece na página segura do Stripe. O jogo nunca vê os dados do seu cartão.</p>
        </>}

        {!done && !failed && step === 'pix' && pix && <>
          <img className="qr" src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code Pix" />
          <p className="muted small">Abra o app do seu banco, escolha Pix e aponte a câmera para o código, ou use o copia e cola.</p>
          <div className="code">
            <input readOnly value={pix.qrCode} aria-label="Código Pix copia e cola" onFocus={e => e.currentTarget.select()} />
            <button onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
          </div>
          <p className="status">Aguardando pagamento. Expira em {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
          {pix.mode === 'dev' && (
            <div className="card">
              <p className="hint warn">Modo de teste: este QR não cobra nada. Configure o Mercado Pago para cobrar de verdade.</p>
              <button className="ghost" onClick={simulate}>Simular pagamento aprovado</button>
            </div>
          )}
        </>}

        {!done && !failed && step === 'card-test' && (
          <div className="card">
            <p className="status">Aguardando pagamento</p>
            <p className="hint warn">Modo de teste: o Stripe não está configurado, então não há página de cartão. Use o botão para simular a aprovação.</p>
            <button className="ghost" onClick={simulate}>Simular pagamento aprovado</button>
          </div>
        )}

        {error && <p className="hint warn" role="alert">{error}</p>}
      </div>
    </div>
  );
}

/** Mostrado quando o jogador volta da página do Stripe (?pedido=...). */
export function OrderReturnModal({ orderId, cancelled, onClose, onPaid }: {
  orderId: string; cancelled: boolean; onClose: () => void; onPaid: () => void;
}) {
  const status = useOrderStatus(cancelled ? null : orderId, onPaid);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="return-title">
      <div className="modal">
        <h2 id="return-title">
          {cancelled ? 'Compra cancelada' : status === 'approved' ? 'Pagamento confirmado' : status === 'pending' ? 'Confirmando pagamento' : 'Pagamento não concluído'}
        </h2>
        {cancelled && <p className="muted">Nada foi cobrado. A loja continua aberta quando quiser.</p>}
        {!cancelled && status === 'pending' && <p className="status">Esperando a confirmação do cartão. Isso leva poucos segundos.</p>}
        {!cancelled && status === 'approved' && <p className="status ok">O item já está na sua conta.</p>}
        {!cancelled && (status === 'expired' || status === 'rejected') && <p className="status err">O pagamento não foi aprovado. Nada foi liberado.</p>}
        <button onClick={onClose}>Voltar ao jogo</button>
      </div>
    </div>
  );
}
