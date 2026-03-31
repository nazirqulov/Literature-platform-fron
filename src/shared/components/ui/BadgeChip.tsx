import React from "react";

type BadgeChipVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

type BadgeChipProps = {
  children: React.ReactNode;
  variant?: BadgeChipVariant;
  className?: string;
};

const variantStyleMap: Record<BadgeChipVariant, React.CSSProperties> = {
  neutral: {
    borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--c-surface) 86%, transparent)",
    color: "var(--c-text-secondary)",
  },
  accent: {
    borderColor: "color-mix(in srgb, var(--c-accent) 32%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--c-accent-soft) 70%, transparent)",
    color: "var(--c-accent)",
  },
  success: {
    borderColor: "color-mix(in srgb, var(--c-success) 30%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--c-success) 16%, transparent)",
    color: "var(--c-success)",
  },
  warning: {
    borderColor: "color-mix(in srgb, var(--c-warning) 28%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--c-warning) 16%, transparent)",
    color: "var(--c-warning)",
  },
  danger: {
    borderColor: "color-mix(in srgb, var(--c-danger) 28%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--c-danger) 15%, transparent)",
    color: "var(--c-danger)",
  },
};

const BadgeChip: React.FC<BadgeChipProps> = ({
  children,
  variant = "neutral",
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${className}`}
      style={variantStyleMap[variant]}
    >
      {children}
    </span>
  );
};

export default BadgeChip;
