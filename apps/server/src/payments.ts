// Pix pelo Mercado Pago (API de Pagamentos, /v1/payments).
// O dinheiro cai na conta Mercado Pago dona do MP_ACCESS_TOKEN — a conta precisa ter
// uma chave Pix cadastrada. Sem token, roda em modo de desenvolvimento com um QR falso.
//
// Segurança: nunca confiamos no webhook sozinho. Toda aprovação é confirmada
// consultando o pagamento na API do Mercado Pago com o nosso token.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';

const MP_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET;
const API_URL = process.env.API_PUBLIC_URL ?? '';
const PIX_MINUTES = Number(process.env.PIX_EXPIRATION_MINUTES ?? 30);

export const paymentsLive = () => Boolean(MP_TOKEN);

export interface PixCharge {
  paymentId: string;
  qrCode: string;        // Pix copia e cola
  qrCodeBase64: string;  // imagem PNG em base64
  ticketUrl?: string;
  expiresAt: number;
}

/** Data no formato que a API aceita, com fuso de Brasília: 2026-10-23T21:30:00.000-03:00 */
function brIso(ms: number) {
  const d = new Date(ms - 3 * 3600_000);
  return d.toISOString().replace('Z', '-03:00');
}

export async function createPix(opts: {
  orderId: string; amount: number; description: string; email: string;
}): Promise<PixCharge> {
  const expiresAt = Date.now() + PIX_MINUTES * 60_000;

  if (!MP_TOKEN) {
    // Modo dev: código falso só para a interface ter o que mostrar.
    const fake = `00020126DEV-GRANDTRADEIDLE-${opts.orderId}-R$${opts.amount.toFixed(2)}`;
    const png = await QRCode.toDataURL(fake, { margin: 1, width: 360 });
    return { paymentId: `dev-${opts.orderId}`, qrCode: fake, qrCodeBase64: png.split(',')[1], expiresAt };
  }

  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify({
      transaction_amount: opts.amount,
      description: opts.description,
      payment_method_id: 'pix',
      payer: { email: opts.email },
      external_reference: opts.orderId,
      date_of_expiration: brIso(expiresAt),
      // O Mercado Pago só consegue chamar uma URL pública (https). Em localhost a
      // confirmação acontece pela consulta de status que o jogo faz a cada poucos segundos.
      ...(API_URL.startsWith('https://') ? { notification_url: `${API_URL}/api/webhooks/mercadopago` } : {}),
    }),
  });
  const data = await res.json() as {
    id?: number; message?: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } };
  };
  const tx = data.point_of_interaction?.transaction_data;
  if (!res.ok || !data.id || !tx?.qr_code || !tx.qr_code_base64) {
    throw new Error(`Mercado Pago recusou o Pix: ${data.message ?? res.status}`);
  }
  return { paymentId: String(data.id), qrCode: tx.qr_code, qrCodeBase64: tx.qr_code_base64, ticketUrl: tx.ticket_url, expiresAt };
}

export interface PaymentInfo { status: string; external_reference: string; transaction_amount: number }

/** Consulta o pagamento direto no Mercado Pago. "approved" = dinheiro recebido. */
export async function fetchPayment(paymentId: string): Promise<PaymentInfo> {
  if (!MP_TOKEN) throw new Error('Pagamentos não configurados');
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Mercado Pago respondeu ${res.status}`);
  return await res.json() as PaymentInfo;
}

/**
 * Valida o cabeçalho x-signature do webhook (formato "ts=...,v1=...").
 * Manifesto usado pelos SDKs oficiais: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * assinado com HMAC-SHA256 e a chave secreta do painel (Suas integrações > Webhooks).
 * Confira contra o SDK oficial antes de publicar. Sem MP_WEBHOOK_SECRET, a validação é pulada —
 * o que continua seguro porque toda aprovação é reconfirmada com fetchPayment().
 */
export function verifyWebhookSignature(xSignature: string | undefined, xRequestId: string | undefined, dataId: string) {
  if (!MP_WEBHOOK_SECRET) return true;
  if (!xSignature) return false;
  const parts = Object.fromEntries(xSignature.split(',').map(kv => kv.trim().split('=') as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ''};ts:${parts.ts};`;
  const expected = createHmac('sha256', MP_WEBHOOK_SECRET).update(manifest).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
