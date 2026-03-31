import React from "react";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  unit?: string;
  helper?: string;
  hint?: string;
  icon: LucideIcon;
  onClick?: () => void;
  interactive?: boolean;
  error?: string | null;
};

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  helper,
  hint,
  icon: Icon,
  onClick,
  interactive = false,
  error,
}) => {
  const asButton = interactive && typeof onClick === "function";

  const content = (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <span
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--c-accent) 28%, transparent)",
            backgroundColor:
              "color-mix(in srgb, var(--c-accent-soft) 55%, transparent)",
            color: "var(--c-accent)",
          }}
        >
          <Icon size={19} />
        </span>
        {hint ? (
          <span className="text-xs font-medium text-[color:var(--c-text-muted)]">
            {hint}
          </span>
        ) : null}
      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[color:var(--c-text-muted)]">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-1">
        <p className="text-3xl font-semibold leading-none text-[color:var(--c-text-primary)]">
          {value}
        </p>
        {unit ? (
          <span className="pb-1 text-sm font-semibold text-[color:var(--c-text-secondary)]">
            {unit}
          </span>
        ) : null}
      </div>
      {helper ? (
        <p className="mt-2 text-sm text-[color:var(--c-text-secondary)]">{helper}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-[color:var(--c-danger)]">{error}</p>
      ) : null}
    </>
  );

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="dashboard-card block text-left focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
      >
        {content}
      </button>
    );
  }

  return <div className="dashboard-card">{content}</div>;
};

export default StatCard;
