import React from "react";
import { Link } from "react-router-dom";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  actionTo,
}) => {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-[color:var(--c-text-primary)]">{title}</h2>
        {subtitle ? (
          <p className="text-sm text-[color:var(--c-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="rounded-full border px-3 py-1.5 text-sm font-semibold transition"
          style={{
            borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
            color: "var(--c-accent)",
            backgroundColor: "color-mix(in srgb, var(--c-surface) 75%, transparent)",
          }}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
};

export default SectionHeader;
