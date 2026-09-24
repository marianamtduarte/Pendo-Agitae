# Agitaê

Marketplace brasileiro para organizar e contratar serviços de festas e eventos. O cliente informa **onde e quando** será a festa, compara fornecedores da região, vê catálogo e preços, pede orçamento ou contrata, e acompanha o pedido. Fornecedores têm painel próprio; a administração aprova, modera e configura a comissão.

> Frase: *Organize sua festa de forma rápida e fácil.* · Identidade: azul `#2956D9`, laranja `#FF7C00`.

## Stack

- **Node.js ≥ 22.13** (testado no 24) — servidor HTTP próprio, **zero dependências npm** (não precisa de `npm install`).
- **SQLite** embutido (`node:sqlite`) com migrações SQL versionadas (`server/migrations`).
- **Frontend** em JavaScript puro (ES modules, sem build): SPA com rotas por hash, acessível e responsiva.

## Executar localmente

```bash
cp .env.example .env      # opcional: os padrões já funcionam
npm run seed              # (re)cria o banco com dados fictícios de demonstração
npm start                 # http://localhost:3000
```

Se o banco estiver vazio, `npm start` já carrega os dados de demonstração (fora de produção).

Contas de demonstração (senha **`agitae123`**):

| Papel | E-mail |
|---|---|
| Cliente | `cliente@agitae.test` (também `bruno@…`, `carla@…`) |
| Fornecedor | `doce-sabor-confeitaria@agitae.test`, `luz-e-cor-fotografia@agitae.test`, `clara-mendes-fotografia@agitae.test`, `cerimonial-encanto@agitae.test` … (um por fornecedor: `<slug>@agitae.test`) |
| Administrador | `admin@agitae.test` |

Todas as imagens são SVGs gerados e marcados como **"Imagem fictícia de demonstração"**.

## Testes

```bash
npm test
```

Sobe a aplicação com banco em memória e percorre as jornadas abaixo pela API real, além de segurança, webhook e reserva duplicada.

## Jornadas de demonstração

1. **Doces e salgados por local** — na home informe `Mooca` (ou um CEP de São Paulo, como `03101-000`) → categoria *Doces e salgados* → **Doce Sabor Confeitaria** → catálogo completo (doces, bolos e lembrancinhas, com adicionais, mínimo, antecedência e políticas). Tente `Campinas` para ver o estado "ainda não chegamos por aí".
2. **Fotógrafos disponíveis numa data** — categoria *Fotografia*, local *São Paulo*, data = **hoje + 30 dias**, marque "só disponíveis": *Luz e Cor* aparece ocupada (agenda cheia). Em *Rio de Janeiro*, abra **Clara Mendes** → "Pedir orçamento".
3. **Criar festa e juntar fornecedores** — em qualquer serviço use **+ Planejamento** → nova festa → repita com outros fornecedores → *Meus eventos* mostra total previsto, orçamento, o que falta contratar e convite com RSVP.
4. **Fornecedor responde orçamento** — entre como `clara-mendes-fotografia@agitae.test` → *Solicitações* → enviar proposta; o cliente vê em *Orçamentos* (com comparação) e aceita.
5. **Admin aprova fornecedor** — `admin@agitae.test` → *Fornecedores* → filtro *pendente* → aprovar **Festas do Zé Brinquedos** (passa a aparecer em Campinas); acompanhe pedidos em *Pedidos e disputas*.
6. **Contratação em ambiente de teste** — contrate um item fechado (ex.: *Brigadeiro gourmet*): cliente envia → fornecedor **aceita** → cliente **paga** (tela de pagamento de teste) → `confirmado` → fornecedor *inicia* e *conclui* → cliente avalia → admin modera e libera repasse.

## Regras de negócio principais

- **Preço** (itens, adicionais, deslocamento, desconto, taxas, total, comissão e valor líquido) é calculado **somente no servidor**. O cliente nunca vê a comissão; o fornecedor vê o líquido antes de aceitar.
- **Comissão** inicial **7,5%** (`settings.commission_bps = 750`), configurável no admin; plano Premium 7% (`premium_commission_bps`); e comissão específica por fornecedor. Pedidos guardam a comissão vigente na criação.
- **Tipos de preço**: `fechado`, `a_partir_de`, `orcamento`.
- **Disponibilidade** é *informativa* até o pagamento. Só pedidos `confirmado`/`em_preparacao`/`concluido` ocupam a capacidade diária; a checagem final ocorre dentro de uma transação `BEGIN IMMEDIATE` ao confirmar o pagamento — se a data lotou, o pagamento é **estornado** e o pedido cancelado.
- **Estados do pedido**: solicitado → aguardando_resposta → (proposta_enviada) → aguardando_pagamento → confirmado → em_preparacao → concluido; ou cancelado / em_disputa. Um pedido por fornecedor; o evento consolida.
- **Cancelamento pelo cliente**: reembolso 100% (≥7 dias), 50% (2–6 dias), 0% (<2 dias).
- **Área de atendimento**: por cidade, bairro, faixa de CEP ou raio; a busca casa a localização do cliente com essas áreas (não só com a distância até o endereço).
- **Avaliações**: só de pedidos concluídos, moderadas pela administração, com resposta do fornecedor.
- **Convites**: link público separado; expõe apenas o convite e recebe RSVP — nunca pedidos ou pagamentos.

## Segurança e LGPD

Senhas com scrypt; sessões em cookie `HttpOnly`/`SameSite=Lax` (token guardado só como hash); cabeçalho anti-CSRF nas escritas; CSP restritiva e demais cabeçalhos; rate limit; validação no servidor; uploads limitados (3 MB, verificação de assinatura JPG/PNG/WebP, nome aleatório, `nosniff`); webhook com HMAC e idempotência; auditoria de ações administrativas. LGPD: consentimento no cadastro, política em `/#/privacidade`, exportação e exclusão (anonimização) em *Minha conta*, retenção fiscal de 5 anos. O texto da política é um **modelo** que precisa de revisão jurídica.

## Documentação

- [`docs/API.md`](docs/API.md) — endpoints
- [`docs/PAYMENTS.md`](docs/PAYMENTS.md) — pagamentos: modo teste e o que falta para ativar o real
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — publicação, backups, monitoramento
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — o que ainda não está implementado

## Estrutura

```
server/       index.js (boot) · app.js (HTTP, sessão, segurança) · routes.js (API) · domain.js (busca, preço, pedidos, pagamentos)
              payments.js · db.js · util.js · seed.js · migrations/*.sql
public/       index.html · styles.css · js/{core,app,pages-*}.js
test/         e2e.test.js      scripts/backup.js
```
