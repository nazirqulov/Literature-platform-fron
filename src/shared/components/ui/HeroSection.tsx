import React from "react";
import BadgeChip from "./BadgeChip";

type HeroAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type HeroSectionProps = {
  title: string;
  subtitle?: string;
  chips?: string[];
  action?: HeroAction;
  sideContent?: React.ReactNode;
};

const HeroSection: React.FC<HeroSectionProps> = ({
  title,
  subtitle,
  chips = [],
  action,
  sideContent,
}) => {
  return (
    <header className="surface-elevated rounded-3xl p-6 md:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-[color:var(--c-text-primary)] sm:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-2xl text-sm text-[color:var(--c-text-secondary)] sm:text-base">
              {subtitle}
            </p>
          ) : null}

          {(chips.length > 0 || action) && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {chips.map((chip) => (
                <BadgeChip key={chip} variant="accent">
                  {chip}
                </BadgeChip>
              ))}
              {action ? (
                action.href ? (
                  <a href={action.href} className="btn-primary text-sm">
                    {action.label}
                  </a>
                ) : (
                  <button type="button" onClick={action.onClick} className="btn-primary text-sm">
                    {action.label}
                  </button>
                )
              ) : null}
            </div>
          )}
        </div>

        {sideContent ? <div className="lg:min-w-[220px]">{sideContent}</div> : null}
      </div>
    </header>
  );
};

export default HeroSection;
