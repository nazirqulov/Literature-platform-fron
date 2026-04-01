import React from "react";

export type BookMetaItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

type BookMetaProps = {
  items: BookMetaItem[];
  className?: string;
};

const BookMeta: React.FC<BookMetaProps> = ({ items, className = "" }) => {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="group rounded-2xl px-4 py-3 transition"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--c-surface) 84%, var(--c-surface-elevated))",
            border: "1px solid color-mix(in srgb, var(--c-border) 52%, transparent)",
            boxShadow: "0 1px 0 color-mix(in srgb, var(--c-border) 22%, transparent) inset",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--c-text-muted)]">
            {item.label}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--c-text-primary)]">
            {item.value || "--"}
          </p>
          {item.hint ? (
            <p className="mt-1 line-clamp-1 text-[11px] text-[color:var(--c-text-secondary)]">
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default BookMeta;
