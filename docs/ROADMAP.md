# O que ainda não está implementado

Honestidade sobre o estado atual (versão 0.1):

- **Pagamentos reais e repasses** — só modo teste (veja `PAYMENTS.md`).
- **E-mail real** — notificações por e-mail vão para a caixa de saída (`emails`); falta enviar via SMTP.
- **Geocodificação/CEP completo** — CEP resolve por faixas para 7 cidades de demonstração; em produção use ViaCEP/geocoding e uma base de cidades completa.
- **Vídeos do portfólio** — apenas links `https` (sem upload/embed de vídeo).
- **Verificação de documentos** — o campo CPF/CNPJ é coletado, mas a verificação é manual pelo admin.
- **Mensagens em tempo real** — a conversa é por recarga/consulta (sem WebSocket) e "Conversar" abre o pedido de orçamento (não há chat pré-contratação).
- **Planos de assinatura** (Premium do fornecedor R$ 49,90; Agitaê+ Vantagens R$ 9,90 com pontos) — o plano Premium existe como atributo com comissão/selo/destaque, mas **sem cobrança de assinatura**. Programa de pontos e vouchers não implementados.
- **Pacotes de identidade visual** e **app mobile nativo** (Android/iOS) do plano de negócio.
- **Expiração automática** de propostas/pedidos parados (hoje a validade é checada ao aceitar) e lembretes agendados.
- **Multi-instância**: SQLite em um processo.
