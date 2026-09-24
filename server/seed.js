import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { hashPassword, slugify, today, addDays } from './util.js';

export const DEMO_PASSWORD = 'agitae123';

const CITIES = [
  ['Guarulhos', 'SP', -23.4538, -46.5333, 7000, 7399], ['São Paulo', 'SP', -23.5505, -46.6333, 1000, 9999],
  ['Rio de Janeiro', 'RJ', -22.9068, -43.1729, 20000, 23799], ['Niterói', 'RJ', -22.8833, -43.1036, 24000, 24999],
  ['Belo Horizonte', 'MG', -19.9167, -43.9345, 30000, 31999], ['Curitiba', 'PR', -25.4284, -49.2733, 80000, 82999], ['Campinas', 'SP', -22.9099, -47.0626, 13000, 13139],
];
const CATS = [
  ['doces-salgados', 'Doces e salgados', '🧁'], ['bolos', 'Bolos', '🎂'], ['buffet', 'Buffet', '🍽️'], ['decoracao', 'Decoração', '🎈'], ['fotografia', 'Fotografia', '📸'], ['video', 'Vídeo', '🎬'],
  ['dj-musica', 'DJ e música', '🎧'], ['espaco-eventos', 'Espaço para eventos', '🏡'], ['cerimonial', 'Cerimonial', '💍'], ['recreacao-infantil', 'Recreação infantil', '🎠'], ['brinquedos', 'Brinquedos', '🏰'],
  ['lembrancinhas', 'Lembrancinhas', '🎁'], ['convites', 'Convites', '💌'], ['flores', 'Flores', '💐'], ['bebidas', 'Bebidas', '🍹'], ['mobiliario-equipamentos', 'Mobiliário e equipamentos', '🪑'],
  ['iluminacao-som', 'Iluminação e som', '💡'], ['beleza', 'Beleza', '💄'], ['seguranca', 'Segurança', '🛡️'], ['limpeza', 'Limpeza', '🧹'], ['transporte', 'Transporte', '🚐'], ['festas-pets', 'Festas pets', '🐶'],
];

// tipo de preço: f = fechado, p = a partir de, o = sob orçamento
const S = (cat, name, desc, t, price, unit, x = {}) => ({ cat, name, desc, t, price, unit, ...x });
const A = (type, v) => ({ type, ...v });

