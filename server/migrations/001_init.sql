CREATE TABLE users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  roles TEXT NOT NULL DEFAULT 'cliente', phone TEXT, consent_at TEXT, deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE sessions(
  token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE cities(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  lat REAL NOT NULL, lng REAL NOT NULL, cep_from INTEGER, cep_to INTEGER);
CREATE TABLE categories(
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '🎉',
  description TEXT, position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE providers(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, description TEXT, city TEXT NOT NULL, state TEXT NOT NULL, neighborhood TEXT, address TEXT,
  lat REAL, lng REAL, phone TEXT, hours TEXT, cover_url TEXT, logo_url TEXT, document TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','aprovado','suspenso','rejeitado')),
  verified INTEGER NOT NULL DEFAULT 0, min_notice_days INTEGER NOT NULL DEFAULT 2,
  capacity_per_day INTEGER NOT NULL DEFAULT 1, travel_fee_cents INTEGER NOT NULL DEFAULT 0,
  travel_policy TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_providers_status_city ON providers(status, city);
CREATE TABLE service_areas(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN('cidade','bairro','cep','raio')),
  city_slug TEXT, state TEXT, neighborhood TEXT, neighborhood_slug TEXT, cep_from INTEGER, cep_to INTEGER,
  lat REAL, lng REAL, radius_km REAL);
CREATE INDEX idx_areas_city ON service_areas(city_slug, type);
CREATE INDEX idx_areas_neigh ON service_areas(neighborhood_slug);
CREATE INDEX idx_areas_cep ON service_areas(cep_from, cep_to);
CREATE INDEX idx_areas_provider ON service_areas(provider_id);
CREATE TABLE services(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id), name TEXT NOT NULL, description TEXT,
  price_type TEXT NOT NULL CHECK(price_type IN('fechado','a_partir_de','orcamento')),
  price_cents INTEGER NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'unidade',
  includes TEXT, min_qty INTEGER NOT NULL DEFAULT 1, lead_days INTEGER NOT NULL DEFAULT 0,
  delivery_policy TEXT, cancel_policy TEXT, event_types TEXT, images TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_services_cat ON services(category_id, active, hidden);
CREATE INDEX idx_services_provider ON services(provider_id);
CREATE TABLE service_options(
  id INTEGER PRIMARY KEY, service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name TEXT NOT NULL, price_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE provider_media(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'imagem' CHECK(type IN('imagem','video')), url TEXT NOT NULL, caption TEXT,
  hidden INTEGER NOT NULL DEFAULT 0);
CREATE TABLE availability_blocks(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  date TEXT NOT NULL, reason TEXT, UNIQUE(provider_id, date));
CREATE TABLE events(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, date TEXT,
  address TEXT, city TEXT, state TEXT, neighborhood TEXT, type TEXT, guests INTEGER, budget_cents INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_events_user ON events(user_id);
CREATE TABLE event_items(
  id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id), qty INTEGER NOT NULL DEFAULT 1,
  option_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE favorites(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE, PRIMARY KEY(user_id, provider_id));
CREATE TABLE coupons(
  id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN('percentual','fixo')),
  value INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, expires_at TEXT, max_uses INTEGER, uses INTEGER NOT NULL DEFAULT 0);
CREATE TABLE quote_requests(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), provider_id INTEGER NOT NULL REFERENCES providers(id),
  service_id INTEGER REFERENCES services(id), event_id INTEGER REFERENCES events(id),
  date TEXT NOT NULL, location TEXT, city TEXT, duration TEXT, guests INTEGER, notes TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando_resposta', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_quotes_provider ON quote_requests(provider_id, status);
CREATE INDEX idx_quotes_user ON quote_requests(user_id);
CREATE TABLE proposals(
  id INTEGER PRIMARY KEY, quote_id INTEGER NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  provider_id INTEGER NOT NULL REFERENCES providers(id), price_cents INTEGER NOT NULL, details TEXT NOT NULL,
  conditions TEXT, valid_until TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'enviada' CHECK(status IN('enviada','aceita','recusada','expirada','substituida')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE orders(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), provider_id INTEGER NOT NULL REFERENCES providers(id),
  event_id INTEGER REFERENCES events(id), quote_id INTEGER REFERENCES quote_requests(id), proposal_id INTEGER REFERENCES proposals(id),
  status TEXT NOT NULL, event_date TEXT NOT NULL, address TEXT, city TEXT, notes TEXT,
  items_cents INTEGER NOT NULL, options_cents INTEGER NOT NULL DEFAULT 0, travel_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0, fee_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL,
  commission_bps INTEGER NOT NULL, commission_cents INTEGER NOT NULL, net_cents INTEGER NOT NULL,
  coupon_code TEXT, refunded_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_provider_date ON orders(provider_id, event_date, status);
CREATE TABLE order_items(
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id), name TEXT NOT NULL, qty INTEGER NOT NULL, unit TEXT,
  unit_cents INTEGER NOT NULL, options TEXT NOT NULL DEFAULT '[]', options_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL);
CREATE TABLE order_history(
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL, note TEXT, actor TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE payments(
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), provider TEXT NOT NULL, external_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT UNIQUE, amount_cents INTEGER NOT NULL, method TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','aprovado','falhou','estornado','estorno_parcial')),
  refunded_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), paid_at TEXT);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE TABLE webhook_events(id TEXT PRIMARY KEY, type TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE payouts(
  id INTEGER PRIMARY KEY, provider_id INTEGER NOT NULL REFERENCES providers(id), order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
  amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','pago','cancelado')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), paid_at TEXT);
CREATE TABLE messages(
  id INTEGER PRIMARY KEY, thread_kind TEXT NOT NULL CHECK(thread_kind IN('order','quote')), thread_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_messages_thread ON messages(thread_kind, thread_id);
CREATE TABLE reviews(
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id), provider_id INTEGER NOT NULL REFERENCES providers(id),
  user_id INTEGER NOT NULL REFERENCES users(id), rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN('pendente','publicada','rejeitada')), reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_reviews_provider ON reviews(provider_id, status);
CREATE TABLE invites(
  id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL, message TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE rsvps(
  id INTEGER PRIMARY KEY, invite_id INTEGER NOT NULL REFERENCES invites(id) ON DELETE CASCADE, name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN('vou','talvez','nao_vou')), companions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, body TEXT,
  link TEXT, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX idx_notif_user ON notifications(user_id, read);
CREATE TABLE emails(
  id INTEGER PRIMARY KEY, to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'outbox', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE banners(
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, text TEXT, link TEXT, active INTEGER NOT NULL DEFAULT 1, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE audit_log(
  id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, entity TEXT, entity_id INTEGER, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE deletion_requests(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'concluida', created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE uploads(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, filename TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
INSERT INTO settings(key,value) VALUES('commission_bps','750'),('customer_fee_bps','0');
