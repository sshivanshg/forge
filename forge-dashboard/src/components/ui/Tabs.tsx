"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}

/** WAI-ARIA tablist with arrow-key navigation. Panels use id `panel-{id}`. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-gray-alpha-400">
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "group relative flex h-12 shrink-0 items-center gap-2 px-1 text-label-14 transition-colors focus-ring rounded-sm first:-ml-1",
              selected ? "text-gray-1000" : "text-gray-900 hover:text-gray-1000",
            )}
          >
            <span className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors group-hover:bg-gray-alpha-200">
              {tab.icon}
              {tab.label}
            </span>
            {selected && <span className="absolute inset-x-1 -bottom-px h-0.5 bg-gray-1000" />}
          </button>
        );
      })}
    </div>
  );
}