const PROVIDERS = [
  { name: 'Doce Sabor Confeitaria', city: 'São Paulo', hood: 'Pinheiros', plan: 'premium', verified: 1, cap: 3, notice: 3, travel: 30,
    desc: 'Confeitaria artesanal há 12 anos. Docinhos, bolos e salgados feitos por encomenda, com ingredientes selecionados e entrega em toda a Grande São Paulo.', hours: 'Seg a sáb, 8h às 18h',
    areas: [A('cidade', { city: 'São Paulo' }), A('cidade', { city: 'Guarulhos' })], services: [
      S('doces-salgados', 'Brigadeiro gourmet (cento)', 'Brigadeiros de chocolate belga, ninho e beijinho, enrolados na hora e entregues em forminhas.', 'f', 180, 'cento', { inc: '100 unidades, forminhas brancas, embalagem para transporte', lead: 3, feat: 1, opts: [['Personalização com granulado colorido', 20], ['Forminhas personalizadas com o tema da festa', 35]], ev: 'aniversario,infantil,casamento,formatura' }),
      S('doces-salgados', 'Kit festa para 30 pessoas', 'Kit completo para festas pequenas: docinhos, salgadinhos e refrigerantes.', 'f', 420, 'kit', { inc: '1 cento de docinhos, 50 salgadinhos fritos, 3 refrigerantes de 2L, guardanapos', lead: 2, ev: 'aniversario,infantil,cha' }),
      S('doces-salgados', 'Salgados fritos (cento)', 'Coxinha, risoles, bolinha de queijo e kibe, fritos na hora da entrega.', 'f', 150, 'cento', { inc: '100 salgados sortidos', lead: 2, min: 1 }),
      S('doces-salgados', 'Mesa de doces completa', 'Mesa decorada com docinhos, tortas e brigadeiros no tema escolhido.', 'p', 900, 'mesa', { inc: 'Docinhos para 40 pessoas, toalha e suportes', lead: 7 }),
      S('bolos', 'Bolo decorado (por kg)', 'Bolo artesanal com massa fofinha e recheio à escolha. Mínimo 2 kg.', 'p', 110, 'kg', { inc: 'Massa, recheio e cobertura; decoração simples inclusa', min: 2, lead: 5, opts: [['Recheio premium (ninho com morango)', 30], ['Topo de bolo personalizado', 45]], ev: 'aniversario,infantil,casamento,cha' }),
      S('bolos', 'Bolo de casamento (3 andares)', 'Bolo cenográfico de 3 andares, sob medida. Envie referências para receber a proposta.', 'o', 0, 'proposta', { lead: 20, ev: 'casamento' }),
      S('lembrancinhas', 'Caixinha de brigadeiros personalizada', 'Caixinha com 4 brigadeiros e etiqueta com o nome da festa.', 'f', 8, 'unidade', { inc: '4 brigadeiros, caixinha e etiqueta', min: 20, lead: 7 }),
    ] },
  { name: 'Salgadinhos da Vovó', city: 'São Paulo', hood: 'Mooca', plan: 'basico', verified: 1, cap: 2, notice: 2, travel: 0,
    desc: 'Salgados de festa com gostinho de casa. Atendemos os bairros da Zona Leste com entrega no dia e receitas de família.', hours: 'Diariamente, 7h às 19h',
    areas: [A('bairro', { city: 'São Paulo', hood: 'Mooca' }), A('bairro', { city: 'São Paulo', hood: 'Tatuapé' }), A('bairro', { city: 'São Paulo', hood: 'Belém' }), A('bairro', { city: 'São Paulo', hood: 'Brás' })], services: [
      S('doces-salgados', 'Salgados sortidos (cento)', 'Coxinha, risole de queijo, empada e enroladinho.', 'f', 130, 'cento', { inc: '100 salgados', lead: 1, feat: 1 }),
      S('doces-salgados', 'Mini pizzas (cento)', 'Mini pizzas de mussarela, calabresa e frango com catupiry.', 'f', 160, 'cento', { inc: '100 mini pizzas', lead: 2 }),
      S('doces-salgados', 'Combo festa para 50 pessoas', 'Salgados, docinhos e refrigerantes para 50 convidados.', 'f', 380, 'combo', { inc: '150 salgados, 60 docinhos, 5 refrigerantes de 2L', lead: 2 }),
      S('bebidas', 'Kit bebidas sem álcool (50 pessoas)', 'Refrigerantes, sucos e água, com gelo e copos descartáveis.', 'f', 260, 'kit', { inc: 'Bebidas, gelo, 60 copos', lead: 2 }),
      S('bebidas', 'Barril de chope 30L', 'Chope pilsen com chopeira e instalação.', 'p', 450, 'barril', { inc: 'Chopeira e instalação; copos à parte', lead: 3 }),
    ] },
  { name: 'Bolos & Afetos', city: 'Rio de Janeiro', hood: 'Tijuca', plan: 'basico', verified: 1, cap: 2, notice: 4, travel: 40,
    desc: 'Ateliê de bolos decorados e cupcakes para aniversários e festas infantis no Rio e em Niterói.', hours: 'Ter a sáb, 9h às 17h',
    areas: [A('cidade', { city: 'Rio de Janeiro' }), A('cidade', { city: 'Niterói' })], services: [
      S('bolos', 'Bolo de aniversário (por kg)', 'Bolo com massa amanteigada e recheios cremosos.', 'f', 95, 'kg', { inc: 'Massa, recheio, cobertura chantilly', min: 2, lead: 4, feat: 1, opts: [['Decoração com flores comestíveis', 60]] }),
      S('bolos', 'Naked cake', 'Bolo rústico com frutas frescas, para 20 fatias.', 'f', 240, 'unidade', { inc: '20 fatias, frutas da estação', lead: 4 }),
      S('bolos', 'Cupcakes (dúzia)', 'Cupcakes decorados no tema da festa.', 'f', 72, 'dúzia', { inc: '12 cupcakes decorados', min: 2, lead: 3 }),
      S('doces-salgados', 'Docinhos finos (cento)', 'Brigadeiros gourmet, cajuzinhos e olhos de sogra.', 'f', 190, 'cento', { inc: '100 docinhos', lead: 3 }),
    ] },
  { name: 'Luz e Cor Fotografia', city: 'São Paulo', hood: 'Vila Mariana', plan: 'premium', verified: 1, cap: 1, notice: 7, travel: 80,
    desc: 'Fotografia e vídeo de eventos sociais com olhar documental. Entrega de galeria online em até 15 dias.', hours: 'Agenda sob reserva',
    areas: [A('cidade', { city: 'São Paulo' }), A('raio', { km: 40 })], services: [
      S('fotografia', 'Cobertura fotográfica de 2 horas', 'Ideal para festas pequenas e cerimônias rápidas.', 't', 650, 'cobertura', { inc: '1 fotógrafo, 100 fotos tratadas, galeria online', lead: 7, feat: 1 }),
      S('fotografia', 'Cobertura fotográfica de 4 horas', 'Cobertura completa de festas de aniversário e formaturas.', 'f', 1100, 'cobertura', { inc: '1 fotógrafo, 250 fotos tratadas, galeria online', lead: 10 }),
      S('fotografia', 'Cobertura fotográfica de 8 horas', 'Dia inteiro de cobertura, do preparo à festa.', 'f', 1900, 'cobertura', { inc: '1 fotógrafo + assistente, 500 fotos tratadas, galeria online', lead: 15, opts: [['Álbum impresso 30x30', 480]] }),
      S('fotografia', 'Ensaio pré-wedding', 'Ensaio externo com direção de poses.', 'p', 900, 'ensaio', { inc: '2h de ensaio, 40 fotos tratadas', lead: 10 }),
      S('video', 'Vídeo highlights (3 minutos)', 'Filme curto com os melhores momentos da festa.', 'p', 1400, 'vídeo', { inc: 'Captação, edição e trilha licenciada', lead: 15 }),
    ] },
  { name: 'Mariana Teixeira Fotografia', city: 'Rio de Janeiro', hood: 'Botafogo', plan: 'basico', verified: 1, cap: 1, notice: 5, travel: 60,
    desc: 'Fotógrafa de festas infantis, aniversários e casamentos no Rio e Niterói. Fotos leves, naturais e cheias de emoção.', hours: 'Seg a dom, sob agendamento',
    areas: [A('cidade', { city: 'Rio de Janeiro' }), A('cidade', { city: 'Niterói' })], services: [
      S('fotografia', 'Cobertura de 2 horas', 'Cobertura de festas íntimas e aniversários.', 'f', 590, 'cobertura', { inc: '1 fotógrafa, 80 fotos tratadas', lead: 5, feat: 1 }),
      S('fotografia', 'Cobertura de 4 horas', 'Cobertura completa da festa, do parabéns à saída.', 'f', 980, 'cobertura', { inc: '1 fotógrafa, 200 fotos tratadas', lead: 7 }),
      S('fotografia', 'Cobertura de 8 horas', 'Casamentos e festas de 15 anos.', 'f', 1750, 'cobertura', { inc: '1 fotógrafa + assistente, 450 fotos tratadas', lead: 15 }),
      S('fotografia', 'Book de 15 anos', 'Ensaio pré-festa com 2 trocas de look.', 'p', 700, 'ensaio', { inc: '2h de ensaio, 30 fotos tratadas', lead: 7 }),
    ] },
  { name: 'Lente Viva Foto e Vídeo', city: 'Belo Horizonte', hood: 'Savassi', plan: 'basico', verified: 0, cap: 2, notice: 5, travel: 50,
    desc: 'Estúdio de foto e vídeo em BH. Fazemos cobertura de aniversários, casamentos e eventos corporativos.', hours: 'Seg a sex, 9h às 18h',
    areas: [A('cidade', { city: 'Belo Horizonte' })], services: [
      S('fotografia', 'Cobertura fotográfica de 4 horas', 'Fotos tratadas e galeria online.', 'f', 900, 'cobertura', { inc: '1 fotógrafo, 200 fotos tratadas', lead: 7, feat: 1 }),
      S('fotografia', 'Cobertura fotográfica de 8 horas', 'Cobertura do dia todo.', 'f', 1600, 'cobertura', { inc: '2 fotógrafos, 450 fotos tratadas', lead: 10 }),
      S('video', 'Filmagem de 4 horas', 'Filmagem com edição de vídeo final de 5 minutos.', 'p', 1500, 'filmagem', { inc: '1 cinegrafista, edição', lead: 15 }),
      S('video', 'Combo foto e vídeo para casamento', 'Pacote completo, sob medida para o seu casamento.', 'o', 0, 'proposta', { lead: 30, ev: 'casamento' }),
    ] },
  { name: 'Estúdio Íris', city: 'Curitiba', hood: 'Batel', plan: 'basico', verified: 1, cap: 1, notice: 5, travel: 45,
    desc: 'Fotografia de festas e eventos em Curitiba e região metropolitana.', hours: 'Seg a sáb, 10h às 19h',
    areas: [A('cidade', { city: 'Curitiba' })], services: [
      S('fotografia', 'Cobertura de 2 horas', 'Cobertura de festas pequenas.', 'f', 580, 'cobertura', { inc: '1 fotógrafo, 90 fotos tratadas', lead: 5, feat: 1 }),
      S('fotografia', 'Cobertura de 4 horas', 'Cobertura de festas de aniversário.', 'f', 990, 'cobertura', { inc: '1 fotógrafo, 220 fotos tratadas', lead: 7 }),
      S('fotografia', 'Fotografia de festa infantil', 'Cobertura leve e divertida para festas infantis.', 'p', 700, 'cobertura', { inc: '3h de cobertura, 150 fotos', lead: 7, ev: 'infantil,aniversario' }),
    ] },
  { name: 'Buffet Bom Sabor', city: 'São Paulo', hood: 'Tatuapé', plan: 'premium', verified: 1, cap: 2, notice: 15, travel: 100,
    desc: 'Buffet completo para casamentos, formaturas e festas de 15 anos. Equipe própria de garçons e cozinha industrial.', hours: 'Seg a sex, 9h às 18h',
    areas: [A('cidade', { city: 'São Paulo' }), A('cidade', { city: 'Guarulhos' })], services: [
      S('buffet', 'Buffet completo por convidado', 'Entrada, prato principal, sobremesa e bebidas sem álcool.', 'p', 95, 'convidado', { inc: 'Comida, equipe de serviço, louças', min: 30, lead: 15, feat: 1, opts: [['Open bar de sucos', 12 * 30], ['Garçons extras (2)', 300]], ev: 'casamento,formatura,aniversario,corporativo' }),
      S('buffet', 'Coquetel volante', 'Canapés e finger foods servidos por garçons.', 'p', 70, 'convidado', { inc: '12 tipos de canapés, equipe', min: 30, lead: 10 }),
      S('buffet', 'Buffet infantil', 'Cardápio infantil com monitor de brincadeiras.', 'f', 65, 'convidado', { inc: 'Comida, sobremesa, refrigerante', min: 20, lead: 7, ev: 'infantil' }),
      S('mobiliario-equipamentos', 'Aluguel de mesas e cadeiras (10 lugares)', 'Mesa redonda com 10 cadeiras e toalha.', 'f', 180, 'kit', { inc: '1 mesa, 10 cadeiras, toalha branca', lead: 5 }),
      S('bebidas', 'Open bar completo', 'Caipirinhas, drinks e cervejas com barman.', 'p', 55, 'convidado', { inc: 'Barman, bebidas, gelo', min: 30, lead: 10 }),
    ] },
  { name: 'Sabores de Minas Buffet', city: 'Belo Horizonte', hood: 'Funcionários', plan: 'basico', verified: 1, cap: 2, notice: 10, travel: 70,
    desc: 'Buffet mineiro de verdade: comida caseira, fartura e tradição para todas as ocasiões.', hours: 'Ter a dom, 10h às 20h',
    areas: [A('cidade', { city: 'Belo Horizonte' })], services: [
      S('buffet', 'Buffet mineiro completo', 'Pratos típicos, saladas, sobremesas e refresco.', 'p', 88, 'convidado', { inc: 'Comida, louças, equipe', min: 30, lead: 10, feat: 1 }),
      S('buffet', 'Feijoada para 50 pessoas', 'Feijoada completa com acompanhamentos.', 'f', 2900, 'evento', { inc: 'Feijoada, arroz, couve, farofa, laranja, sobremesa', lead: 7 }),
      S('doces-salgados', 'Pão de queijo (cento)', 'Pão de queijo mineiro, congelado ou quentinho.', 'f', 110, 'cento', { inc: '100 unidades', lead: 2 }),
      S('doces-salgados', 'Doces de leite artesanais (cento)', 'Doce de leite em formatos variados.', 'f', 240, 'cento', { inc: '100 unidades', lead: 3 }),
    ] },
  { name: 'Decora Festa', city: 'São Paulo', hood: 'Santana', plan: 'basico', verified: 1, cap: 2, notice: 7, travel: 50,
    desc: 'Decoração temática, arranjos de flores e convites personalizados. Cuidamos de todos os detalhes visuais da sua festa.', hours: 'Seg a sáb, 9h às 18h',
    areas: [A('cidade', { city: 'São Paulo' })], services: [
      S('decoracao', 'Decoração de festa infantil (tema à escolha)', 'Painel, mesa do bolo, balões e itens temáticos.', 'p', 850, 'festa', { inc: 'Painel, mesa, 100 balões, montagem e desmontagem', lead: 10, feat: 1, ev: 'infantil,aniversario' }),
      S('decoracao', 'Decoração da mesa do bolo', 'Composição de mesa com toalha, flores e suportes.', 'f', 420, 'mesa', { inc: 'Mesa, toalha, suportes, flores artificiais', lead: 7 }),
      S('decoracao', 'Arco de balões', 'Arco orgânico com balões nas cores da festa.', 'f', 380, 'arco', { inc: 'Arco de 2,5 m, montagem', lead: 5 }),
      S('flores', 'Arranjos de mesa', 'Arranjos com flores naturais para mesas de convidados.', 'f', 65, 'unidade', { inc: 'Arranjo com flores da estação', min: 5, lead: 5 }),
      S('flores', 'Buquê de noiva', 'Buquê de flores naturais sob medida.', 'f', 320, 'unidade', { inc: 'Buquê e boutonnière', lead: 10, ev: 'casamento' }),
      S('convites', 'Convites digitais personalizados', 'Arte animada para WhatsApp, entregue em até 3 dias.', 'f', 90, 'pacote', { inc: '1 arte + 1 revisão', lead: 3 }),
      S('convites', 'Convites impressos (50 unidades)', 'Convites em papel especial com acabamento.', 'f', 220, 'pacote', { inc: '50 convites com envelope', lead: 10 }),
      S('iluminacao-som', 'Iluminação decorativa cênica', 'Cortinas de luz e refletores decorativos.', 'p', 600, 'evento', { inc: 'Equipamento e montagem', lead: 7 }),
    ] },
  { name: 'Balão Mágico Recreação', city: 'Rio de Janeiro', hood: 'Méier', plan: 'basico', verified: 1, cap: 3, notice: 3, travel: 35,
    desc: 'Monitores treinados, brincadeiras, pintura facial e brinquedos para festas infantis seguras e divertidas.', hours: 'Todos os dias, 8h às 20h',
    areas: [A('cidade', { city: 'Rio de Janeiro' }), A('cidade', { city: 'Niterói' })], services: [
      S('recreacao-infantil', 'Recreação de 3 horas (2 monitores)', 'Brincadeiras dirigidas, músicas e gincanas.', 'f', 480, 'pacote', { inc: '2 monitores, materiais', lead: 3, feat: 1, ev: 'infantil' }),
      S('recreacao-infantil', 'Pintura facial', 'Pintura artística com tintas hipoalergênicas.', 'f', 250, '2 horas', { inc: '1 pintora, tintas', lead: 3 }),
      S('recreacao-infantil', 'Show de mágica', 'Show de 40 minutos com participação das crianças.', 'f', 420, 'show', { inc: 'Mágico e equipamento de som', lead: 5 }),
      S('brinquedos', 'Cama elástica', 'Cama elástica com monitor de segurança.', 'f', 220, 'período', { inc: 'Montagem e monitor', lead: 3 }),
      S('brinquedos', 'Piscina de bolinhas', 'Piscina com 2.000 bolinhas.', 'f', 180, 'período', { inc: 'Montagem, bolinhas higienizadas', lead: 3 }),
      S('brinquedos', 'Pula-pula 3x3', 'Pula-pula com rede de proteção.', 'f', 200, 'período', { inc: 'Montagem e desmontagem', lead: 3 }),
    ] },
  { name: 'DJ Ritmo Certo', city: 'Guarulhos', hood: 'Centro', plan: 'basico', verified: 1, cap: 1, notice: 5, travel: 0,
    desc: 'DJ e sonorização para festas, casamentos e eventos corporativos, com repertório sob medida.', hours: 'Sob agendamento',
    areas: [A('cidade', { city: 'Guarulhos' }), A('cidade', { city: 'São Paulo' })], services: [
      S('dj-musica', 'DJ por 4 horas', 'Set personalizado com o estilo da sua festa.', 'f', 900, 'evento', { inc: 'DJ, som para até 100 pessoas', lead: 5, feat: 1 }),
      S('dj-musica', 'DJ + sonorização completa', 'DJ com som e iluminação de pista para até 250 pessoas.', 'f', 1400, 'evento', { inc: 'DJ, som, kit de iluminação, técnico', lead: 7 }),
      S('iluminacao-som', 'Kit iluminação de pista', 'Refletores coloridos, laser e máquina de fumaça.', 'f', 500, 'kit', { inc: 'Equipamentos e operação', lead: 5 }),
      S('iluminacao-som', 'Sonorização para cerimônia', 'Microfones e caixas para cerimônias.', 'f', 550, 'cerimônia', { inc: '2 microfones sem fio, som ambiente', lead: 5 }),
    ] },
  { name: 'Espaço Jardim das Acácias', city: 'Belo Horizonte', hood: 'Pampulha', plan: 'basico', verified: 1, cap: 1, notice: 20, travel: 0,
    desc: 'Espaço amplo com jardim, salão climatizado e estacionamento, para até 120 convidados.', hours: 'Visitas de ter a sáb, 10h às 17h', address: 'Av. Otacílio Negrão de Lima, 1000 (endereço fictício)',
    areas: [A('cidade', { city: 'Belo Horizonte' })], services: [
      S('espaco-eventos', 'Locação do salão (6 horas, até 120 pessoas)', 'Salão climatizado com cozinha de apoio e estacionamento.', 'f', 4500, 'locação', { inc: 'Salão, cozinha de apoio, 2 banheiros, estacionamento', lead: 20, feat: 1 }),
      S('espaco-eventos', 'Área externa para cerimônia', 'Jardim com pérgola para cerimônias ao ar livre.', 'f', 1800, 'locação', { inc: 'Jardim, pérgola, 80 cadeiras', lead: 20, ev: 'casamento' }),
      S('mobiliario-equipamentos', 'Mobiliário lounge', 'Sofás e puffs para área de convivência.', 'p', 900, 'conjunto', { inc: 'Entrega e montagem', lead: 10 }),
      S('cerimonial', 'Cerimonial do dia', 'Coordenação de equipe e cronograma no dia da festa.', 'f', 1200, 'evento', { inc: '1 cerimonialista, 8 horas', lead: 15 }),
    ] },
  { name: 'Cerimonial Encanto', city: 'Curitiba', hood: 'Batel', plan: 'basico', verified: 1, cap: 1, notice: 30, travel: 90,
    desc: 'Assessoria e cerimonial de casamentos e eventos, do planejamento à execução.', hours: 'Seg a sex, 9h às 17h',
    areas: [A('cidade', { city: 'Curitiba' })], services: [
      S('cerimonial', 'Cerimonial completo de casamento', 'Planejamento e execução completa. Enviaremos proposta sob medida.', 'o', 0, 'proposta', { lead: 60, feat: 1, ev: 'casamento' }),
      S('cerimonial', 'Assessoria no dia', 'Cerimonialista no dia da festa.', 'f', 1500, 'evento', { inc: '1 cerimonialista + 1 assistente, 10 horas', lead: 20 }),
      S('decoracao', 'Decoração de casamento', 'Projeto de decoração personalizado.', 'o', 0, 'proposta', { lead: 45, ev: 'casamento' }),
      S('flores', 'Arranjos florais para cerimônia', 'Arranjos de altar e corredor.', 'p', 900, 'evento', { inc: 'Flores naturais, montagem', lead: 15 }),
    ] },
  { name: 'Evento Seguro & Limpo', city: 'São Paulo', hood: 'Centro', plan: 'basico', verified: 1, cap: 4, notice: 3, travel: 60,
    desc: 'Segurança, limpeza e transporte para eventos. Equipes uniformizadas, treinadas e com seguro.', hours: 'Atendimento 24h',
    areas: [A('cidade', { city: 'São Paulo' }), A('cidade', { city: 'Guarulhos' }), A('cep', { from: '13000', to: '13139' })], services: [
      S('seguranca', 'Segurança (por profissional, 6 horas)', 'Seguranças uniformizados para controle de acesso.', 'f', 280, 'profissional', { inc: '6 horas, uniforme, rádio', min: 2, lead: 3, feat: 1 }),
      S('limpeza', 'Limpeza pós-evento', 'Equipe de limpeza para deixar o local impecável.', 'f', 420, 'equipe', { inc: '3 pessoas, 4 horas, produtos', lead: 3 }),
      S('limpeza', 'Limpeza durante o evento (2 pessoas)', 'Manutenção de banheiros e áreas comuns.', 'f', 520, 'equipe', { inc: '2 pessoas, 6 horas', lead: 3 }),
      S('transporte', 'Van para convidados (8 horas)', 'Van executiva com motorista para até 15 passageiros.', 'f', 900, 'van', { inc: 'Motorista, combustível, 8 horas', lead: 5 }),
      S('transporte', 'Transporte de equipamentos', 'Frete para mobiliário e equipamentos.', 'p', 250, 'viagem', { inc: 'Veículo e ajudante', lead: 3 }),
    ] },
  { name: 'Glow Beleza e Make', city: 'Rio de Janeiro', hood: 'Copacabana', plan: 'basico', verified: 1, cap: 2, notice: 5, travel: 50,
    desc: 'Maquiagem e penteados para noivas, madrinhas, debutantes e convidadas, no local do evento.', hours: 'Sob agendamento',
    areas: [A('cidade', { city: 'Rio de Janeiro' })], services: [
      S('beleza', 'Maquiagem social', 'Maquiagem para convidadas e madrinhas.', 'f', 220, 'pessoa', { inc: 'Maquiagem completa, cílios', lead: 5, feat: 1 }),
      S('beleza', 'Maquiagem e penteado de noiva', 'Inclui teste prévio.', 'p', 750, 'pessoa', { inc: 'Teste de make e cabelo, aplicação no dia', lead: 15, ev: 'casamento' }),
      S('beleza', 'Dia da noiva (cabelo, make e unhas)', 'Pacote completo para noivas e debutantes.', 'f', 1200, 'pessoa', { inc: 'Cabelo, make, manicure', lead: 15 }),
    ] },
  { name: 'Patinhas em Festa', city: 'São Paulo', hood: 'Moema', plan: 'basico', verified: 0, cap: 2, notice: 5, travel: 30,
    desc: 'Festas para pets: decoração, bolo pet e fotos para comemorar o aniversário do seu melhor amigo.', hours: 'Ter a dom, 10h às 18h',
    areas: [A('cidade', { city: 'São Paulo' })], services: [
      S('festas-pets', 'Decoração de festa pet', 'Mesa decorada, painel e balões.', 'p', 500, 'festa', { inc: 'Painel, mesa, balões', lead: 5, feat: 1 }),
      S('festas-pets', 'Bolo pet (por kg)', 'Bolo seguro para cães, sem açúcar e sem chocolate.', 'f', 70, 'kg', { inc: 'Bolo com cobertura de iogurte', min: 1, lead: 4 }),
      S('festas-pets', 'Fotografia pet', 'Sessão de fotos do aniversariante.', 'f', 250, 'sessão', { inc: '1h de fotos, 20 fotos tratadas', lead: 5 }),
    ] },
  { name: 'Festas do Zé Brinquedos', city: 'Campinas', hood: 'Cambuí', plan: 'basico', verified: 0, cap: 2, notice: 3, travel: 20, status: 'pendente',
    desc: 'Aluguel de brinquedos para festas infantis em Campinas. Cadastro recente, aguardando aprovação.', hours: 'Todos os dias, 8h às 18h',
    areas: [A('cidade', { city: 'Campinas' })], services: [
      S('brinquedos', 'Pula-pula 3x3', 'Pula-pula com rede de proteção.', 'f', 150, 'período', { inc: 'Montagem e desmontagem', lead: 3, feat: 1 }),
      S('brinquedos', 'Tobogã inflável', 'Tobogã para crianças de 4 a 10 anos.', 'f', 260, 'período', { inc: 'Montagem e monitor', lead: 3 }),
    ] },
];

