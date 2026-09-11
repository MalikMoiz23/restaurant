import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Menu, MenuItem } from '../../lib/api';
import { euro } from '../../lib/format';
import { DishArt } from '../../lib/DishArt';
import { Icon, iconFor } from '../../lib/Icon';
import { useI18n } from '../../i18n';
import { useCart } from '../../store';
import {
  Badge, Button, Chip, EmptyState, Sheet, Stepper, SPRING, cn, useToast,
} from '../../ui';

export function MenuBrowser({
  menu,
  onOpenCart,
}: {
  menu: Menu;
  onOpenCart: () => void;
}) {
  const { t, locale } = useI18n();
  const [category, setCategory] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [hiddenAllergens, setHiddenAllergens] = useState<string[]>([]);
  const [requiredDiets, setRequiredDiets] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const filterCount = hiddenAllergens.length + requiredDiets.length;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return menu.items.filter((item) => {
      if (category !== 'all' && item.category_id !== category) return false;
      if (needle && !`${item.name} ${item.description}`.toLowerCase().includes(needle)) return false;
      // An allergen filter is a safety filter, so it hides the dish
      // entirely rather than merely flagging it.
      if (hiddenAllergens.some((code) => item.allergens.includes(code))) return false;
      if (requiredDiets.length && !requiredDiets.every((code) => item.diets.includes(code))) return false;
      return true;
    });
  }, [menu.items, category, search, hiddenAllergens, requiredDiets]);

  // Group into category sections so the menu still reads like a menu
  // when no category is selected.
  const sections = useMemo(() => {
    if (category !== 'all') {
      const cat = menu.categories.find((c) => c.id === category);
      return cat ? [{ category: cat, items: visible }] : [];
    }
    return menu.categories
      .map((cat) => ({ category: cat, items: visible.filter((i) => i.category_id === cat.id) }))
      .filter((section) => section.items.length > 0);
  }, [menu.categories, visible, category]);

  return (
    <div className="pt-4">
      <div className="sticky top-[104px] z-20 -mx-4 mb-4 bg-cal-50/90 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-cal-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('menu.searchPlaceholder')}
              className="h-12 w-full rounded-2xl bg-white pl-11 pr-10 text-sm shadow-plate hairline placeholder:text-cal-400"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-cal-200 text-cal-600"
                aria-label={t('common.clear')}
              >
                <Icon name="x" className="size-3.5" strokeWidth={2.4} />
              </button>
            )}
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className={cn(
              'inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-medium shadow-plate transition',
              filterCount > 0
                ? 'bg-azul-600 text-white'
                : 'bg-white text-cal-700 hairline hover:bg-cal-50',
            )}
          >
            <Icon name="filter" className="size-4.5" />
            <span className="hidden sm:inline">{t('menu.filters')}</span>
            {filterCount > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 text-xs tnum">{filterCount}</span>
            )}
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <Chip active={category === 'all'} onClick={() => setCategory('all')} icon="grid">
            {t('menu.categoryAll')}
          </Chip>
          {menu.categories.map((cat) => (
            <Chip
              key={cat.id}
              active={category === cat.id}
              onClick={() => setCategory(cat.id)}
              icon={iconFor(cat.icon)}
            >
              {cat.name}
            </Chip>
          ))}
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          icon="search"
          title={t('menu.noResults')}
          body={t('menu.noResultsHint')}
          action={
            <Button
              onClick={() => {
                setHiddenAllergens([]);
                setRequiredDiets([]);
                setSearch('');
              }}
            >
              {t('menu.clearFilters')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-9">
          {sections.map((section) => (
            <section key={section.category.id}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-xl bg-azul-50 text-azul-600">
                  <Icon name={iconFor(section.category.icon)} className="size-4.5" />
                </span>
                <h2 className="display text-xl font-semibold text-cal-900">
                  {section.category.name}
                </h2>
                <span className="text-sm text-cal-400 tnum">{section.items.length}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item, index) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    index={index}
                    locale={locale}
                    onOpen={() => setSelected(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <FiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        menu={menu}
        hiddenAllergens={hiddenAllergens}
        requiredDiets={requiredDiets}
        setHiddenAllergens={setHiddenAllergens}
        setRequiredDiets={setRequiredDiets}
      />

      <ItemSheet
        item={selected}
        onClose={() => setSelected(null)}
        onAdded={() => {
          setSelected(null);
          onOpenCart();
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

function DishCard({
  item, index, locale, onOpen,
}: {
  item: MenuItem;
  index: number;
  locale: 'pt' | 'en' | 'es' | 'fr';
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const isHouse = item.diets.includes('house');

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index * 0.035, 0.28) }}
      whileHover={item.available ? { y: -3 } : undefined}
      whileTap={item.available ? { scale: 0.985 } : undefined}
      onClick={item.available ? onOpen : undefined}
      disabled={!item.available}
      className={cn(
        'group relative flex overflow-hidden rounded-plate bg-white text-left shadow-plate hairline transition-shadow',
        item.available ? 'hover:shadow-lift' : 'opacity-60',
      )}
    >
      <div className="relative w-28 shrink-0 overflow-hidden sm:w-32">
        <DishArt
          glyph={item.glyph}
          seed={item.sku}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {!item.available && (
          <div className="absolute inset-0 grid place-items-center bg-cal-900/55">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-cal-800">
              {t('menu.soldOut')}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-cal-900">
            {item.name}
          </h3>
          {isHouse && <Icon name="STAR" className="mt-0.5 size-4 shrink-0 text-barro-500" filled />}
        </div>

        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-cal-500">
          {item.description}
        </p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div className="flex flex-wrap gap-1">
            {item.diets.filter((d) => d !== 'house').slice(0, 2).map((code) => (
              <span
                key={code}
                className="grid size-6 place-items-center rounded-lg bg-oliva-300/25 text-oliva-600"
                title={code}
              >
                <Icon name={iconFor(dietIcon(code))} className="size-3.5" strokeWidth={2} />
              </span>
            ))}
            {item.allergens.length > 0 && (
              <span className="grid h-6 items-center rounded-lg bg-cal-100 px-1.5 text-[11px] font-medium text-cal-500 tnum">
                {item.allergens.length} ⚠
              </span>
            )}
          </div>

          <span className="shrink-0 text-[15px] font-semibold text-cal-900 tnum">
            {euro(item.price_cents, locale)}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function dietIcon(code: string): string {
  return {
    vegan: 'LEAF',
    vegetarian: 'SPROUT',
    gluten_free: 'NOGLUTEN',
    spicy: 'CHILLI',
    house: 'STAR',
  }[code] ?? 'LEAF';
}

// ---------------------------------------------------------------------

function ItemSheet({
  item, onClose, onAdded,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t, locale } = useI18n();
  const add = useCart((s) => s.add);
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  // Reset whenever a different dish is opened.
  const key = item?.id ?? 0;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setQty(1);
    setNote('');
  }

  return (
    <Sheet
      open={!!item}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        item && (
          <div className="flex items-center gap-3">
            <Stepper value={qty} onChange={setQty} min={1} max={20} size="lg" />
            <Button
              size="lg"
              variant="primary"
              className="flex-1"
              onClick={() => {
                add(item, qty, note.trim(), null);
                toast({
                  tone: 'success',
                  title: t('menu.added'),
                  body: `${qty} × ${item.name}`,
                  icon: 'check',
                });
                onAdded();
              }}
            >
              {t('menu.addToOrder')}
              <span className="ml-auto tnum">{euro(item.price_cents * qty, locale)}</span>
            </Button>
          </div>
        )
      }
    >
      {item && (
        <div className="pb-2">
          <div className="relative -mx-5 mb-4 h-52 overflow-hidden sm:h-60">
            <DishArt glyph={item.glyph} seed={item.sku} className="size-full object-cover" />
          </div>

          <div className="flex items-start gap-3">
            <h2 className="display flex-1 text-2xl leading-tight font-semibold text-cal-900">
              {item.name}
            </h2>
            <span className="shrink-0 text-xl font-semibold text-cal-900 tnum">
              {euro(item.price_cents, locale)}
            </span>
          </div>

          <p className="mt-2 leading-relaxed text-cal-600">{item.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.diets.includes('house') && (
              <Badge tone="barro" icon="STAR">{t('menu.houseSpecial')}</Badge>
            )}
            <Badge tone="neutral" icon="clock">
              {t('menu.prepTime', { n: item.prep_minutes })}
            </Badge>
            {item.diets.filter((d) => d !== 'house').map((code) => (
              <Badge key={code} tone="oliva" icon={iconFor(dietIcon(code))}>
                {code.replace('_', ' ')}
              </Badge>
            ))}
          </div>

          {item.is_alcoholic && (
            <div className="mt-4 flex gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-sm text-amber-900">
              <Icon name="alert" className="mt-0.5 size-4.5 shrink-0" />
              {t('menu.alcoholNotice')}
            </div>
          )}

          {item.allergens.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-cal-800">{t('menu.contains')}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.allergens.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-barro-50 px-2.5 py-1.5 text-[13px] font-medium text-barro-700"
                  >
                    <Icon name={iconFor(allergenIcon(code))} className="size-4" />
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-cal-800">
              {t('common.notes')}
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('menu.itemNote')}
              rows={2}
              maxLength={140}
              className="w-full resize-none rounded-2xl bg-white p-3.5 text-sm shadow-plate hairline placeholder:text-cal-400"
            />
          </label>
        </div>
      )}
    </Sheet>
  );
}

function allergenIcon(code: string): string {
  return {
    gluten: 'WHEAT', crustaceans: 'SHRIMP', eggs: 'EGG', fish: 'FISH',
    peanuts: 'PEANUT', soy: 'SOY', milk: 'MILK', nuts: 'NUT',
    celery: 'CELERY', mustard: 'MUSTARD', sesame: 'SESAME',
    sulphites: 'SULPHITE', lupin: 'LUPIN', molluscs: 'SQUID',
  }[code] ?? 'info';
}

// ---------------------------------------------------------------------

function FiltersSheet({
  open, onClose, menu, hiddenAllergens, requiredDiets, setHiddenAllergens, setRequiredDiets,
}: {
  open: boolean;
  onClose: () => void;
  menu: Menu;
  hiddenAllergens: string[];
  requiredDiets: string[];
  setHiddenAllergens: (v: string[]) => void;
  setRequiredDiets: (v: string[]) => void;
}) {
  const { t } = useI18n();

  const toggle = (list: string[], code: string, set: (v: string[]) => void) =>
    set(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('menu.filters')}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-3">
          <Button
            variant="quiet"
            size="lg"
            className="flex-1"
            onClick={() => {
              setHiddenAllergens([]);
              setRequiredDiets([]);
            }}
          >
            {t('menu.clearFilters')}
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={onClose}>
            {t('common.apply')}
          </Button>
        </div>
      }
    >
      <div className="pb-2">
        <p className="mb-2.5 text-sm font-semibold text-cal-800">{t('menu.dietShow')}</p>
        <div className="flex flex-wrap gap-2">
          {menu.diets.filter((d) => d.code !== 'house').map((diet) => (
            <Chip
              key={diet.code}
              active={requiredDiets.includes(diet.code)}
              onClick={() => toggle(requiredDiets, diet.code, setRequiredDiets)}
              icon={iconFor(diet.icon)}
            >
              {diet.name}
            </Chip>
          ))}
        </div>

        <p className="mt-6 mb-2.5 text-sm font-semibold text-cal-800">{t('menu.allergensHide')}</p>
        <div className="grid grid-cols-2 gap-2">
          {menu.allergens.map((allergen) => {
            const active = hiddenAllergens.includes(allergen.code);
            return (
              <button
                key={allergen.code}
                onClick={() => toggle(hiddenAllergens, allergen.code, setHiddenAllergens)}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left text-sm transition',
                  active
                    ? 'bg-barro-500 text-white shadow-plate'
                    : 'bg-white text-cal-700 hairline hover:bg-cal-50',
                )}
              >
                <Icon name={iconFor(allergen.icon)} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{allergen.name}</span>
                {active && <Icon name="check" className="size-4 shrink-0" strokeWidth={2.4} />}
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
