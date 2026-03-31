import React from "react";
import { ArrowLeft, BookOpen, Headphones, Star } from "lucide-react";
import BadgeChip from "./BadgeChip";
import BookCover from "./BookCover";
import BookMeta, { type BookMetaItem } from "./BookMeta";

type BookDetailHeroProps = {
  title: string;
  author: string;
  coverUrl?: string | null;
  loadingCover?: boolean;
  description?: string | null;
  categories?: string[];
  subCategories?: string[];
  rating?: number | null;
  ratingCount?: number | null;
  hasAudio?: boolean;
  metaItems: BookMetaItem[];
  onBack?: () => void;
  onRead: () => void;
  onOpenAudio?: () => void;
};

const BookDetailHero: React.FC<BookDetailHeroProps> = ({
  title,
  author,
  coverUrl,
  loadingCover = false,
  description,
  categories = [],
  subCategories = [],
  rating,
  ratingCount,
  hasAudio = false,
  metaItems,
  onBack,
  onRead,
  onOpenAudio,
}) => {
  const hasVotes = typeof ratingCount === "number" && ratingCount > 0;
  const safeRating =
    typeof rating === "number" && Number.isFinite(rating)
      ? Math.max(0, Math.min(5, rating))
      : null;
  const showRating = safeRating !== null && (hasVotes || safeRating > 0);
  const normalizedDescription = description?.trim()
    ? description
    : "Kitob tavsifi mavjud emas.";

  return (
    <div className="space-y-5">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--c-text-secondary)] transition hover:text-[color:var(--c-accent)]"
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
      ) : null}

      <article
        className="rounded-3xl border p-4 sm:p-5 lg:p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--c-surface-elevated) 96%, transparent)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,280px),1fr]">
          <div className="mx-auto w-full max-w-[280px]">
            <BookCover
              title={title}
              src={coverUrl}
              loading={loadingCover}
              ratioClassName="aspect-[3/4]"
              fit="contain"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {showRating ? (
                  <BadgeChip variant="warning" className="gap-1.5">
                    <Star size={13} className="fill-[var(--c-warning)] text-[var(--c-warning)]" />
                    {safeRating.toFixed(1)}
                    {hasVotes ? ` (${ratingCount})` : ""}
                  </BadgeChip>
                ) : (
                  <BadgeChip variant="neutral">Baholanmagan</BadgeChip>
                )}
                {categories.slice(0, 2).map((category) => (
                  <BadgeChip key={category} variant="accent">
                    {category}
                  </BadgeChip>
                ))}
              </div>

              <h1 className="text-2xl font-bold leading-tight text-[color:var(--c-text-primary)] sm:text-3xl">
                {title}
              </h1>
              <p className="text-sm font-medium text-[color:var(--c-text-secondary)]">
                Muallif:{" "}
                <span className="text-[color:var(--c-text-primary)]">{author}</span>
              </p>

              {subCategories.length > 0 ? (
                <p className="text-xs text-[color:var(--c-text-muted)]">
                  Janr: {subCategories.slice(0, 3).join(", ")}
                </p>
              ) : null}
            </div>

            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--c-border) 82%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--c-surface) 82%, transparent)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--c-text-muted)]">
                Tavsif
              </p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--c-text-secondary)]">
                {normalizedDescription}
              </p>
            </div>

            <BookMeta items={metaItems} />

            <div className="flex flex-wrap gap-3 pt-1">
              <button type="button" onClick={onRead} className="btn-primary">
                <BookOpen size={16} />
                Kitobni o'qish
              </button>
              {hasAudio && onOpenAudio ? (
                <button
                  type="button"
                  onClick={onOpenAudio}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-px"
                  style={{
                    borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
                    color: "var(--c-text-secondary)",
                    backgroundColor:
                      "color-mix(in srgb, var(--c-surface) 80%, transparent)",
                  }}
                >
                  <Headphones size={16} />
                  Audio tinglash
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default BookDetailHero;
