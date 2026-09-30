# Assistente de descoberta de fornecedores (chat)

Botão flutuante de chat, disponível em qualquer tela do site (não é uma rota — é um componente fixo em `public/js/assistant.js`). Ajuda a pessoa a descrever a festa em texto livre e sugere fornecedores reais do catálogo.

## Como funciona

- O código roda **só no servidor** ([server/assistant.js](../server/assistant.js)); a chave da IA nunca chega ao navegador.
- O modelo (Claude, via API da Anthropic) **nunca responde preço, nome de fornecedor ou disponibilidade de memória**. Toda recomendação passa por uma ferramenta (`buscar_fornecedores`) que chama a mesma busca do site ([server/domain.js](../server/domain.js) `search()`), com os mesmos dados que aparecem em `/#/busca`. Se a busca não achar nada, o assistente diz isso — não inventa alternativa.
- Não processa pagamento nem pede dado de cartão; sempre direciona para os botões "Pedir orçamento" / "Contratar" no perfil do fornecedor.
- Cada conversa fica registrada no banco (`assistant_conversations`, `assistant_messages`), com um ID de conversa por sessão de chat — endereçável e persistente, pronta para alimentar uma ferramenta de análise depois (veja "Pendo Agent Analytics" abaixo).
- Sem `ANTHROPIC_API_KEY` configurada, a rota responde **503** com uma mensagem clara (nunca finge sucesso, mesmo assim é claramente comunicado ao usuário).
- Não funciona na demonstração estática do GitHub Pages (lá não existe servidor para guardar a chave) — o widget mostra a mesma mensagem de "precisa de servidor".

## Ativar

```bash
# no .env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5   # opcional; é o padrão
```

Reinicie o servidor (`npm start`). Teste clicando no botão de chat (canto inferior direito) e perguntando algo como *"bolo para 20 pessoas em São Paulo"*.

## Limites e proteções

- Limite de 20 mensagens por minuto por IP (`server/routes.js`, mesmo mecanismo usado em login/cadastro).
- Mensagem: até 800 caracteres. Conversa: até 12 idas e vindas (24 mensagens) — depois disso, pede para começar uma nova.
- Até 3 chamadas de ferramenta por mensagem (evita loop e custo excessivo).

## Pendo — Agent Analytics

O Pendo tem um recurso específico para acompanhar conversas de agentes de IA (**Agent Analytics**, veja [docs/PENDO.md](PENDO.md) para a instalação geral do Pendo). Ele exige um agente de IA de verdade no produto — agora existe um. Ao cadastrar o agente em *Pendo → Agent Analytics → Add agent*, use:

| Campo | Valor sugerido |
|---|---|
| **Agent name** | Assistente da Agitaê |
| **Agent icon color** | a sua escolha |
| **Agent role** | Concierge de descoberta de fornecedores para festas |
| **Primary users** | Visitantes e clientes do Agitaê buscando fornecedores para uma festa (não exige login) |
| **Agent purpose** | Conversa em linguagem natural sobre a festa (tipo, local, data, orçamento) e recomenda fornecedores reais do catálogo da Agitaê, buscando por categoria/cidade/preço/avaliação. Nunca processa pagamento; direciona para os fluxos de orçamento/contratação já existentes no site. |
| **Application** | a aplicação do Agitaê que você já tem cadastrada no Pendo (mesma do `public/js/pendo.js`) |

**Método de captura**: o Pendo oferece "Prompts only" (marcação visual, sem código) ou "Full conversations" (via **Conversations API**, do lado do servidor). Como o assistente já guarda a conversa inteira no banco, o caminho certo aqui é **Full conversations** — mas o formato exato da chamada (endpoint, payload) não estava disponível nos artigos que consultei. Duas formas de fechar essa última etapa:

1. **Recomendado**: o Pendo distribui uma *skill* oficial chamada `setup-agent-analytics` para quem usa Claude Code — instale-a (nas instruções do próprio Pendo, na tela de cadastro do agente) e me avise: eu termino a integração usando o Agent ID gerado.
2. Ou: depois de criar o agente no Pendo, copie a página de instruções da API de Conversas (endpoint, cabeçalhos, formato do payload) e me envie — eu adiciono uma chamada em [server/assistant.js](../server/assistant.js), logo após salvar a resposta do assistente, enviando `conversation_id`, o texto da pergunta e da resposta e o `agitaeVisitor()` de quem perguntou.

Sem esse último passo, o assistente já funciona normalmente — só não aparece ainda dentro do painel de Agent Analytics do Pendo.
