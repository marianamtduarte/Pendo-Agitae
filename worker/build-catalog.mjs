// Gera worker/catalog.generated.json: um retrato achatado (serviços + fornecedor + áreas) do catálogo de
// demonstração, para o Worker do assistente usar SEM banco de dados. É o mesmo seed real do site
// (server/seed.js) — só reorganizado em uma lista simples para busca em JavaScript puro.
// Rode: node worker/build-catalog.mjs (o demo/build.js já chama isto automaticamente).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { providerRatings } from '../server/domain.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const db = openDb(':memory:');
seed(db);

const ratings = providerRatings(db);
const areasByProvider = new Map();
for (const a of db.prepare('SELECT * FROM service_areas').all()) {
  const list = areasByProvider.get(a.provider_id) || []; areasByProvider.set(a.provider_id, list);
  if (a.type === 'cidade') { const c = db.prepare('SELECT name FROM cities WHERE slug=?').get(a.city_slug); if (c) list.push(c.name); }
  else if (a.type === 'bairro') list.push(a.neighborhood);
}

const rows = db.prepare(`
  SELECT s.name service, s.price_type, s.price_cents, s.unit, s.min_qty,
         p.id provider_id, p.name provider, p.slug, p.city, p.state, p.verified, p.plan,
         c.slug category, c.name category_name
  FROM services s JOIN providers p ON p.id=s.provider_id JOIN categories c ON c.id=s.category_id
  WHERE p.status='aprovado' AND s.active=1 AND s.hidden=0 AND c.active=1
  ORDER BY p.name, s.name
`).all();

const catalog = rows.map((r) => {
  const rt = ratings.get(r.provider_id) || {};
  return {
    service: r.service, provider: r.provider, slug: r.slug, city: r.city, state: r.state,
    category: r.category, category_name: r.category_name, price_type: r.price_type, price_cents: r.price_cents,
    unit: r.unit, min_qty: r.min_qty, verified: !!r.verified, premium: r.plan === 'premium',
    rating: rt.rating ?? null, review_count: rt.review_count ?? 0, areas: areasByProvider.get(r.provider_id) || [r.city],
  };
});

const out = path.join(root, 'catalog.generated.json');
await import('node:fs').then((fs) => fs.writeFileSync(out, JSON.stringify(catalog)));
console.log(`worker/catalog.generated.json gerado com ${catalog.length} itens de ${new Set(catalog.map((c) => c.slug)).size} fornecedores.`);
