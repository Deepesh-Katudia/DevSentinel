"use client";
import { useEffect, useRef, useState } from "react";
import { motion, type TargetAndTransition } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface TabItem {
  label: string;
  href: string;
}

type CursorPos = TargetAndTransition & {
  left: number;
  width: number;
  opacity: number;
};

interface NavHeaderProps {
  tabs: TabItem[];
  className?: string;
}

export function NavHeader({ tabs, className }: NavHeaderProps) {
  const pathname = usePathname();
  const [cursorPos, setCursorPos] = useState<CursorPos>({ left: 0, width: 0, opacity: 0 });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLLIElement | null)[]>([]);

  const getActiveIndex = () =>
    tabs.findIndex((t) =>
      t.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(t.href)
    );

  const activeIndex = getActiveIndex();

  useEffect(() => {
    if (activeIndex === -1) {
      setCursorPos((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const el = tabRefs.current[activeIndex];
    if (el) {
      setCursorPos({ left: el.offsetLeft, width: el.getBoundingClientRect().width, opacity: 1 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const returnToActive = () => {
    setHoverIndex(null);
    if (activeIndex === -1) {
      setCursorPos((p) => ({ ...p, opacity: 0 }));
      return;
    }
    const el = tabRefs.current[activeIndex];
    if (el) {
      setCursorPos({ left: el.offsetLeft, width: el.getBoundingClientRect().width, opacity: 1 });
    }
  };

  return (
    <ul
      className={cn(
        "relative flex items-center rounded-full border border-[var(--border)] bg-[var(--bg)] p-1",
        className
      )}
      onMouseLeave={returnToActive}
    >
      {tabs.map((t, i) => (
        <li
          key={t.href}
          ref={(el) => { tabRefs.current[i] = el; }}
          onMouseEnter={() => {
            setHoverIndex(i);
            const el = tabRefs.current[i];
            if (!el) return;
            setCursorPos({ left: el.offsetLeft, width: el.getBoundingClientRect().width, opacity: 1 });
          }}
          className="relative z-10 cursor-pointer"
        >
          <Link
            href={t.href}
            className={cn(
              "block px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors",
              i === activeIndex || i === hoverIndex ? "text-white" : "text-[var(--ink)]"
            )}
          >
            {t.label}
          </Link>
        </li>
      ))}
      <motion.li
        animate={cursorPos}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="absolute z-0 top-1 h-[calc(100%-8px)] rounded-full bg-[var(--ink)] pointer-events-none"
      />
    </ul>
  );
}
