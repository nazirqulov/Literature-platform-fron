import React from "react";
import { BookOpen, Heart, Star } from "lucide-react";
import BadgeChip from "./BadgeChip";
import BookCover from "./BookCover";

type BookCardProps = {
  title: string;
  author: string;
  coverUrl?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  loadingCover?: boolean;
  onClick?: () => void;
  className?: string;
  interactive?: boolean;
  isFavorite?: boolean;
  favoriteLoading?: boolean;
  onToggleFavorite?: () => void;
};

const normalizeRating = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(5, value));
};

const BookCard: React.FC<BookCardProps> = ({
  title,
  author,
  coverUrl,
  rating,
  ratingCount,
  loadingCover = false,
  onClick,
  className = "",
  interactive = true,
  isFavorite = false,
  favoriteLoading = false,
  onToggleFavorite,
}) => {
  const safeRating = normalizeRating(rating);
  const hasVotes = typeof ratingCount === "number" ? ratingCount > 0 : false;
  const showRating = safeRating !== null && (hasVotes || safeRating > 0);
  const noRatingState = !showRating;

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border p-3 text-left transition duration-200 ${
        interactive
          ? "hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]"
          : ""
      } ${
        onClick ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]" : ""
      } ${className}`}
      style={{
        borderColor: "color-mix(in srgb, var(--c-border) 85%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--c-surface-elevated) 96%, transparent)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div className="relative">
        <BookCover
          title={title}
          src={coverUrl}
          loading={loadingCover}
          ratioClassName="aspect-[3/4]"
          fit="contain"
          className="transition-transform duration-300 group-hover:scale-[1.01]"
        />
        <span
          className="absolute left-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--c-border) 65%, transparent)",
            backgroundColor:
              "color-mix(in srgb, var(--c-surface-elevated) 70%, transparent)",
            color: "var(--c-accent)",
          }}
        >
          <BookOpen size={14} />
        </span>
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite();
            }}
            disabled={favoriteLoading}
            aria-label={
              isFavorite
                ? "Sevimlilardan olib tashlash"
                : "Sevimlilarga qo'shish"
            }
            className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl border transition"
            style={{
              borderColor: "color-mix(in srgb, var(--c-border) 65%, transparent)",
              backgroundColor:
                "color-mix(in srgb, var(--c-surface-elevated) 70%, transparent)",
              color: isFavorite ? "var(--c-accent)" : "var(--c-text-secondary)",
            }}
          >
            <Heart
              size={14}
              className={isFavorite ? "fill-[var(--c-accent)]" : ""}
            />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex min-h-[88px] flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--c-text-primary)]">
            {title}
          </h3>
          <p className="line-clamp-1 text-xs font-medium text-[color:var(--c-text-secondary)]">
            {author}
          </p>
        </div>

        {showRating ? (
          <BadgeChip variant="neutral" className="w-fit gap-1.5 text-[11px]">
            <Star size={13} className="fill-[var(--c-warning)] text-[var(--c-warning)]" />
            <span>{safeRating.toFixed(1)}</span>
            {typeof ratingCount === "number" ? (
              <span className="text-[color:var(--c-text-muted)]">({ratingCount})</span>
            ) : null}
          </BadgeChip>
        ) : null}
        {noRatingState ? (
          <BadgeChip variant="neutral" className="w-fit text-[11px]">
            Baholanmagan
          </BadgeChip>
        ) : null}
      </div>
    </article>
  );
};

export default BookCard;
