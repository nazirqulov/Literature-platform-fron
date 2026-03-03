import React, { useMemo } from "react";
import { BookOpen, Star } from "lucide-react";
import api from "../../services/api";

export type FavoriteBook = {
  bookId?: number;
  bookTitle?: string | null;
  bookAuthors?: string | null;
  bookCover?: string | null;
  currentPage?: number;
  totalPages?: number;
  progressPercentage?: number;
  userRating?: number | null;
  rating?: number | null;
  averageRating?: number | null;
  avgRating?: number | null;
  ratingAvg?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  reviewsCount?: number | null;
  reviewCount?: number | null;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolveCoverUrl = (cover?: string | null) => {
  if (!cover) return null;
  if (cover.startsWith("http")) return cover;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(cover.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

const resolveProgress = (book: FavoriteBook) => {
  if (typeof book.progressPercentage === "number") {
    return clampNumber(book.progressPercentage, 0, 100);
  }
  if (
    typeof book.currentPage === "number" &&
    typeof book.totalPages === "number" &&
    book.totalPages > 0
  ) {
    return clampNumber((book.currentPage / book.totalPages) * 100, 0, 100);
  }
  return null;
};

const resolveRatingValue = (book: FavoriteBook) => {
  const raw =
    book.userRating ??
    book.averageRating ??
    book.avgRating ??
    book.rating ??
    book.ratingAvg ??
    book.ratingValue;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.min(5, raw));
};

const resolveRatingCount = (book: FavoriteBook) => {
  const raw = book.ratingCount ?? book.reviewsCount ?? book.reviewCount ?? null;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.floor(raw));
};

interface FavoriteBookCardProps {
  book: FavoriteBook;
  coverUrl?: string | null;
  onCardClick?: () => void;
  onOpen?: () => void;
  variant?: "compact" | "full";
}

const FavoriteBookCard: React.FC<FavoriteBookCardProps> = ({
  book,
  coverUrl,
  onCardClick,
  onOpen,
  variant = "full",
}) => {
  const resolvedCoverUrl = useMemo(
    () => coverUrl ?? resolveCoverUrl(book.bookCover),
    [book.bookCover, coverUrl],
  );
  const progressValue = useMemo(() => resolveProgress(book), [book]);
  const ratingValue = useMemo(() => resolveRatingValue(book), [book]);
  const ratingCount = useMemo(() => resolveRatingCount(book), [book]);
  const title = book.bookTitle ?? "Noma'lum kitob";
  const author = book.bookAuthors ?? "Noma'lum muallif";
  const isClickable = typeof onCardClick === "function";
  const canOpen = typeof onOpen === "function";
  const coverHeight = variant === "compact" ? "h-36" : "h-48";
  const titleSize = variant === "compact" ? "text-base" : "text-lg";
  const metaSize = variant === "compact" ? "text-xs" : "text-sm";
  const cardWidth = variant === "compact" ? "w-full max-w-[360px]" : "w-full";

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onCardClick}
      onKeyDown={(event) => {
        if (!isClickable) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardClick?.();
        }
      }}
      className={`group flex ${cardWidth} flex-col text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B4F3A]/30 ${
        isClickable
          ? "cursor-pointer hover:border-[#6B4F3A]/40 hover:shadow-md"
          : "cursor-default"
      } rounded-2xl border border-[#E3DBCF] bg-white p-4`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-[#E3DBCF] bg-[#F5F1E8] ${coverHeight}`}
      >
        {resolvedCoverUrl ? (
          <img
            src={resolvedCoverUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-[#9A9A9A]">
            <BookOpen size={18} className="text-[#C97B63]" />
            Rasm yo'q
          </div>
        )}
      </div>
      <div className="mt-4 w-full space-y-2">
        <h3 className={`${titleSize} font-semibold text-[#2B2B2B]`}>
          Kitob nomi: {title}
        </h3>
        <p className={`${metaSize} text-[#6B6B6B]`}>Muallifi: {author}</p>
        {ratingValue != null && (
          <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
            <Star size={14} className="fill-[#C97B63] text-[#C97B63]" />
            <span>
              {ratingValue.toFixed(1)}
              {ratingCount != null ? ` (${ratingCount})` : ""}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
          <span>
            {progressValue != null
              ? `${Math.round(progressValue)}% o'qilgan`
              : "Progress --"}
          </span>
          {typeof book.currentPage === "number" &&
          typeof book.totalPages === "number" ? (
            <span>
              {book.currentPage}/{book.totalPages}
            </span>
          ) : null}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5F1E8]">
          <div
            className="h-full rounded-full bg-[#6B4F3A]"
            style={{
              width: progressValue != null ? `${progressValue}%` : "0%",
            }}
          />
        </div>
        {canOpen && (
          <div className="pt-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen?.();
              }}
              className="w-full rounded-lg border border-[#E3DBCF] px-4 py-2 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8]"
            >
              Kitobni ochish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoriteBookCard;
