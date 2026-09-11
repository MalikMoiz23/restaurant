/**
 * Shared design system.
 *
 * One file on purpose: these primitives only stay consistent if they are
 * read together. Every screen in all three apps is built from these.
 */
import {
  createContext, useContext, useEffect, useCallback, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { AnimatePresence, motion, type Transition } from 'framer-motion';
import { Icon, type IconName } from '../lib/Icon';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** The house spring. Everything that moves uses this or a sibling of it. */
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 };
export const SOFT_SPRING: Transition = { type: 'spring', stiffness: 260, damping: 30 };

// ---------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  loading?: boolean;
};

const BUTTON_VARIANT: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-azul-600 text-white shadow-plate hover:bg-azul-700 active:bg-azul-800 ' +
    'disabled:bg-cal-300 disabled:text-cal-500 disabled:shadow-none',
  secondary:
    'bg-white text-azul-700 hairline hover:bg-azul-50 active:bg-azul-100 ' +
    'disabled:text-cal-400',
  ghost:
    'bg-transparent text-cal-700 hover:bg-cal-100 active:bg-cal-200 disabled:text-cal-400',
  danger:
    'bg-barro-500 text-white shadow-plate hover:bg-barro-600 active:bg-barro-700 ' +
    'disabled:bg-cal-300',
  quiet:
    'bg-cal-100 text-cal-800 hover:bg-cal-200 active:bg-cal-300 disabled:text-cal-400',
};

const BUTTON_SIZE: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  // lg and xl exist because a guest taps with a thumb, on a tablet, in a
  // restaurant. 56px and 64px are comfortable; 44px is not.
  lg: 'h-14 px-6 text-base gap-2.5 rounded-2xl',
  xl: 'h-16 px-8 text-lg gap-3 rounded-2xl',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  block,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-[background-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.975] disabled:active:scale-100 disabled:cursor-not-allowed',
        BUTTON_VARIANT[variant],
        BUTTON_SIZE[size],
        block && 'w-full',
        className,
      )}
    >
      {loading ? (
        <span className="anim-spin size-4 rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} className={size === 'sm' ? 'size-4' : 'size-5'} />
      )}
      {children}
      {iconRight && !loading && (
        <Icon name={iconRight} className={size === 'sm' ? 'size-4' : 'size-5'} />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------

export function Card({
  className, children, as: As = 'div', ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
} & Record<string, unknown>) {
  return (
    <As
      {...rest}
      className={cn('rounded-plate bg-white shadow-plate hairline', className)}
    >
      {children}
    </As>
  );
}

export function SectionTitle({
  children, action, icon,
}: {
  children: ReactNode; action?: ReactNode; icon?: IconName;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-cal-900">
        {icon && <Icon name={icon} className="size-5 text-cal-500" />}
        {children}
      </h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------
// Badges, chips, status
// ---------------------------------------------------------------------

export function Badge({
  children, tone = 'neutral', icon, className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'azul' | 'barro' | 'oliva' | 'warn' | 'dark';
  icon?: IconName;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-cal-100 text-cal-700',
    azul: 'bg-azul-50 text-azul-700',
    barro: 'bg-barro-100 text-barro-700',
    oliva: 'bg-oliva-300/30 text-oliva-600',
    warn: 'bg-amber-100 text-amber-800',
    dark: 'bg-azul-700 text-azul-50',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone], className,
      )}
    >
      {icon && <Icon name={icon} className="size-3.5" strokeWidth={2} />}
      {children}
    </span>
  );
}

export function Chip({
  active, onClick, icon, children, count, className,
}: {
  active?: boolean;
  onClick?: () => void;
  icon?: IconName;
  children: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium',
        'transition-all duration-150 active:scale-[0.96]',
        active
          ? 'bg-azul-600 text-white shadow-plate'
          : 'bg-white text-cal-700 hairline hover:bg-cal-50',
        className,
      )}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'ml-0.5 rounded-full px-1.5 text-xs tnum',
            active ? 'bg-white/20' : 'bg-cal-100 text-cal-600',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** The one place service-state colour is defined. */
export const STATUS_COLOR: Record<string, string> = {
  free: 'var(--color-estado-free)',
  occupied: 'var(--color-estado-ordering)',
  ordering: 'var(--color-estado-ordering)',
  eating: 'var(--color-estado-eating)',
  awaiting_bill: 'var(--color-estado-awaiting)',
  needs_cleaning: 'var(--color-estado-cleaning)',
};

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ background: STATUS_COLOR[status] ?? 'var(--color-cal-400)' }}
    />
  );
}

