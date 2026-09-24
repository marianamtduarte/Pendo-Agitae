import crypto from 'node:crypto';
import { HttpError } from './util.js';

/**
 * Camada de pagamentos. Dois modos:
 *  - PAYMENT_MODE=test (padrão em dev): provedor SIMULADO. A "aprovação" só acontece quando alguém usa a tela de
 *    pagamento de teste, que gera um evento assinado igual ao que o provedor real enviaria por webhook.
 *  - PAYMENT_MODE=live: exige PAYMENT_PROVIDER + PAYMENT_API_KEY. Enquanto o adaptador real não for implementado
 *    (ver docs/PAYMENTS.md), as funções abaixo recusam a operação — nunca aprovam pagamentos sozinhas.
 */
export const paymentMode = () => (process.env.PAYMENT_MODE === 'live' ? 'live' : 'test');
export const webhookSecret = () => process.env.PAYMENT_WEBHOOK_SECRET || 'dev-webhook-secret';

function liveNotReady() {
  const missing = [];
  if (!process.env.PAYMENT_PROVIDER) missing.push('PAYMENT_PROVIDER');
  if (!process.env.PAYMENT_API_KEY) missing.push('PAYMENT_API_KEY');
  return new HttpError(503, missing.length
    ? `Pagamentos ainda não ativados: defina ${missing.join(' e ')} (veja docs/PAYMENTS.md).`
    : 'Adaptador do provedor de pagamentos ainda não implementado (veja docs/PAYMENTS.md).');
}

export function createCharge({ orderId, amountCents }) {
  if (paymentMode() === 'live') throw liveNotReady();
  return { provider: 'teste', externalId: 'test_' + crypto.randomBytes(9).toString('hex'), checkoutPath: null, amountCents, orderId };
}

export function refundCharge(/* payment, amountCents */) {
  if (paymentMode() === 'live') throw liveNotReady();
  return { ok: true, externalRefundId: 're_' + crypto.randomBytes(6).toString('hex') };
}

export const sign = (rawBody) => crypto.createHmac('sha256', webhookSecret()).update(rawBody).digest('hex');
export function verifySignature(rawBody, signature) {
  const expected = Buffer.from(sign(rawBody));
  const got = Buffer.from(String(signature || ''));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}
