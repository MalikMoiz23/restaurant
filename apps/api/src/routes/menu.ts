import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q, one, audit, broadcast } from '../core.js';

const localeSchema = z.enum(['pt', 'en', 'es', 'fr']).default('pt');

export default async function menuRoutes(app: FastifyInstance) {
  /**
   * The whole menu for one locale, in a single round trip, so a tablet
   * can cache it and keep serving guests if the LAN blips.
   */
  app.get('/api/menu', async (req) => {
    const locale = localeSchema.parse((req.query as any)?.locale ?? 'pt');

    const categories = await q(
      `select c.id, c.code, c.icon, c.sort_order, i.name
         from menu_category c
         join menu_category_i18n i on i.category_id = c.id and i.locale = $1
        where c.active
        order by c.sort_order`,
      [locale],
    );

    const items = await q(
      `select m.id, m.category_id, m.sku, m.price_cents, m.vat_rate, m.glyph,
              m.available, m.is_alcoholic, m.prep_minutes, m.kitchen_station,
              m.sort_order, i.name, i.description,
              coalesce(al.codes, '{}') as allergens,
              coalesce(dt.codes, '{}') as diets
         from menu_item m
         join menu_item_i18n i on i.item_id = m.id and i.locale = $1
         left join (
           select item_id, array_agg(allergen_code order by allergen_code) as codes
             from menu_item_allergen group by item_id
         ) al on al.item_id = m.id
         left join (
           select item_id, array_agg(diet_code order by diet_code) as codes
             from menu_item_diet group by item_id
         ) dt on dt.item_id = m.id
        order by m.category_id, m.sort_order`,
      [locale],
    );

    // The column name cannot be a bind parameter. `locale` has already
    // been narrowed to one of four literals by the schema above, and we
    // map it through a fixed table so no request value reaches the SQL.
    const nameColumn = { pt: 'name_pt', en: 'name_en', es: 'name_es', fr: 'name_fr' }[locale];

    const allergens = await q(
      `select code, ${nameColumn} as name, icon from allergen order by code`,
    );
    const diets = await q(
      `select code, ${nameColumn} as name, icon from diet_tag order by code`,
    );

    return { locale, categories, items, allergens, diets };
  });

  /** Mark an item sold out / back on. Used by the kitchen screen. */
  app.patch('/api/menu/:id/availability', async (req, reply) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    const { available } = z.object({ available: z.boolean() }).parse(req.body);

    const row = await one(
      `update menu_item set available = $2 where id = $1 returning id, available`,
      [id, available],
    );
    if (!row) return reply.code(404).send({ error: 'item_not_found' });

    await audit('menu_item', String(id), available ? 'restocked' : 'sold_out', { available },
      req.staff?.id ?? null, req.ip);
    broadcast({ type: 'menu.updated', itemId: id, available });
    return row;
  });
}
