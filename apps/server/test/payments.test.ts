import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

describe('pagamentos Pix', () => {
  it('modo dev gera QR e copia-e-cola sem chamar o Mercado Pago', async () => {
    vi.resetModules();
    delete process.env.MP_ACCESS_TOKEN;
    const { createPix, paymentsLive } = await import('../src/payments');
    expect(paymentsLive()).toBe(false);
    const pix = await createPix({ orderId: 'abc', amount: 29.9, description: 'teste', email: 'a@b.com' });
    expect(pix.qrCode).toContain('abc');
    expect(pix.qrCodeBase64.length).toBeGreaterThan(100);
    expect(pix.expiresAt).toBeGreaterThan(Date.now());
  });

  it('valida a assinatura do webhook', async () => {
    vi.resetModules();
    process.env.MP_WEBHOOK_SECRET = 'segredo';
    const { verifyWebhookSignature } = await import('../src/payments');
    const ts = '1704908010';
    const v1 = createHmac('sha256', 'segredo').update(`id:123;request-id:req-1;ts:${ts};`).digest('hex');
    expect(verifyWebhookSignature(`ts=${ts},v1=${v1}`, 'req-1', '123')).toBe(true);
    expect(verifyWebhookSignature(`ts=${ts},v1=${v1}`, 'req-1', '999')).toBe(false);
    expect(verifyWebhookSignature(undefined, 'req-1', '123')).toBe(false);
    delete process.env.MP_WEBHOOK_SECRET;
  });
});

describe('cartão (Stripe)', () => {
  it('modo teste cria pedido sem chamar o Stripe e converte para centavos', async () => {
    vi.resetModules();
    delete process.env.STRIPE_SECRET_KEY;
    const { createCardCheckout, stripeLive, toCents } = await import('../src/stripe');
    expect(stripeLive()).toBe(false);
    const c = await createCardCheckout({ orderId: 'x1', amount: 6.99, currency: 'USD', productName: 'teste' });
    expect(c.url).toBeNull();
    expect(c.sessionId).toBe('dev-x1');
    expect(toCents(6.99)).toBe(699);
    expect(toCents(29.9)).toBe(2990);
  });

  it('todo produto tem preço em real e em dólar', async () => {
    const { REAL_MONEY_PRODUCTS, priceIn } = await import('@gti/shared');
    for (const p of REAL_MONEY_PRODUCTS) {
      expect(priceIn(p, 'BRL')).toBeGreaterThan(0);
      expect(priceIn(p, 'USD')).toBeGreaterThan(0);
    }
  });
});
