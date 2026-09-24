# Pendo (analytics) — como instalar

O Agitaê já está preparado para o Pendo, mas **o snippet e a chave ficam com você** (nada foi instalado).

## 1. Colar o snippet
1. No Pendo: *Settings → Subscription Settings → sua aplicação → Install Settings* e copie o snippet.
2. Cole em `public/index.html`, no lugar do comentário `PENDO` dentro do `<head>`.
3. No `pendo.initialize(...)` do snippet use o visitante do Agitaê (sem nome nem e-mail):
   ```js
   pendo.initialize({
     visitor: { id: window.agitaeVisitor().id, role: window.agitaeVisitor().role },
     account: { id: 'agitae' }
   });
   ```
   `window.agitaeVisitor()` devolve `{ id: 'u<id>' | 'anonymous', role: 'cliente,fornecedor,…' }`. Como o site é uma SPA, chame `pendo.identify(...)` de novo após o login (o site dispara o evento `agitae:user`):
   ```js
   window.addEventListener('agitae:user', () => setTimeout(() => pendo.identify({ visitor: window.agitaeVisitor() }), 300));
   ```
4. Publique de novo (`npm run publish:demo` para o GitHub Pages).

## 2. Eventos já instrumentados
O site chama `window.pendo.track(nome, props)` (só quando o Pendo está carregado; caso contrário não faz nada) e também dispara o evento do navegador `agitae:track`.

| Evento | Quando |
|---|---|
| `page_view` | a cada tela (`path`) |
| `search_performed` | busca na home |
| `category_click`, `provider_card_click` | cliques em categorias e cartões |
| `provider_viewed`, `service_viewed` | perfil e detalhe de serviço |
| `provider_favorited`, `provider_shared` | salvar / compartilhar |
| `add_to_cart`, `checkout_started`, `order_created` | contratação |
| `added_to_plan`, `event_created`, `invite_saved` | planejamento |
| `quote_requested`, `proposal_sent`, `proposal_accepted` | orçamentos |
| `payment_started`, `payment_confirmed` | pagamento (teste) |
| `order_accept/decline/start/complete`, `review_submitted` | ciclo do pedido |
| `login`, `signup`, `provider_registered`, `language_changed` | conta e idioma |

Para adicionar outro: `track('nome_do_evento', { chave: 'valor' })` (importe `track` de `js/core.js`).

## 3. Cuidados
- **LGPD**: a Política de Privacidade já cita o uso de ferramenta de análise. Considere um aviso de consentimento antes de carregar o Pendo e não envie dados pessoais (nome, e-mail, endereço).
- **Servidor Node (não é o GitHub Pages)**: a política de segurança (CSP) em `server/app.js` bloqueia scripts externos. Inclua os domínios do Pendo em `script-src`, `connect-src`, `img-src` e `style-src` (veja a lista oficial: https://support.pendo.io). O GitHub Pages não aplica essa CSP.
