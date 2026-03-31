import React from "react";
import { BookCopy } from "lucide-react";

type EmptyCoverPlaceholderProps = {
  loading?: boolean;
  error?: boolean;
  title?: string;
  className?: string;
};

const EmptyCoverPlaceholder: React.FC<EmptyCoverPlaceholderProps> = ({
  loading = false,
  error = false,
  title,
  className = "",
}) => {
  const caption = loading
    ? "Muqova yuklanmoqda..."
    : error
      ? "Muqovani yuklab bo'lmadi"
      : "Muqova mavjud emas";

  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center ${className}`}
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--c-accent-soft) 26%, var(--c-surface-elevated))",
      }}
    >
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border text-[color:var(--c-accent)]"
        style={{
          borderColor: "color-mix(in srgb, var(--c-border) 80%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--c-surface) 92%, transparent)",
        }}
      >
        <BookCopy size={18} />
      </span>
      <p className="line-clamp-1 text-[11px] font-semibold tracking-wide text-[color:var(--c-text-secondary)]">
        {caption}
      </p>
      {title ? (
        <p className="line-clamp-2 max-w-[85%] text-[10px] text-[color:var(--c-text-muted)]">
          {title}
        </p>
      ) : null}
    </div>
  );
};

export default EmptyCoverPlaceholder;
