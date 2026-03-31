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
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border px-3 py-2.5"
          style={{
            borderColor: "color-mix(in srgb, var(--c-border) 84%, transparent)",
            backgroundColor:
              "color-mix(in srgb, var(--c-surface) 76%, transparent)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--c-text-muted)]">
            {item.label}
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-[color:var(--c-text-primary)]">
            {item.value || "--"}
          </p>
          {item.hint ? (
            <p className="mt-1 text-[10px] text-[color:var(--c-text-muted)]">
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default BookMeta;
