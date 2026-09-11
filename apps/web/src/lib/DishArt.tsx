/**
 * Dish illustration system.
 *
 * Rather than stock photography - which no independent restaurant has
 * for every dish, and which would break the offline guarantee - each
 * item is drawn as a piece of glazed tableware: a vessel form plus the
 * colours of what is served in it, over an azulejo ground.
 *
 * Six vessel forms cover the whole menu, so fifty dishes still read as
 * one designed set. The small variations (garnish placement, the shape
 * of the food mass) are derived from the item's own SKU, so a given
 * dish always looks the same without anyone hand-placing anything.
 */

type Vessel = 'plate' | 'bowl' | 'cup' | 'glass' | 'bottle' | 'board';

type Palette = {
  vessel: 'ceramic' | 'glass' | 'dark';
  food: [string, string];
  garnish: string;
  ground: string;
};

const FORM: Record<string, { vessel: Vessel; palette: Palette }> = {
  BREAD:    { vessel: 'board', palette: p('ceramic', ['#e0b978', '#c2923f'], '#7d8a4e', '#f3ead9') },
  OLIVE:    { vessel: 'bowl',  palette: p('ceramic', ['#7d8a4e', '#5b6636'], '#c1613c', '#eef0e2') },
  CHEESE:   { vessel: 'board', palette: p('ceramic', ['#f0dc9a', '#ddbf63'], '#a44e2d', '#f6efdc') },
  HAM:      { vessel: 'board', palette: p('ceramic', ['#d98b8b', '#b45f5f'], '#f0dc9a', '#f7e8e4') },
  SAUSAGE:  { vessel: 'plate', palette: p('ceramic', ['#a84b32', '#7d3421'], '#7d8a4e', '#f7e6df') },
  MEAT:     { vessel: 'plate', palette: p('ceramic', ['#96543a', '#6d3a26'], '#c99a3f', '#f4e7de') },
  STEAK:    { vessel: 'plate', palette: p('ceramic', ['#8a3f2e', '#5e281c'], '#7d8a4e', '#f4e4de') },
  CHICKEN:  { vessel: 'plate', palette: p('ceramic', ['#d9a34e', '#b07a2e'], '#a84b32', '#f8eedb') },
  POT:      { vessel: 'bowl',  palette: p('ceramic', ['#a4703c', '#78502a'], '#7d8a4e', '#f4e9dc') },
  SHELL:    { vessel: 'bowl',  palette: p('ceramic', ['#e4d6bd', '#c0ab8a'], '#7d8a4e', '#f2ece0') },
  FISH:     { vessel: 'plate', palette: p('ceramic', ['#b9cbd8', '#8aa4b6'], '#c99a3f', '#e9f0f5') },
  SQUID:    { vessel: 'plate', palette: p('ceramic', ['#b98f9c', '#8d6673'], '#7d8a4e', '#f2e9ed') },
  SHRIMP:   { vessel: 'plate', palette: p('ceramic', ['#e08a66', '#bd6140'], '#7d8a4e', '#fae9e0') },
  BOWL:     { vessel: 'bowl',  palette: p('ceramic', ['#8d9a63', '#68753f'], '#c99a3f', '#eff1e6') },
  BROCCOLI: { vessel: 'plate', palette: p('ceramic', ['#6f9155', '#4c6b39'], '#c99a3f', '#eaf1e6') },
  RICE:     { vessel: 'plate', palette: p('ceramic', ['#efe6d2', '#d4c4a4'], '#7d8a4e', '#f7f2e7') },
  SANDWICH: { vessel: 'plate', palette: p('ceramic', ['#dfab63', '#bd8433'], '#a84b32', '#f8eddb') },
  BURGER:   { vessel: 'plate', palette: p('ceramic', ['#d9a24f', '#a9702c'], '#6f9155', '#f8eede') },
  TART:     { vessel: 'plate', palette: p('ceramic', ['#f2cf7a', '#d9a63f'], '#7d4a2a', '#fbf1dc') },
  PUDDING:  { vessel: 'plate', palette: p('ceramic', ['#d6a564', '#a9752f'], '#7d4a2a', '#f8eedd') },
  CHOCO:    { vessel: 'plate', palette: p('ceramic', ['#6b4534', '#402620'], '#e4d6bd', '#efe4dd') },
  CAKE:     { vessel: 'plate', palette: p('ceramic', ['#e0c39a', '#bd9a67'], '#6b4534', '#f7eee2') },
  COFFEE:   { vessel: 'cup',   palette: p('ceramic', ['#5a3423', '#382015'], '#e4d6bd', '#f1e8e2') },
  TEA:      { vessel: 'cup',   palette: p('ceramic', ['#c98f42', '#9c6725'], '#7d8a4e', '#f7eedc') },
  WATER:    { vessel: 'bottle',palette: p('glass',   ['#bcd9e8', '#8ab6cd'], '#5793c5', '#e8f2f7') },
  SODA:     { vessel: 'glass', palette: p('glass',   ['#7d4a2a', '#4e2a17'], '#c1613c', '#f1e7e1') },
  JUICE:    { vessel: 'glass', palette: p('glass',   ['#f0a83f', '#d17d1c'], '#7d8a4e', '#fbeedb') },
  BEER:     { vessel: 'glass', palette: p('glass',   ['#e8b444', '#c58c1d'], '#f4ecd4', '#fbf1dc') },
  WINE:     { vessel: 'glass', palette: p('glass',   ['#8d2f43', '#5c1a2a'], '#c99a3f', '#f3e4e7') },
  LIQUEUR:  { vessel: 'glass', palette: p('glass',   ['#a8213c', '#701226'], '#f0dc9a', '#f6e3e6') },
  COCKTAIL: { vessel: 'glass', palette: p('glass',   ['#e08a8a', '#bf5f68'], '#7d8a4e', '#f9e8e8') },
  UTENSILS: { vessel: 'plate', palette: p('ceramic', ['#d5c9b6', '#b0a291'], '#8a7d6d', '#f4efe6') },
};

