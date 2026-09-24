# API do Agitaê

Base: `/api`. JSON em UTF-8. Valores monetários **sempre em centavos** (`*_cents`). Datas `YYYY-MM-DD`.

**Autenticação**: cookie de sessão `agitae_sid` (HttpOnly) obtido em `POST /auth/login`. Toda requisição que **escreve** (POST/PUT/PATCH/DELETE) precisa do cabeçalho `X-Requested-With: agitae` (defesa CSRF), exceto o webhook (assinado). Erros: `{ "error": "mensagem em português" }` com status 4xx/5xx. Papéis: `cliente`, `fornecedor`, `admin` (um usuário pode ter vários).

Legenda de acesso: 🌐 público · 🔑 logado · 🏪 fornecedor · 🛡️ admin.

## Público
| | Endpoint | Descrição |
|---|---|---|
| 🌐 | `GET /config` | Categorias ativas, cidades, banners, tipos de festa, modo de pagamento, data de hoje |
| 🌐 | `GET /categories` | Categorias ativas |
| 🌐 | `GET /locations/resolve?q=` ou `?lat=&lng=` | Resolve CEP (8 dígitos), cidade ou bairro |
| 🌐 | `GET /search` | Busca de fornecedores. Query: `q`, `category` (slug), `loc` (CEP/cidade/bairro) ou `lat`+`lng`, `date`, `available=1`, `event_type`, `min_price`/`max_price` (R$), `min_rating`, `sort` = `relevancia\|preco_asc\|preco_desc\|avaliacao`. Resposta: `location`, `total`, `results[]` (cartões), `empty_reason` (`sem_fornecedores_na_regiao\|local_desconhecido\|sem_resultados`), `other_cities` |
| 🌐 | `GET /providers/:slug?date=` | Perfil completo: catálogo por categoria (com adicionais), portfólio, avaliações, áreas, disponibilidade na data |
| 🌐 | `GET /providers/:slug/unavailable` | Datas indisponíveis (400 dias) |
| 🌐 | `GET /services/:id` | Detalhe de um serviço |
| 🌐 | `GET /invites/:token` · `POST /invites/:token/rsvp` | Convite público e confirmação de presença `{name,status:vou\|talvez\|nao_vou,companions}` |
| 🌐 | `GET /health` | Verificação de saúde |

## Conta
`POST /auth/register {name,email,password(≥8),phone?,consent:true}` · `POST /auth/login {email,password}` · `POST /auth/logout` · `GET /me` · `PATCH /me` · `GET /me/export` (LGPD) · `POST /me/delete {password}` (LGPD, anonimiza) · `GET/POST/DELETE /favorites[/:providerId]` · `GET /notifications` · `POST /notifications/read`

## Cliente 🔑
- **Eventos**: `GET/POST /events`, `GET/PATCH/DELETE /events/:id` (GET traz resumo consolidado, convite e RSVPs), `POST /events/:id/items {service_id,qty,option_ids[]}`, `DELETE /events/:id/items/:itemId`, `POST /events/:id/invite {title,message}`
- **Orçamentos**: `POST /quotes {provider_id,service_id?,event_id?,date,location,city,duration,guests,notes}` · `GET /quotes` · `GET /quotes/:id` · `POST /quotes/:id/accept {proposal_id}` (gera pedido `aguardando_pagamento`) · `POST /quotes/:id/cancel`
- **Pedidos**: `POST /orders/preview {provider_id,items[{service_id,qty,option_ids}],city,coupon,event_date}` (preço calculado no servidor; não revela comissão) · `POST /orders {…, event_date,address,city,notes,event_id?}` · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` · `POST /orders/:id/dispute {reason}` · `POST /orders/:id/pay` · `POST /orders/:id/review {rating,comment}`
- **Mensagens**: `GET/POST /threads/:kind/:id/messages` (`kind` = `order|quote`; participantes e admin)
- **Uploads**: `POST /uploads` — corpo binário com `Content-Type: image/jpeg|png|webp`, máx. 3 MB → `{url}`

## Fornecedor 🏪
`POST /provider/register` (🔑, cria cadastro **pendente**) · `GET/PATCH /provider/me` · `PUT /provider/areas` · `GET/POST /provider/services` · `PATCH/DELETE /provider/services/:id` (inclui `options[]`) · `POST/DELETE /provider/media` · `GET /provider/agenda?month=YYYY-MM` · `PUT /provider/blocks {date,blocked,reason}` · `GET /provider/quotes` · `POST /provider/quotes/:id/proposal {price_cents,details,conditions,valid_until}` · `POST /provider/quotes/:id/decline` · `GET /provider/orders` · `POST /orders/:id/accept|decline|start|complete` · `GET /provider/reviews` · `POST /provider/reviews/:id/reply` · `GET /provider/metrics?from&to` · `GET /provider/payouts`

## Pagamentos
| Endpoint | Descrição |
|---|---|
| `POST /orders/:id/pay` | Cria (ou reaproveita — idempotente) a cobrança do pedido `aguardando_pagamento`. Em `PAYMENT_MODE=live` sem credenciais responde **503** |
| `GET/POST /pay/test/:externalId` | **Somente modo teste**. `POST {result:approved\|failed, method}` gera um evento e o processa pelo mesmo código do webhook |
| `POST /webhooks/payments` | Evento do provedor. Cabeçalho `x-agitae-signature` = HMAC-SHA256 (hex) do corpo bruto com `PAYMENT_WEBHOOK_SECRET`. Corpo: `{id, type: payment.approved\|payment.failed, external_id, amount_cents, method?}`. Idempotente por `id`; valor conferido contra o pedido |

## Administração 🛡️
`GET /admin/metrics` · `GET /admin/providers[?status]` · `POST /admin/providers/:id {status?,verified?,plan?,commission_bps?}` · `GET /admin/services` · `POST /admin/services/:id/hide` · `GET /admin/media` · `POST /admin/media/:id/hide` · `GET /admin/reviews` · `POST /admin/reviews/:id {status}` · `GET /admin/users` · `POST /admin/users/:id {roles}` · `GET /admin/orders` · `POST /admin/orders/:id/resolve {resolution:reembolsar|liberar,note}` · `POST /admin/orders/:id/refund` · `GET/POST/PATCH /admin/categories` · `GET/POST/PATCH /admin/coupons` · `GET/POST/PATCH/DELETE /admin/banners` · `GET/PUT /admin/settings {commission_bps,premium_commission_bps,customer_fee_bps}` · `GET /admin/payments` · `POST /admin/payouts/:id/pay` (modo teste) · `GET /admin/audit` · `GET /admin/emails`

Ações administrativas relevantes são gravadas em `audit_log`.
