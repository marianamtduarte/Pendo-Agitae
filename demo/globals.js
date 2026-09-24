// Globais do Node que o código do servidor espera encontrar (injetadas pelo esbuild).
export { Buffer } from 'buffer';
export const process = { env: { NODE_ENV: 'demo', PAYMENT_MODE: 'test', PUBLIC_URL: '', PAYMENT_WEBHOOK_SECRET: 'demo-webhook-secret' }, argv: [], platform: 'browser' };