const REVIEWS = [
  [5, 'Tudo perfeito! Chegou no horário e superou as expectativas.'], [5, 'Atendimento excelente e qualidade impecável. Recomendo!'], [4, 'Muito bom, só atrasou um pouquinho a entrega.'],
  [5, 'Os convidados elogiaram muito. Voltarei a contratar.'], [4, 'Ótimo custo-benefício e comunicação clara.'], [5, 'Profissionais atenciosos e muito cuidadosos.'],
];

const cents = (v) => Math.round(v * 100);

export function seed(db) {
  const pw = hashPassword(DEMO_PASSWORD);
  const tx = (fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };
  tx(() => {
    for (const c of CITIES) db.prepare('INSERT INTO cities(name,state,slug,lat,lng,cep_from,cep_to) VALUES(?,?,?,?,?,?,?)').run(c[0], c[1], slugify(c[0]), c[2], c[3], c[4], c[5]);
    CATS.forEach((c, i) => db.prepare('INSERT INTO categories(slug,name,icon,position) VALUES(?,?,?,?)').run(c[0], c[1], c[2], i));
    const user = (name, email, roles) => db.prepare('INSERT INTO users(name,email,password_hash,roles,consent_at) VALUES(?,?,?,?,datetime(\'now\'))').run(name, email, pw, roles).lastInsertRowid;
    user('Administração Agitaê', 'admin@agitae.test', 'cliente,admin');
    const clients = [user('Ana Souza', 'cliente@agitae.test', 'cliente'), user('Bruno Lima', 'bruno@agitae.test', 'cliente'), user('Carla Nunes', 'carla@agitae.test', 'cliente')];
    const catId = Object.fromEntries(db.prepare('SELECT id,slug FROM categories').all().map((c) => [c.slug, c.id]));
    const cityBy = Object.fromEntries(db.prepare('SELECT * FROM cities').all().map((c) => [c.name, c]));
    const t = today();
    let n = 0;
    for (const p of PROVIDERS) {
      const slug = slugify(p.name), city = cityBy[p.city];
      const key = slug.split('-')[0];
      const uid = user(p.name, `${slug}@agitae.test`, 'cliente,fornecedor');
      const pid = db.prepare(`INSERT INTO providers(user_id,slug,name,description,city,state,neighborhood,address,phone,hours,cover_url,logo_url,status,verified,plan,min_notice_days,capacity_per_day,travel_fee_cents,travel_policy,lat,lng)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid, slug, p.name, p.desc, city.name, city.state, p.hood, p.address || `Rua Exemplo, ${100 + n * 7} — ${p.hood} (endereço fictício)`, `(11) 9${1000 + n * 37}-0${100 + n}`, p.hours,
        `/img/capa-${slug}.svg?t=${encodeURIComponent(p.name)}`, `/img/logo-${slug}.svg?t=${encodeURIComponent(p.name.split(' ')[0])}`, p.status || 'aprovado', p.verified, p.plan, p.notice, p.cap, cents(p.travel),
        p.travel ? `Taxa de deslocamento de ${(p.travel).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para eventos fora de ${city.name}.` : 'Sem taxa de deslocamento na região atendida.', city.lat, city.lng).lastInsertRowid;
      for (const a of p.areas) {
        if (a.type === 'cidade') { const c = cityBy[a.city]; db.prepare("INSERT INTO service_areas(provider_id,type,city_slug,state,lat,lng) VALUES(?,?,?,?,?,?)").run(pid, 'cidade', c.slug, c.state, c.lat, c.lng); }
        else if (a.type === 'bairro') { const c = cityBy[a.city]; db.prepare('INSERT INTO service_areas(provider_id,type,city_slug,state,neighborhood,neighborhood_slug,lat,lng) VALUES(?,?,?,?,?,?,?,?)').run(pid, 'bairro', c.slug, c.state, a.hood, slugify(a.hood), c.lat, c.lng); }
        else if (a.type === 'raio') db.prepare("INSERT INTO service_areas(provider_id,type,lat,lng,radius_km) VALUES(?,?,?,?,?)").run(pid, 'raio', city.lat, city.lng, a.km);
        else db.prepare("INSERT INTO service_areas(provider_id,type,cep_from,cep_to) VALUES(?,?,?,?)").run(pid, 'cep', +a.from, +a.to);
      }
      const svcIds = [];
      p.services.forEach((s, i) => {
        const ck = s.cat.split('-')[0];
        const imgs = [`/img/${ck}-${key}${i}a.svg?t=${encodeURIComponent(s.name.slice(0, 30))}`, `/img/${ck}-${key}${i}b.svg?t=${encodeURIComponent(p.name.slice(0, 30))}`];
        const sid = db.prepare(`INSERT INTO services(provider_id,category_id,name,description,price_type,price_cents,unit,includes,min_qty,lead_days,delivery_policy,cancel_policy,event_types,images,featured)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(pid, catId[s.cat], s.name, s.desc, { f: 'fechado', p: 'a_partir_de', o: 'orcamento', t: 'fechado' }[s.t], cents(s.price), s.unit, s.inc || null, s.min || 1, s.lead ?? 2,
          p.travel ? `Entrega ou deslocamento gratuitos em ${city.name}; fora dela, taxa de ${p.travel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.` : 'Sem custo de deslocamento na região atendida.',
          'Reembolso de 100% até 7 dias antes, 50% de 2 a 6 dias, sem reembolso com menos de 2 dias.', s.ev || null, JSON.stringify(imgs), s.feat ? 1 : 0).lastInsertRowid;
        for (const [on, op] of s.opts || []) db.prepare('INSERT INTO service_options(service_id,name,price_cents) VALUES(?,?,?)').run(sid, on, cents(op));
        svcIds.push(sid);
      });
      for (let i = 1; i <= 4; i++) db.prepare('INSERT INTO provider_media(provider_id,type,url,caption) VALUES(?,?,?,?)').run(pid, 'imagem', `/img/${p.services[0].cat.split('-')[0]}-${key}-p${i}.svg?t=${encodeURIComponent('Portfólio ' + i)}`, `Trabalho ${i} (imagem fictícia)`);
      db.prepare('INSERT INTO provider_media(provider_id,type,url,caption) VALUES(?,?,?,?)').run(pid, 'video', 'https://example.com/agitae-video-demonstracao', 'Vídeo de apresentação (link fictício de demonstração)');
      // histórico: 3 pedidos concluídos com avaliação (apenas fornecedores aprovados)
      if ((p.status || 'aprovado') === 'aprovado') for (let k = 0; k < 3; k++) {
        const s = p.services.find((x) => x.t !== 'o'), sid = svcIds[p.services.indexOf(s)];
        const qty = Math.max(1, s.min || 1), total = cents(s.price) * qty, comm = Math.round(total * 0.075);
        const d = addDays(t, -20 - k * 15 - n);
        const oid = db.prepare(`INSERT INTO orders(user_id,provider_id,status,event_date,address,city,items_cents,total_cents,commission_bps,commission_cents,net_cents,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(clients[k % 3], pid, 'concluido', d, 'Endereço do evento (fictício)', city.name, total, total, 750, comm, total - comm, addDays(d, -12) + ' 12:00:00').lastInsertRowid;
        db.prepare('INSERT INTO order_items(order_id,service_id,name,qty,unit,unit_cents,total_cents) VALUES(?,?,?,?,?,?,?)').run(oid, sid, s.name, qty, s.unit, cents(s.price), total);
        for (const st of ['solicitado', 'aguardando_resposta', 'aguardando_pagamento', 'confirmado', 'concluido']) db.prepare('INSERT INTO order_history(order_id,status,actor) VALUES(?,?,?)').run(oid, st, 'demo');
        db.prepare("INSERT INTO payments(order_id,provider,external_id,amount_cents,status,paid_at) VALUES(?,?,?,?,?,datetime('now'))").run(oid, 'teste', `test_seed_${oid}`, total, 'aprovado');
        db.prepare("INSERT INTO payouts(provider_id,order_id,amount_cents,status,paid_at) VALUES(?,?,?,?,datetime('now'))").run(pid, oid, total - comm, 'pago');
        const rv = REVIEWS[(n + k) % REVIEWS.length];
        db.prepare('INSERT INTO reviews(order_id,provider_id,user_id,rating,comment,status,reply) VALUES(?,?,?,?,?,?,?)').run(oid, pid, clients[k % 3], rv[0], rv[1], 'publicada', k === 0 ? 'Obrigado pela confiança! Foi um prazer participar da sua festa.' : null);
      }
      n++;
    }
    // Agenda: Luz e Cor tem uma data já reservada (hoje + 30 dias) — útil para testar a comparação por data
    const luz = db.prepare("SELECT id FROM providers WHERE slug='luz-e-cor-fotografia'").get();
    const d30 = addDays(t, 30);
    const oid = db.prepare(`INSERT INTO orders(user_id,provider_id,status,event_date,address,city,items_cents,total_cents,commission_bps,commission_cents,net_cents) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(clients[1], luz.id, 'confirmado', d30, 'Salão Exemplo (fictício)', 'São Paulo', 110000, 110000, 700, 7700, 102300).lastInsertRowid;
    db.prepare('INSERT INTO order_items(order_id,name,qty,unit,unit_cents,total_cents) VALUES(?,?,?,?,?,?)').run(oid, 'Cobertura fotográfica de 4 horas', 1, 'cobertura', 110000, 110000);
    db.prepare('INSERT INTO order_history(order_id,status,actor) VALUES(?,?,?)').run(oid, 'confirmado', 'demo');
    db.prepare('INSERT INTO availability_blocks(provider_id,date,reason) VALUES(?,?,?)').run(luz.id, addDays(t, 45), 'Viagem');
    db.prepare("INSERT INTO coupons(code,kind,value) VALUES('BEMVINDO10','percentual',10),('FESTA50','fixo',5000)").run();
    db.prepare("INSERT INTO banners(title,text,link,position) VALUES(?,?,?,0),(?,?,?,1)").run('Primeira festa na Agitaê?', 'Use o cupom BEMVINDO10 e ganhe 10% de desconto.', '#/busca', 'Fornecedor? Cadastre-se grátis', 'Sem mensalidade: você só paga a comissão quando vender.', '#/fornecedor/cadastro');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  try { process.loadEnvFile(path.join(root, '.env')); } catch {}
  const file = path.resolve(root, process.env.DATABASE_FILE || './data/agitae.db');
  if (process.argv.includes('--reset')) for (const s of ['', '-wal', '-shm']) fs.rmSync(file + s, { force: true });
  const db = openDb(file);
  if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) { console.log('O banco já possui dados. Use --reset para recriar.'); process.exit(1); }
  seed(db);
  console.log(`Dados de demonstração criados em ${file}\nLogins (senha: ${DEMO_PASSWORD}): cliente@agitae.test · admin@agitae.test · doce-sabor-confeitaria@agitae.test · luz-e-cor-fotografia@agitae.test`);
}