// ---------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------

export function Segmented<T extends string>({
  value, onChange, options, size = 'md', dark, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  size?: 'sm' | 'md';
  /** For the kitchen screen, which is always on a dark ground. */
  dark?: boolean;
  className?: string;
}) {
  const groupId = useId();
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex rounded-xl p-1',
        dark ? 'bg-azul-800' : 'bg-cal-100',
        size === 'sm' ? 'text-[13px]' : 'text-sm',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2',
              active
                ? 'text-azul-800'
                : dark
                  ? 'text-azul-300 hover:text-cal-100'
                  : 'text-cal-600 hover:text-cal-800',
            )}
          >
            {active && (
              // A single shared element slides between options rather
              // than each tab fading — it reads as one control moving.
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={SPRING}
                className="absolute inset-0 rounded-lg bg-white shadow-plate"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap">
              {option.icon && <Icon name={option.icon} className="size-4" />}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Sheet (bottom on touch, side on wide screens) and Modal
// ---------------------------------------------------------------------

export function Sheet({
  open, onClose, title, children, footer, side = false, maxWidth = 'max-w-xl',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: boolean;
  maxWidth?: string;
}) {
  useLockBody(open);
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <motion.button
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-cal-900/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={side ? { x: '100%' } : { y: '100%' }}
            animate={side ? { x: 0 } : { y: 0 }}
            exit={side ? { x: '100%' } : { y: '100%' }}
            transition={SOFT_SPRING}
            className={cn(
              'relative z-10 flex flex-col bg-cal-50 shadow-lift',
              side
                ? cn('ml-auto h-full w-full', maxWidth)
                : cn('mt-auto max-h-[92vh] w-full rounded-t-3xl sm:mx-auto sm:mb-0', maxWidth),
            )}
          >
            {!side && (
              <div className="flex justify-center pt-3 pb-1">
                <span className="h-1.5 w-11 rounded-full bg-cal-300" />
              </div>
            )}
            {title && (
              <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-3">
                <h2 className="text-xl font-semibold text-cal-900">{title}</h2>
                <button
                  onClick={onClose}
                  className="grid size-9 place-items-center rounded-full text-cal-500 hover:bg-cal-200"
                  aria-label="Fechar"
                >
                  <Icon name="x" className="size-5" />
                </button>
              </div>
            )}
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              {children}
            </div>
            {footer && (
              <div className="border-t border-cal-200 bg-white/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Modal({
  open, onClose, title, children, footer, maxWidth = 'max-w-md',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  useLockBody(open);
  useEscape(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <motion.button
            aria-label="Fechar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-cal-900/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={SPRING}
            className={cn('relative z-10 w-full rounded-3xl bg-cal-50 shadow-lift', maxWidth)}
          >
            {title && (
              <h2 className="px-6 pt-6 text-xl font-semibold text-cal-900">{title}</h2>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="px-6 pb-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

function useEscape(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}

// ---------------------------------------------------------------------
// Stepper — quantity control sized for a thumb
// ---------------------------------------------------------------------

export function Stepper({
  value, onChange, min = 0, max = 50, size = 'md',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = {
    sm: { box: 'h-9', btn: 'size-9', text: 'w-8 text-sm' },
    md: { box: 'h-11', btn: 'size-11', text: 'w-10 text-base' },
    lg: { box: 'h-14', btn: 'size-14', text: 'w-14 text-xl' },
  }[size];

  return (
    <div className={cn('inline-flex items-center rounded-2xl bg-cal-100', dims.box)}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Menos"
        className={cn(
          'grid place-items-center rounded-2xl text-cal-700 transition active:scale-90',
          'disabled:text-cal-300 disabled:active:scale-100', dims.btn,
        )}
      >
        <Icon name="minus" className="size-5" strokeWidth={2.2} />
      </button>
      <motion.span
        key={value}
        initial={{ scale: 0.7, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING}
        className={cn('text-center font-semibold tnum', dims.text)}
      >
        {value}
      </motion.span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Mais"
        className={cn(
          'grid place-items-center rounded-2xl text-cal-700 transition active:scale-90',
          'disabled:text-cal-300 disabled:active:scale-100', dims.btn,
        )}
      >
        <Icon name="plus" className="size-5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Numpad — PIN entry and table lookup at the counter
// ---------------------------------------------------------------------

export function Numpad({
  onDigit, onBackspace, onSubmit, submitLabel, submitDisabled, className,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitDisabled?: boolean;
  className?: string;
}) {
  // Physical keyboard works too: the counter has one, and typing is
  // faster than tapping when you already know the table number.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) onDigit(e.key);
      else if (e.key === 'Backspace') onBackspace();
      else if (e.key === 'Enter' && onSubmit && !submitDisabled) onSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDigit, onBackspace, onSubmit, submitDisabled]);

  const key = (label: ReactNode, action: () => void, extra?: string, aria?: string) => (
    <motion.button
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.08 }}
      onClick={action}
      aria-label={aria}
      className={cn(
        'grid h-16 place-items-center rounded-2xl bg-white text-2xl font-semibold',
        'text-cal-800 shadow-plate hairline transition-colors hover:bg-cal-50 active:bg-cal-100',
        extra,
      )}
    >
      {label}
    </motion.button>
  );

  return (
    <div className={cn('grid grid-cols-3 gap-2.5', className)}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, () => onDigit(d)))}
      {key(<Icon name="x" className="size-6" />, onBackspace, 'text-cal-500', 'Apagar')}
      {key('0', () => onDigit('0'))}
      {onSubmit
        ? (
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.08 }}
            onClick={onSubmit}
            disabled={submitDisabled}
            className={cn(
              'grid h-16 place-items-center rounded-2xl text-base font-semibold shadow-plate',
              'transition-colors disabled:bg-cal-200 disabled:text-cal-400 disabled:shadow-none',
              'bg-azul-600 text-white hover:bg-azul-700',
            )}
          >
            {submitLabel ?? <Icon name="check" className="size-6" strokeWidth={2.4} />}
          </motion.button>
        )
        : <span />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Empty / loading / error states
// ---------------------------------------------------------------------

export function EmptyState({
  icon = 'info', title, body, action, dark,
}: {
  icon?: IconName; title: string; body?: string; action?: ReactNode; dark?: boolean;
}) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <div
        className={cn(
          'mb-4 grid size-16 place-items-center rounded-2xl',
          dark ? 'bg-azul-800 text-azul-300' : 'bg-cal-100 text-cal-400',
        )}
      >
        <Icon name={icon} className="size-8" />
      </div>
      <p className={cn('text-base font-medium', dark ? 'text-cal-100' : 'text-cal-800')}>
        {title}
      </p>
      {body && (
        <p className={cn('mt-1 max-w-xs text-sm', dark ? 'text-azul-300' : 'text-cal-500')}>
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

// ---------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------

type Toast = {
  id: number;
  title: string;
  body?: string;
  tone: 'info' | 'success' | 'warn' | 'error';
  icon?: IconName;
};

const ToastContext = createContext<{
  push: (t: Omit<Toast, 'id'>) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...toast, id }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const tones: Record<Toast['tone'], string> = {
    info: 'border-l-azul-500',
    success: 'border-l-oliva-500',
    warn: 'border-l-amber-500',
    error: 'border-l-barro-500',
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
              transition={SPRING}
              className={cn(
                'pointer-events-auto w-full max-w-sm rounded-2xl border-l-4 bg-white p-3.5',
                'shadow-lift hairline', tones[toast.tone],
              )}
            >
              <div className="flex gap-3">
                {toast.icon && (
                  <Icon name={toast.icon} className="mt-0.5 size-5 shrink-0 text-cal-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-cal-900">{toast.title}</p>
                  {toast.body && <p className="mt-0.5 text-sm text-cal-600">{toast.body}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx.push;
}

// ---------------------------------------------------------------------
// Connection indicator — on every screen, always truthful
// ---------------------------------------------------------------------

export function ConnectionPill({
  state, labels, dark,
}: {
  state: 'connecting' | 'online' | 'offline';
  labels: { online: string; connecting: string; offline: string };
  dark?: boolean;
}) {
  const map = {
    online: { icon: 'wifi' as IconName, tone: 'text-oliva-500', label: labels.online },
    connecting: { icon: 'wifi' as IconName, tone: 'text-amber-500', label: labels.connecting },
    offline: { icon: 'wifi-off' as IconName, tone: 'text-barro-500', label: labels.offline },
  }[state];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        dark ? 'bg-azul-800/80 text-azul-200' : 'bg-white/70 text-cal-600',
      )}
      title={map.label}
    >
      <Icon
        name={map.icon}
        className={cn('size-3.5', map.tone, state === 'connecting' && 'anim-beat')}
        strokeWidth={2.2}
      />
      <span className="hidden sm:inline">{map.label}</span>
    </span>
  );
}
