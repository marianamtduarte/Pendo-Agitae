# Pagamentos

## Como funciona hoje (modo teste)
`PAYMENT_MODE=test` (padrão em desenvolvimento) usa um **provedor simulado**:

1. `POST /orders/:id/pay` cria uma cobrança `pendente` (idempotente: reaproveita a cobrança em aberto do pedido).
2. A tela `/#/pagamento-teste/:id` deixa o usuário **simular** aprovação ou recusa. Isso gera um evento e o entrega ao mesmo código do webhook real (`processPaymentEvent`).
3. O pedido só vira `confirmado` quando o evento `payment.approved` chega **e** o valor bate com o total calculado pelo servidor **e** a data ainda tem capacidade (transação `BEGIN IMMEDIATE`). Caso contrário o pagamento é estornado.
4. Estornos: cancelamento do cliente (política 100/50/0%), decisão de disputa e data indisponível. Repasse (`payouts`) nasce `pendente` ao concluir o pedido; o admin "libera" (simulado).

Nada aprova pagamento automaticamente. **Em `PAYMENT_MODE=live` nenhuma cobrança é aprovada sem o provedor real**: enquanto o adaptador não existir, `POST /orders/:id/pay` responde 503 explicando o que falta.

## O que falta para ativar pagamentos reais
1. **Contratar um provedor com split/marketplace para o Brasil**, por exemplo Mercado Pago (Marketplace), Pagar.me (Recebedores/split), Asaas (subcontas) ou Stripe Connect. Todos exigem CNPJ da Agitaê e KYC dos fornecedores (subcontas/recebedores).
2. Definir `PAYMENT_PROVIDER` e `PAYMENT_API_KEY` no ambiente (nunca no frontend).
3. Implementar o adaptador em `server/payments.js`: `createCharge` (Pix/cartão/boleto com `external_id`, valor e split de comissão), `refundCharge` e mapeamento dos eventos do provedor para `payment.approved|failed|refunded` (a rota `POST /api/webhooks/payments` já valida assinatura, idempotência e valor — ajuste a verificação de assinatura ao formato do provedor).
4. Cadastrar a URL do webhook no painel do provedor: `https://SEU_DOMINIO/api/webhooks/payments` e definir `PAYMENT_WEBHOOK_SECRET`.
5. Repasses: usar o split/transferência do provedor no lugar de `POST /admin/payouts/:id/pay` (que é bloqueado em `live`). Regras de prazo/multa (ex.: repasse da comissão em até 3 dias úteis) são decisões comerciais a definir com o provedor.
6. Revisão fiscal (NFS-e/ISS sobre a comissão) e termos de uso para clientes e fornecedores.