function p(
  vessel: Palette['vessel'],
  food: [string, string],
  garnish: string,
  ground: string,
): Palette {
  return { vessel, food, garnish, ground };
}

/** Stable small integer from a string, for per-dish variation. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function DishArt({
  glyph,
  seed = glyph,
  className = '',
  hideGround = false,
}: {
  glyph: string;
  /** Usually the SKU: drives the per-dish variation. */
  seed?: string;
  className?: string;
  hideGround?: boolean;
}) {
  const form = FORM[glyph] ?? FORM.UTENSILS!;
  const { vessel, palette } = form;
  const h = hash(seed);
  const gradId = `dish-${glyph}-${h % 9973}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${gradId}-food`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={palette.food[0]} />
          <stop offset="100%" stopColor={palette.food[1]} />
        </linearGradient>
        <linearGradient id={`${gradId}-ground`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={palette.ground} />
          <stop offset="100%" stopColor={shade(palette.ground, -8)} />
        </linearGradient>
        <pattern id={`${gradId}-tile`} width="24" height="24" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#1d3f63" strokeOpacity="0.16" strokeWidth="1">
            <path d="M12 1 L23 12 L12 23 L1 12 Z" />
            <circle cx="12" cy="12" r="2" />
          </g>
        </pattern>
      </defs>

      {!hideGround && (
        <>
          <rect width="120" height="120" fill={`url(#${gradId}-ground)`} />
          <rect width="120" height="120" fill={`url(#${gradId}-tile)`} />
        </>
      )}

      <g transform="translate(60 62)">
        {vessel === 'plate' && <Plate grad={gradId} palette={palette} h={h} />}
        {vessel === 'bowl' && <Bowl grad={gradId} palette={palette} h={h} />}
        {vessel === 'board' && <Board grad={gradId} palette={palette} h={h} />}
        {vessel === 'cup' && <Cup grad={gradId} palette={palette} />}
        {vessel === 'glass' && <Glass grad={gradId} palette={palette} />}
        {vessel === 'bottle' && <Bottle grad={gradId} palette={palette} />}
      </g>
    </svg>
  );
}

type PartProps = { grad: string; palette: Palette; h: number };

const CERAMIC = '#fdfbf7';
const CERAMIC_EDGE = '#cfc4b2';
const SHADOW = 'rgb(31 28 24 / 0.13)';

