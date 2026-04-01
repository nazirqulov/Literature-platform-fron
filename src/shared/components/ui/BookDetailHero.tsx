import React from "react";
import { ArrowLeft, BookOpen, Headphones, Star, Tag, UserRound } from "lucide-react";
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
    <div className="space-y-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition hover:-translate-y-px"
          style={{
            borderColor: "color-mix(in srgb, var(--c-border) 74%, transparent)",
            color: "var(--c-text-secondary)",
            backgroundColor: "color-mix(in srgb, var(--c-surface) 84%, transparent)",
          }}
        >
          <ArrowLeft size={16} />
          Orqaga
        </button>
      ) : null}

      <article
        className="relative overflow-hidden rounded-[28px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7"
        style={{
          border: "1px solid color-mix(in srgb, var(--c-border) 56%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--c-surface-elevated) 96%, var(--c-surface))",
          boxShadow: "0 22px 52px color-mix(in srgb, #2b1f14 10%, transparent)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 95% 0%, color-mix(in srgb, var(--c-accent-soft) 55%, transparent), transparent 43%)",
          }}
        />

        <div className="relative z-[1] grid items-start gap-6 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[260px]">
            <BookCover
              title={title}
              src={coverUrl}
              loading={loadingCover}
              ratioClassName="aspect-[3/4]"
              fit="contain"
              framed={false}
            />
          </div>

          <div className="space-y-5">
            <div className="space-y-3">
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

                {categories.slice(0, 3).map((category) => (
                  <BadgeChip key={category} variant="accent" className="max-w-[180px] truncate">
                    {category}
                  </BadgeChip>
                ))}
              </div>

              <h1 className="text-3xl font-bold leading-tight text-[color:var(--c-text-primary)] sm:text-4xl">
                {title}
              </h1>

              <p className="inline-flex items-center gap-2 text-base font-medium text-[color:var(--c-text-secondary)]">
                <UserRound size={16} className="text-[color:var(--c-text-muted)]" />
                <span className="text-[color:var(--c-text-secondary)]">Muallif:</span>
                <span className="font-semibold text-[color:var(--c-text-primary)]">{author}</span>
              </p>

              {subCategories.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--c-text-muted)]">
                    <Tag size={13} />
                    Janrlar:
                  </span>
                  {subCategories.slice(0, 4).map((subCategory) => (
                    <span
                      key={subCategory}
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--c-accent-soft) 52%, transparent)",
                        color: "var(--c-text-secondary)",
                      }}
                    >
                      {subCategory}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <section
              className="rounded-2xl px-4 py-4"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--c-surface) 80%, var(--c-surface-elevated))",
                border: "1px solid color-mix(in srgb, var(--c-border) 46%, transparent)",
              }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--c-text-muted)]">
                Tavsif
              </p>
              <p className="mt-2 text-sm leading-7 text-[color:var(--c-text-secondary)] sm:text-[15px]">
                {normalizedDescription}
              </p>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onRead}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-px"
                style={{
                  backgroundColor: "var(--c-accent)",
                  boxShadow: "0 12px 24px color-mix(in srgb, var(--c-accent) 32%, transparent)",
                }}
              >
                <BookOpen size={16} />
                Kitobni o'qish
              </button>

              {hasAudio && onOpenAudio ? (
                <button
                  type="button"
                  onClick={onOpenAudio}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:-translate-y-px"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--c-border) 62%, transparent)",
                    color: "var(--c-text-secondary)",
                    backgroundColor:
                      "color-mix(in srgb, var(--c-surface) 78%, var(--c-surface-elevated))",
                  }}
                >
                  <Headphones size={16} />
                  Audio tinglash
                </button>
              ) : null}
            </div>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--c-text-muted)]">
                Kitob ma'lumotlari
              </p>
              <BookMeta items={metaItems} />
            </section>
          </div>
        </div>
      </article>
    </div>
  );
};

export default BookDetailHero;
