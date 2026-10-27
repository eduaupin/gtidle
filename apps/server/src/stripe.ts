// Cartão internacional e nacional pelo Stripe Checkout (página de pagamento hospedada pelo Stripe:
// cartões do mundo todo, Apple Pay e Google Pay). O valor cai no saldo Stripe e é transferido
// para a conta bancária cadastrada no painel.
// Sem STRIPE_SECRET_KEY, roda em modo de teste: o pedido fica pendente e é aprovado pelo botão de simular.
import Stripe from 'stripe';
import type { Currency } from '@gti/shared';

const KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PUBLIC_URL = process.env.PUBLIC_URL ?? 'http://localhost:5173';

const stripe = KEY ? new Stripe(KEY) : null;

export const stripeLive = () => Boolean(stripe);

/** Valor em centavos (o Stripe trabalha com a menor unidade da moeda). */
export const toCents = (amount: number) => Math.round(amount * 100);

export async function createCardCheckout(opts: {
  orderId: string; amount: number; currency: Currency; productName: string; email?: string;
}): Promise<{ sessionId: string; url: string | null }> {
  if (!stripe) return { sessionId: `dev-${opts.orderId}`, url: null };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: opts.currency.toLowerCase(),
        unit_amount: toCents(opts.amount),
        product_data: { name: opts.productName },
      },
    }],
    client_reference_id: opts.orderId,
    metadata: { orderId: opts.orderId },
    customer_email: opts.email,
    success_url: `${PUBLIC_URL}/?pedido=${opts.orderId}`,
    cancel_url: `${PUBLIC_URL}/?pedido=${opts.orderId}&cancelado=1`,
  });
  return { sessionId: session.id, url: session.url };
}

export interface CardPaymentInfo { paid: boolean; orderId: string | null; amountCents: number | null; currency: string | null; expired: boolean }

/** Consulta a sessão direto no Stripe. Só "paid" libera o item. */
export async function fetchCheckout(sessionId: string): Promise<CardPaymentInfo> {
  if (!stripe) throw new Error('Stripe não configurado');
  const s = await stripe.checkout.sessions.retrieve(sessionId);
  return {
    paid: s.payment_status === 'paid',
    orderId: s.metadata?.orderId ?? s.client_reference_id ?? null,
    amountCents: s.amount_total,
    currency: s.currency ? s.currency.toUpperCase() : null,
    expired: s.status === 'expired',
  };
}

/** Valida a assinatura do webhook (cabeçalho stripe-signature) com o corpo cru da requisição. */
export function parseStripeWebhook(rawBody: string, signature: string | undefined) {
  if (!stripe || !WEBHOOK_SECRET) throw new Error('Webhook do Stripe não configurado');
  if (!signature) throw new Error('Sem assinatura');
  return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
}