function Plate({ grad, palette, h }: PartProps) {
  // The food mass is an irregular blob so no two dishes sit identically
  // on the plate, derived from the seed rather than chosen at random.
  const wobble = (h % 7) - 3;
  const tilt = ((h >> 3) % 11) - 5;
  return (
    <g>
      <ellipse cy="22" rx="42" ry="8" fill={SHADOW} />
      <ellipse rx="44" ry="26" fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth="1.5" />
      <ellipse rx="33" ry="18" fill="none" stroke={CERAMIC_EDGE} strokeWidth="1" strokeOpacity="0.7" />
      <g transform={`rotate(${tilt})`}>
        <ellipse
          rx={24 + wobble}
          ry={13 - wobble * 0.4}
          fill={`url(#${grad}-food)`}
        />
        <ellipse
          cx={-6}
          cy={-3}
          rx={9}
          ry={5}
          fill="#ffffff"
          fillOpacity="0.17"
        />
      </g>
      <Garnish palette={palette} h={h} spread={26} />
    </g>
  );
}

function Bowl({ grad, palette, h }: PartProps) {
  return (
    <g>
      <ellipse cy="26" rx="34" ry="7" fill={SHADOW} />
      {/* Liquid surface sits inside the rim, so it reads as depth. */}
      <path
        d="M-38 -8 A 38 38 0 0 0 38 -8 Z"
        fill={CERAMIC}
        stroke={CERAMIC_EDGE}
        strokeWidth="1.5"
      />
      <ellipse cy="-8" rx="38" ry="9" fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth="1.5" />
      <ellipse cy="-7" rx="31" ry="7" fill={`url(#${grad}-food)`} />
      <ellipse cx="-9" cy="-9" rx="8" ry="2.6" fill="#ffffff" fillOpacity="0.22" />
      <Garnish palette={palette} h={h} spread={20} y={-9} flat />
      {/* Steam: only on hot vessels, and it is the one looping motion. */}
      <g className="anim-steam" style={{ transformOrigin: 'center' }}>
        <path d="M-8 -20 q4 -6 0 -12" stroke={palette.food[0]} strokeOpacity="0.5" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M6 -22 q4 -6 0 -11" stroke={palette.food[0]} strokeOpacity="0.35" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Board({ grad, palette, h }: PartProps) {
  const slices = 3 + (h % 3);
  return (
    <g>
      <ellipse cy="24" rx="40" ry="6" fill={SHADOW} />
      <rect x="-42" y="2" width="84" height="16" rx="5" fill="#c9a171" />
      <rect x="-42" y="2" width="84" height="5" rx="2.5" fill="#dcb987" />
      {Array.from({ length: slices }, (_, i) => {
        const step = 68 / slices;
        const x = -34 + i * step + ((h >> (i + 2)) % 4);
        return (
          <g key={i} transform={`translate(${x} -6) rotate(${((h >> (i + 1)) % 14) - 7})`}>
            <rect
              x="-9"
              y="-9"
              width={18}
              height={18}
              rx="4"
              fill={`url(#${grad}-food)`}
            />
            <rect x="-9" y="-9" width={18} height={6} rx="3" fill="#ffffff" fillOpacity="0.16" />
          </g>
        );
      })}
      <Garnish palette={palette} h={h} spread={30} y={-14} flat />
    </g>
  );
}

function Cup({ grad, palette }: { grad: string; palette: Palette }) {
  return (
    <g>
      <ellipse cy="28" rx="26" ry="6" fill={SHADOW} />
      <path d="M-22 -14 L-19 18 Q-19 24 -12 24 L12 24 Q19 24 19 18 L22 -14 Z"
        fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth="1.5" />
      {/* Handle on the right, the way a cup is set down for a right hand. */}
      <path d="M22 -6 q14 2 14 12 q0 10 -14 10" fill="none" stroke={CERAMIC_EDGE} strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cy="-14" rx="22" ry="6" fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth="1.5" />
      <ellipse cy="-13" rx="17.5" ry="4.6" fill={`url(#${grad}-food)`} />
      <ellipse cx="-5" cy="-14" rx="5" ry="1.8" fill="#ffffff" fillOpacity="0.3" />
      <ellipse cy="24" rx="15" ry="4" fill={CERAMIC} stroke={CERAMIC_EDGE} strokeWidth="1.2" />
      <g className="anim-steam" style={{ transformOrigin: 'center' }}>
        <path d="M-6 -24 q4 -6 0 -11" stroke={palette.food[0]} strokeOpacity="0.45" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M6 -26 q4 -5 0 -10" stroke={palette.food[0]} strokeOpacity="0.3" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      </g>
    </g>
  );
}

const GLASS_FILL = 'rgb(255 255 255 / 0.55)';
const GLASS_EDGE = 'rgb(29 63 99 / 0.28)';

function Glass({ grad, palette }: { grad: string; palette: Palette }) {
  return (
    <g>
      <ellipse cy="32" rx="20" ry="5" fill={SHADOW} />
      {/* A tapered tumbler: the liquid is clipped to the glass body. */}
      <defs>
        <clipPath id={`${grad}-clip`}>
          <path d="M-17 -26 L-13 22 Q-13 26 -8 26 L8 26 Q13 26 13 22 L17 -26 Z" />
        </clipPath>
      </defs>
      <path d="M-17 -26 L-13 22 Q-13 26 -8 26 L8 26 Q13 26 13 22 L17 -26 Z" fill={GLASS_FILL} />
      <g clipPath={`url(#${grad}-clip)`}>
        <rect x="-20" y="-14" width="40" height="44" fill={`url(#${grad}-food)`} />
        <ellipse cy="-14" rx="16" ry="3.4" fill="#ffffff" fillOpacity="0.35" />
      </g>
      <path d="M-17 -26 L-13 22 Q-13 26 -8 26 L8 26 Q13 26 13 22 L17 -26 Z"
        fill="none" stroke={GLASS_EDGE} strokeWidth="1.6" />
      <path d="M-12 -20 L-9 16" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cy="-26" rx="17" ry="4" fill="none" stroke={GLASS_EDGE} strokeWidth="1.6" />
      <circle cx="9" cy="-19" r="2.6" fill={palette.garnish} fillOpacity="0.9" />
    </g>
  );
}

function Bottle({ grad, palette }: { grad: string; palette: Palette }) {
  return (
    <g>
      <ellipse cy="34" rx="18" ry="5" fill={SHADOW} />
      <path d="M-4 -38 L4 -38 L4 -26 Q14 -20 14 -8 L14 26 Q14 30 10 30 L-10 30 Q-14 30 -14 26 L-14 -8 Q-14 -20 -4 -26 Z"
        fill={GLASS_FILL} stroke={GLASS_EDGE} strokeWidth="1.6" />
      <path d="M-13 -2 L13 -2 L13 25 Q13 29 9 29 L-9 29 Q-13 29 -13 25 Z"
        fill={`url(#${grad}-food)`} fillOpacity="0.85" />
      {/* Paper label, where a Portuguese spring water brand would sit. */}
      <rect x="-13" y="4" width="26" height="13" fill={CERAMIC} fillOpacity="0.92" />
      <rect x="-9" y="8" width="18" height="1.8" rx="0.9" fill={palette.garnish} fillOpacity="0.6" />
      <rect x="-9" y="12" width="12" height="1.6" rx="0.8" fill={palette.garnish} fillOpacity="0.4" />
      <rect x="-4" y="-40" width="8" height="4" rx="1.4" fill={palette.garnish} />
      <path d="M-9 -18 L-9 22" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

/** Two or three accent specks — herbs, zest, a scattering of salt. */
function Garnish({
  palette, h, spread, y = -2, flat = false,
}: {
  palette: Palette; h: number; spread: number; y?: number; flat?: boolean;
}) {
  const count = 2 + (h % 2);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const angle = ((h >> (i * 3 + 1)) % 360) * (Math.PI / 180);
        const radius = spread * (0.45 + ((h >> (i + 4)) % 40) / 100);
        return (
          <circle
            key={i}
            cx={Math.cos(angle) * radius}
            cy={y + Math.sin(angle) * radius * (flat ? 0.22 : 0.45)}
            r={2 + ((h >> i) % 2)}
            fill={palette.garnish}
            fillOpacity="0.85"
          />
        );
      })}
    </g>
  );
}

/** Rough lighten/darken for the ground gradient's second stop. */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
