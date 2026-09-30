// Mensagens do servidor (PT → EN). {0}, {1}… são valores dinâmicos; eles também são traduzidos quando conhecidos.
export default {
  // campos (usados dentro de "Preencha o campo …")
  'CPF/CNPJ': 'tax ID (CPF/CNPJ)', 'UF': 'state', 'acompanhantes': 'companions', 'antecedência (dias)': 'lead time (days)', 'bairro': 'neighborhood', 'cancelamento': 'cancellation',
  'capacidade por dia': 'daily capacity', 'categoria': 'category', 'cidade': 'city', 'comentário': 'comment', 'comissão (bps)': 'commission (bps)', 'condições': 'conditions', 'convidados': 'guests',
  'código': 'code', 'data do evento': 'event date', 'data': 'date', 'descrição': 'description', 'detalhes da proposta': 'proposal details', 'duração': 'duration', 'e-mail': 'e-mail',
  'endereço da mídia': 'media address', 'endereço do evento': 'event address', 'endereço': 'address', 'entrega/deslocamento': 'delivery/travel', 'fim': 'end', 'horários': 'opening hours',
  'início': 'start', 'justificativa': 'justification', 'legenda': 'caption', 'limite de usos': 'usage limit', 'link': 'link', 'local do evento': 'event location', 'mensagem': 'message',
  'motivo da disputa': 'dispute reason', 'motivo': 'reason', 'método': 'method', 'nome comercial': 'business name', 'nome da festa': 'party name', 'nome do adicional': 'add-on name',
  'nome do serviço': 'service name', 'nome': 'name', 'nota': 'rating', 'nova senha': 'new password', 'o que está incluído': 'what is included', 'observações': 'notes', 'orçamento': 'budget',
  'política de deslocamento': 'travel policy', 'posição': 'position', 'prazo mínimo': 'minimum notice', 'preço do adicional': 'add-on price', 'preço': 'price', 'quantidade mínima': 'minimum quantity',
  'quantidade': 'quantity', 'raio (km)': 'radius (km)', 'resposta': 'reply', 'senha': 'password', 'seu nome': 'your name', 'taxa de deslocamento': 'travel fee', 'telefone': 'phone',
  'texto': 'text', 'tipo de festa': 'party type', 'tipo de área': 'area type', 'tipo de preço': 'price type', 'tipo': 'type', 'título do convite': 'invitation title', 'título': 'title',
  'unidade': 'unit', 'validade': 'expiry date', 'valor': 'amount', 'ícone': 'icon', 'decisão': 'decision', 'resultado': 'result', 'plano': 'plan', 'status': 'status',

  // validação
  'Preencha o campo "{0}".': 'Please fill in "{0}".', 'Valor inválido em "{0}".': 'Invalid value in "{0}".', '"{0}" precisa ter ao menos {1} caracteres.': '"{0}" must have at least {1} characters.',
  '"{0}" pode ter no máximo {1} caracteres.': '"{0}" can have at most {1} characters.', 'Informe "{0}".': 'Please provide "{0}".', '"{0}" deve ser um número inteiro entre {1} e {2}.': '"{0}" must be a whole number between {1} and {2}.',
  'Data inválida em "{0}".': 'Invalid date in "{0}".', 'E-mail inválido.': 'Invalid e-mail.',

  // gerais / app
  'Não encontrado.': 'Not found.', 'Não encontrado': 'Not found', 'Método não permitido': 'Method not allowed', 'Arquivo ou corpo grande demais.': 'File or request body too large.', 'Muitas requisições. Aguarde um instante.': 'Too many requests. Please wait a moment.',
  'Rota não encontrada.': 'Route not found.', 'Muitas tentativas. Aguarde um minuto.': 'Too many attempts. Please wait a minute.', 'Requisição não permitida.': 'Request not allowed.', 'Entre na sua conta para continuar.': 'Sign in to continue.',
  'Você não tem permissão para isso.': 'You do not have permission to do that.', 'JSON inválido.': 'Invalid JSON.', 'Erro interno. Tente novamente em instantes.': 'Internal error. Please try again shortly.',
  'Você ainda não tem cadastro de fornecedor.': 'You do not have a provider registration yet.', 'Seu cadastro ainda não foi aprovado.': 'Your registration has not been approved yet.',
  'Categoria não encontrada.': 'Category not found.', 'Fornecedor não encontrado.': 'Provider not found.', 'Serviço não encontrado.': 'Service not found.', 'Evento não encontrado.': 'Event not found.',
  'Solicitação não encontrada.': 'Request not found.', 'Pedido não encontrado.': 'Order not found.', 'Pagamento não encontrado.': 'Payment not found.', 'Conversa não encontrada.': 'Conversation not found.',
  'Avaliação não encontrada.': 'Review not found.', 'Convite não encontrado ou desativado.': 'Invitation not found or disabled.',

  // conta
  'É necessário aceitar a Política de Privacidade para criar a conta.': 'You must accept the Privacy Policy to create an account.', 'Este e-mail já está cadastrado. Tente entrar.': 'This e-mail is already registered. Try signing in.',
  'E-mail ou senha incorretos.': 'Incorrect e-mail or password.', 'Senha atual incorreta.': 'Current password is incorrect.', 'Senha incorreta.': 'Incorrect password.',
  'Você tem pedidos em andamento. Conclua ou cancele antes de excluir a conta.': 'You have orders in progress. Complete or cancel them before deleting your account.',
  'Dados fiscais e financeiros de pedidos são mantidos por 5 anos (obrigação legal), sem dados pessoais identificáveis além do necessário.': 'Tax and financial order data is kept for 5 years (legal obligation), with no identifiable personal data beyond what is necessary.',

  // eventos, convites
  'A data da festa não pode estar no passado.': 'The party date cannot be in the past.', 'Serviço indisponível.': 'Service unavailable.', 'Evento inválido.': 'Invalid event.', 'Serviço inválido para este fornecedor.': 'Invalid service for this provider.',

  // orçamentos
  'Você não pode solicitar orçamento ao próprio negócio.': 'You cannot request a quote from your own business.', 'A data do evento não pode estar no passado.': 'The event date cannot be in the past.',
  'Nova solicitação de orçamento': 'New quote request', '{0} pediu um orçamento para {1}.': '{0} requested a quote for {1}.', '{0} (atenção: {1})': '{0} (warning: {1})',
  'Apenas o cliente pode cancelar.': 'Only the customer can cancel.', 'Esta solicitação não pode mais ser cancelada aqui.': 'This request can no longer be canceled here.', 'Esta solicitação não aceita novas propostas.': 'This request does not accept new proposals.',
  'A validade da proposta não pode estar no passado.': 'The proposal expiry date cannot be in the past.', 'Você recebeu uma proposta': 'You received a proposal', '{0} enviou uma proposta de {1} válida até {2}.': '{0} sent a proposal of {1} valid until {2}.',
  'Não é possível recusar neste estado.': 'It is not possible to decline in this state.', 'Solicitação recusada': 'Request declined', '{0} não poderá atender sua solicitação para {1}. {2}': '{0} will not be able to fulfill your request for {1}. {2}',
  'Solicitação de orçamento': 'Quote request', 'Proposta enviada pelo fornecedor': 'Proposal sent by the provider', 'Cliente aceitou a proposta': 'Customer accepted the proposal', 'Proposta aceita': 'Proposal accepted',
  '{0} aceitou sua proposta. Aguardando pagamento.': '{0} accepted your proposal. Awaiting payment.', 'Proposta indisponível.': 'Proposal unavailable.', 'Esta proposta expirou. Peça uma nova ao fornecedor.': 'This proposal has expired. Ask the provider for a new one.',
  'Fornecedor indisponível.': 'Provider unavailable.', 'Proposta: {0}': 'Proposal: {0}', 'serviço personalizado': 'custom service',

  // pedidos
  'Cancelamento com reembolso: 100% até 7 dias antes, 50% de 2 a 6 dias, sem reembolso com menos de 2 dias.': 'Refund on cancellation: 100% up to 7 days before, 50% from 2 to 6 days, no refund with less than 2 days.',
  'Reembolso de 100% até 7 dias antes, 50% de 2 a 6 dias, sem reembolso com menos de 2 dias.': 'Refund of 100% up to 7 days before, 50% from 2 to 6 days, no refund with less than 2 days.',
  'Você não pode contratar o próprio negócio.': 'You cannot hire your own business.', 'Ação indisponível para pedidos "{0}".': 'Action unavailable for orders with status "{0}".',
  'Apenas o fornecedor pode aceitar.': 'Only the provider can accept.', 'Cadastro não aprovado.': 'Registration not approved.', 'Não é possível aceitar: {0}.': 'Cannot accept: {0}.',
  'Pedido aceito pelo fornecedor': 'Order accepted by the provider', 'Pedido aceito — pague para confirmar': 'Order accepted — pay to confirm', '{0} aceitou o pedido #{1}. A data só é reservada após o pagamento.': '{0} accepted order #{1}. The date is only reserved after payment.',
  'Apenas o fornecedor pode recusar.': 'Only the provider can decline.', 'Recusado pelo fornecedor: {0}': 'Declined by the provider: {0}', 'sem motivo informado': 'no reason given', 'Pedido recusado': 'Order declined', '{0} não poderá atender o pedido #{1}.': '{0} will not be able to fulfill order #{1}.',
  'Sem permissão.': 'No permission.', 'Fornecedor iniciou a preparação': 'Provider started preparing', 'Pedido em preparação': 'Order in preparation', '{0} começou a preparar o pedido #{1}.': '{0} started preparing order #{1}.',
  'Só é possível concluir a partir da data do evento.': 'Can only be completed on or after the event date.', 'Apenas o cliente pode cancelar o pedido.': 'Only the customer can cancel the order.',
  'Este pedido não pode mais ser cancelado. Abra uma disputa se houver um problema.': 'This order can no longer be canceled. Open a dispute if there is a problem.', 'Cancelado pelo cliente. {0}': 'Canceled by the customer. {0}', 'cancelamento pelo cliente': 'canceled by the customer',
  'Pedido cancelado': 'Order canceled', 'O cliente cancelou o pedido #{0} ({1}).': 'The customer canceled order #{0} ({1}).', 'Apenas o cliente pode abrir disputa.': 'Only the customer can open a dispute.',
  'Nova disputa': 'New dispute', 'Pedido #{0} em disputa.': 'Order #{0} in dispute.', 'Pedido em disputa': 'Order in dispute', 'O cliente abriu uma disputa no pedido #{0}.': 'The customer opened a dispute on order #{0}.',
  'Apenas o cliente pode pagar.': 'Only the customer can pay.', 'Apenas o cliente pode avaliar.': 'Only the customer can review.', 'Só é possível avaliar contratações concluídas.': 'Only completed orders can be reviewed.', 'Você já avaliou este pedido.': 'You have already reviewed this order.',
  'Avaliação para moderar': 'Review to moderate', 'Nova avaliação do pedido #{0}.': 'New review for order #{0}.', 'Avaliação enviada para moderação.': 'Review submitted for moderation.',
  'Selecione ao menos um item.': 'Select at least one item.', 'Um dos itens não está mais disponível.': 'One of the items is no longer available.', '"{0}" é sob orçamento: solicite uma proposta.': '"{0}" is quote-based: request a proposal.',
  'Quantidade inválida.': 'Invalid quantity.', 'Quantidade mínima de "{0}": {1}.': 'Minimum quantity for "{0}": {1}.', 'Adicional inválido.': 'Invalid add-on.',
  'Este pedido exige antecedência mínima de {0} dia(s) (a partir de {1}).': 'This order requires at least {0} day(s) notice (from {1}).', 'Fornecedor indisponível nesta data: {0}.': 'Provider unavailable on this date: {0}.',
  'Pedido criado pelo cliente': 'Order created by the customer', 'Aguardando o fornecedor aceitar o pedido': 'Waiting for the provider to accept the order', 'Novo pedido recebido': 'New order received',
  '{0} solicitou {1} item(ns) para {2}. Líquido previsto: {3}.': '{0} requested {1} item(s) for {2}. Expected net: {3}.',
  'Este pedido não está aguardando pagamento.': 'This order is not awaiting payment.', 'Estorno de {0} ({1})': 'Refund of {0} ({1})', 'Estorno registrado': 'Refund recorded', '{0} referente ao pedido #{1} ({2}).': '{0} for order #{2} ({1}).',
  'Pagamento desconhecido.': 'Unknown payment.', 'Pagamento não aprovado': 'Payment not approved', 'O pagamento do pedido #{0} não foi aprovado. Tente novamente.': 'The payment for order #{0} was not approved. Please try again.',
  'data ocupada ou pedido não mais pendente': 'date taken or order no longer pending', 'Data não está mais disponível; pagamento estornado': 'Date is no longer available; payment refunded', 'Pedido não confirmado': 'Order not confirmed',
  'A data ficou indisponível antes da confirmação do pagamento. O valor foi estornado.': 'The date became unavailable before the payment was confirmed. The amount was refunded.', 'Pagamento aprovado — data reservada': 'Payment approved — date reserved',
  'Pedido confirmado': 'Order confirmed', 'Pagamento aprovado! O pedido #{0} está confirmado.': 'Payment approved! Order #{0} is confirmed.', 'Pagamento recebido': 'Payment received', 'Pedido #{0} confirmado para {1}.': 'Order #{0} confirmed for {1}.',
  'Serviço concluído': 'Service completed', 'Que tal avaliar o fornecedor? Pedido #{0}.': 'Would you like to review the provider? Order #{0}.',
  'Valor do pagamento diverge do pedido.': 'Payment amount does not match the order.', 'Assinatura inválida.': 'Invalid signature.', 'Evento incompleto.': 'Incomplete event.',
  'Nova mensagem': 'New message', 'Sua localização': 'Your location',

  // status
  'Solicitado': 'Requested', 'Aguardando resposta': 'Awaiting response', 'Proposta enviada': 'Proposal sent', 'Aguardando pagamento': 'Awaiting payment', 'Confirmado': 'Confirmed', 'Em preparação': 'In preparation',
  'Concluído': 'Completed', 'Cancelado': 'Canceled', 'Em disputa': 'In dispute',

  // disponibilidade / áreas
  'Data no passado': 'Date in the past', 'Antecedência mínima de {0} dia(s)': 'Minimum notice of {0} day(s)', 'Data indisponível': 'Date unavailable', 'Agenda cheia nesta data': 'Fully booked on this date',
  'Atende raio de {0} km': 'Serves a {0} km radius', 'Atende seu CEP': 'Serves your postal code', 'Atende {0}': 'Serves {0}', 'raio de {0} km': '{0} km radius', 'Raio de {0} km': '{0} km radius', 'CEPs {0}–{1}': 'Postal codes {0}–{1}',
  'Cupom inválido ou inativo.': 'Invalid or inactive coupon.', 'Este cupom expirou.': 'This coupon has expired.', 'Este cupom atingiu o limite de usos.': 'This coupon has reached its usage limit.',

  // uploads / mídia
  'Envie uma imagem JPG, PNG ou WebP.': 'Upload a JPG, PNG or WebP image.', 'Arquivo vazio.': 'Empty file.', 'O conteúdo do arquivo não corresponde a uma imagem válida.': 'The file content is not a valid image.',
  'Endereço de mídia inválido. Envie uma imagem pela plataforma ou use um link https para vídeo.': 'Invalid media address. Upload an image through the platform or use an https link for video.',
  'Uploads não estão disponíveis na versão de demonstração online. Cole o endereço (URL) de uma imagem.': 'Uploads are not available in the online demo. Paste an image URL instead.',

  // fornecedor
  'Você já possui um cadastro de fornecedor.': 'You already have a provider registration.', 'Novo fornecedor aguardando aprovação': 'New provider awaiting approval', '{0} ({1}) enviou o cadastro.': '{0} ({1}) submitted a registration.',
  'Lista de áreas inválida.': 'Invalid area list.', 'Faixa de CEP inválida (use os 5 primeiros dígitos).': 'Invalid postal code range (use the first 5 digits).', 'Defina a cidade do seu negócio (cadastrada na plataforma) para usar raio.': 'Set your business city (registered on the platform) to use a radius.',
  'Cidade "{0}" ainda não é atendida pela plataforma.': 'City "{0}" is not yet served by the platform.', 'Categoria inválida.': 'Invalid category.',
  'Cadastro aprovado! 🎉': 'Registration approved! 🎉', 'Seu perfil já está publicado na Agitaê.': 'Your profile is now published on Agitaê.', 'Cadastro {0}': 'Registration {0}', 'suspenso': 'suspended', 'não aprovado': 'not approved',
  'Entre em contato com o suporte para mais informações.': 'Contact support for more information.',

  // admin
  'Você não pode remover seu próprio acesso de administrador.': 'You cannot remove your own admin access.', 'Este pedido não está em disputa.': 'This order is not in dispute.', 'disputa resolvida a favor do cliente': 'dispute resolved in favor of the customer',
  'Disputa: reembolso integral. {0}': 'Dispute: full refund. {0}', 'Disputa: liberado ao fornecedor. {0}': 'Dispute: released to the provider. {0}', 'Disputa resolvida': 'Dispute resolved',
  'Pedido #{0}: {1}.': 'Order #{0}: {1}.', 'reembolso aprovado': 'refund approved', 'liberado ao fornecedor': 'released to the provider', 'Pedido #{0} foi {1}.': 'Order #{0} was {1}.', 'reembolsado ao cliente': 'refunded to the customer', 'liberado para repasse': 'released for payout',
  'Nada a reembolsar neste pedido.': 'Nothing to refund on this order.', 'Já existe uma categoria com este identificador.': 'A category with this identifier already exists.', 'Código já existe.': 'Code already exists.',
  'Repasses reais dependem da integração com o provedor (veja docs/PAYMENTS.md).': 'Real payouts depend on the payment provider integration (see docs/PAYMENTS.md).', 'Repasse indisponível.': 'Payout unavailable.',
  'O repasse só é liberado após a conclusão do pedido (e sem disputa).': 'The payout is only released after the order is completed (and without dispute).', 'Repasse realizado': 'Payout made', '{0} referente ao pedido #{1} (modo teste).': '{0} for order #{1} (test mode).',

  // pagamentos
  'Pagamentos ainda não ativados: defina {0} (veja docs/PAYMENTS.md).': 'Payments are not activated yet: set {0} (see docs/PAYMENTS.md).', 'Adaptador do provedor de pagamentos ainda não implementado (veja docs/PAYMENTS.md).': 'Payment provider adapter not implemented yet (see docs/PAYMENTS.md).',
  'PAYMENT_PROVIDER e PAYMENT_API_KEY': 'PAYMENT_PROVIDER and PAYMENT_API_KEY',

  // dados de demonstração (gerados pelo seed)
  'Rua Exemplo, {0} — {1} (endereço fictício)': 'Example Street, {0} — {1} (fictional address)', 'Avenida Exemplo, 1000 (endereço fictício)': 'Example Avenue, 1000 (fictional address)',
  'Av. Otacílio Negrão de Lima, 1000 (endereço fictício)': 'Av. Otacílio Negrão de Lima, 1000 (fictional address)',
  'Taxa de deslocamento de {0} para eventos fora de {1}.': 'Travel fee of {0} for events outside {1}.', 'Sem taxa de deslocamento na região atendida.': 'No travel fee within the service area.',
  'Entrega ou deslocamento gratuitos em {0}; fora dela, taxa de {1}.': 'Free delivery or travel within {0}; outside it, a fee of {1} applies.', 'Sem custo de deslocamento na região atendida.': 'No travel cost within the service area.',
  'Trabalho {0} (imagem fictícia)': 'Work {0} (fictional image)', 'Vídeo de apresentação (link fictício de demonstração)': 'Introduction video (fictional demo link)', 'Portfólio {0}': 'Portfolio {0}',
  'Endereço do evento (fictício)': 'Event address (fictional)', 'Salão Exemplo (fictício)': 'Example Hall (fictional)',
  'Tudo perfeito! Chegou no horário e superou as expectativas.': 'Everything was perfect! Arrived on time and exceeded expectations.', 'Atendimento excelente e qualidade impecável. Recomendo!': 'Excellent service and impeccable quality. Highly recommended!',
  'Muito bom, só atrasou um pouquinho a entrega.': 'Very good, delivery was just a little late.', 'Os convidados elogiaram muito. Voltarei a contratar.': 'The guests praised it a lot. I will hire again.',
  'Ótimo custo-benefício e comunicação clara.': 'Great value and clear communication.', 'Profissionais atenciosos e muito cuidadosos.': 'Attentive and very careful professionals.',
  'Obrigado pela confiança! Foi um prazer participar da sua festa.': 'Thank you for your trust! It was a pleasure being part of your party.',
  'Primeira festa na Agitaê?': 'First party on Agitaê?', 'Use o cupom BEMVINDO10 e ganhe 10% de desconto.': 'Use coupon BEMVINDO10 and get 10% off.', 'Fornecedor? Cadastre-se grátis': 'Are you a provider? Sign up for free',
  'Sem mensalidade: você só paga a comissão quando vender.': 'No monthly fee: you only pay the commission when you sell.',
  'Bloqueado pelo fornecedor': 'Blocked by the provider', 'Viagem': 'Trip', 'Cobertura fotográfica de 4 horas': '4-hour photo coverage',
  'Imagem fictícia de demonstração': 'Fictional demo image',
};
