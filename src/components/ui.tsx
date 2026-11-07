"use client";

import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { splitCompact } from "@/lib/format";

export function Box({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`box ${className}`} {...props} />;
}

/** Rows separated by hairlines inside a box. */
export function List({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`box divide-y divide-line-muted ${className}`}>{children}</div>;
}

export function SectionTitle({ children, href, action }: { children: ReactNode; href?: string; action?: ReactNode }) {
  return (
    <div className="mt-9 mb-3 flex items-center justify-between gap-3">
      <h2 className="min-w-0 truncate text-[17px] font-semibold">{children}</h2>
      {href ? (
        <Link href={href} className="shrink-0 text-[13.5px] font-medium text-accent hover:underline">
          Tout voir
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

/** Number with its magnitude set smaller: "12,3 k". */
export function Figure({
  value,
  prefix,
  unit,
  className = "",
}: {
  value: number;
  prefix?: string;
  unit?: string;
  className?: string;
}) {
  const { figure, unit: magnitude } = splitCompact(value);
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {figure}
      {(magnitude || unit) && (
        <span className="ml-0.5 text-[0.7em] font-medium text-muted">
          {magnitude}
          {magnitude && unit ? " " : ""}
          {unit}
        </span>
      )}
    </span>
  );
}

/**
 * A Figure that flashes green with the amount gained whenever the live data raises it,
 * so stars visibly tick up while the page is open.
 */
export function LiveFigure({
  value,
  prefix,
  unit,
  className = "",
}: {
  value: number;
  prefix?: string;
  unit?: string;
  className?: string;
}) {
  const [previous, setPrevious] = useState(value);
  const [bump, setBump] = useState<{ id: number; delta: number } | null>(null);
  if (value !== previous) {
    setPrevious(value);
    if (value > previous) setBump({ id: (bump?.id ?? 0) + 1, delta: value - previous });
  }
  useEffect(() => {
    if (!bump) return;
    const timer = setTimeout(() => setBump(null), 2600);
    return () => clearTimeout(timer);
  }, [bump]);
  return (
    <span className="relative inline-flex">
      <span className={`rounded transition-colors duration-700 ${bump ? "bg-success/15" : "bg-transparent"}`}>
        <Figure value={value} prefix={prefix} unit={unit} className={className} />
      </span>
      <AnimatePresence>
        {bump && (
          <motion.span
            key={bump.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute -top-3.5 right-0 text-[11px] leading-none font-semibold whitespace-nowrap text-success"
          >
            +{bump.delta}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Key numbers side by side in one box, two per row on phones. */
export function Stats({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; href?: string }[] }) {
  return (
    <div
      className={`box grid grid-cols-2 gap-px bg-line-muted ${items.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}
    >
      {items.map((item) => {
        const body = (
          <>
            <span className="truncate text-[12.5px] text-muted">{item.label}</span>
            <span className="truncate text-[22px] leading-tight font-semibold">{item.value}</span>
            {item.hint && <span className="truncate text-[12.5px] text-muted">{item.hint}</span>}
          </>
        );
        const className = "flex min-w-0 flex-col gap-1 bg-canvas px-4 py-3.5";
        return item.href ? (
          <Link key={item.label} href={item.href} className={`${className} transition-colors hover:bg-hover`}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function Pill({ active, className = "", ...props }: { active?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors ${
        active ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-canvas text-fg hover:bg-hover"
      } ${className}`}
      {...props}
    />
  );
}

/** Horizontal row of pills that scrolls on small screens instead of overflowing. */
export function PillRow({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">{children}</div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  id,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  id: string;
}) {
  return (
    <div className="inline-flex shrink-0 rounded-[9px] border border-line bg-subtle p-0.5" role="tablist">
      {options.map((option) => {
        const on = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(option.value)}
            className={`relative h-7 rounded-[7px] px-3 text-[13.5px] font-medium whitespace-nowrap ${on ? "text-fg" : "text-muted hover:text-fg"}`}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[7px] border border-line bg-canvas shadow-[0_1px_0_rgb(31_35_40/0.04)]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Scroll-snapping row with arrows on pointer devices. Children set their own width. */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <div className="group/carousel relative" role="region" aria-label={label}>
      <div
        ref={ref}
        onScroll={measure}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:scroll-px-0 sm:px-0"
      >
        {children}
      </div>
      {!edges.start && (
        <button
          type="button"
          aria-label="Précédent"
          onClick={() => scroll(-1)}
          className="btn btn-icon absolute top-1/2 -left-4 hidden size-9 -translate-y-1/2 rounded-full shadow-md [@media(pointer:fine)]:inline-flex"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {!edges.end && (
        <button
          type="button"
          aria-label="Suivant"
          onClick={() => scroll(1)}
          className="btn btn-icon absolute top-1/2 -right-4 hidden size-9 -translate-y-1/2 rounded-full shadow-md [@media(pointer:fine)]:inline-flex"
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-xl ${className}`} />;
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <Box className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Icon className="size-7 text-muted" strokeWidth={1.5} />
      <p className="text-[16px] font-semibold">{title}</p>
      {children}
    </Box>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="box divide-y divide-line-muted">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-1/3 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
