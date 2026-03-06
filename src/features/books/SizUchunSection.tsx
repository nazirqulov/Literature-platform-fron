import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Star } from "lucide-react";
import api from "../../services/api";

interface BookProgressResponse {
  bookId?: number;
  bookTitle?: string;
  bookAuthors?: string;
  bookCover?: string;
  category?: string;
  subCategory?: string;
  status?: string;
  currentPage?: number;
  totalPages?: number;
  currentChapter?: number;
  progressPercentage?: number;
  isFavorite?: boolean;
  userRating?: number;
  userReview?: string;
}

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

type SizUchunSectionProps = {
  limit?: number;
  layout?: "carousel" | "grid";
  showHeader?: boolean;
  showAllLink?: boolean;
};

const SizUchunSection: React.FC<SizUchunSectionProps> = ({
  limit,
  layout = "carousel",
  showHeader = true,
  showAllLink = true,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BookProgressResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coversById, setCoversById] = useState<
    Record<number, string | null | undefined>
  >({});
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<BookProgressResponse[]>("/api/me/books/siz-uchun")
      .then(({ data }) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Siz uchun bo'limini yuklashda xatolik yuz berdi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCoverForBook = useCallback(async (bookId: number) => {
    if (Number.isNaN(bookId)) return;
    setCoversById((prev) => {
      if (bookId in prev) return prev;
      return { ...prev, [bookId]: undefined };
    });

    try {
      const response = await api.get<Blob>(`/api/books/book-image/${bookId}`, {
        responseType: "blob",
      });
      if (!response.data || response.data.size === 0) {
        setCoversById((prev) => ({ ...prev, [bookId]: null }));
        return;
      }

      const objectUrl = URL.createObjectURL(response.data);
      const existing = coverObjectUrlsRef.current.get(bookId);
      if (existing) {
        URL.revokeObjectURL(existing);
      }
      coverObjectUrlsRef.current.set(bookId, objectUrl);
      setCoversById((prev) => ({ ...prev, [bookId]: objectUrl }));
    } catch {
      setCoversById((prev) => ({ ...prev, [bookId]: null }));
    }
  }, []);

  useEffect(() => {
    const ids = items
      .map((item) => item.bookId)
      .filter((id): id is number => typeof id === "number");
    const idSet = new Set(ids);

    coverObjectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        coverObjectUrlsRef.current.delete(id);
        setCoversById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    ids.forEach((id) => {
      if (!(id in coversById)) {
        void fetchCoverForBook(id);
      }
    });
  }, [coversById, fetchCoverForBook, items]);

  useEffect(() => {
    return () => {
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  const visibleItems = useMemo(() => {
    return typeof limit === "number" ? items.slice(0, limit) : items;
  }, [items, limit]);

  const listClassName =
    layout === "grid"
      ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      : "flex gap-4 overflow-x-auto pb-2";

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#2B2B2B]">Siz uchun</h2>
          {showAllLink ? (
            <Link
              to="/books/siz-uchun"
              className="text-sm font-semibold text-[#6B4F3A] hover:text-[#5A4030]"
            >
              Barchasi
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {error}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Hozircha tavsiya yo'q.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleItems.map((item, index) => {
            const coverFromApi =
              typeof item.bookId === "number" ? coversById[item.bookId] : undefined;
            const fallbackCover = resolveCoverUrl(item.bookCover ?? null);
            const coverUrl = coverFromApi ?? fallbackCover;
            const isCoverLoading =
              typeof item.bookId === "number" &&
              coversById[item.bookId] === undefined &&
              !fallbackCover;
            const ratingLabel =
              typeof item.userRating === "number"
                ? item.userRating.toFixed(1)
                : null;
            return (
              <button
                key={`${item.bookId ?? "book"}-${index}`}
                type="button"
                onClick={() =>
                  item.bookId ? navigate(`/books/${item.bookId}`) : undefined
                }
                className={`group relative overflow-hidden rounded-3xl border border-[#E3DBCF] bg-white text-left shadow-sm transition hover:border-[#6B4F3A]/40 hover:shadow-md ${
                  layout === "grid" ? "w-full" : "w-60 shrink-0"
                }`}
              >
                <div className="relative h-40 w-full overflow-hidden bg-[#F5F1E8]">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={item.bookTitle ?? "Kitob"}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : isCoverLoading ? (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#9A9A9A]">
                      Yuklanmoqda...
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#9A9A9A]">
                      Muqova yo'q
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/90 text-[#6B4F3A] shadow">
                    <BookOpen size={16} />
                  </div>

                  {ratingLabel ? (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-2xl bg-white/95 px-2 py-1 text-xs font-semibold text-[#2B2B2B] shadow">
                      <Star size={14} className="fill-[#C97B63] text-[#C97B63]" />
                      {ratingLabel}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-1 px-4 py-3">
                  <p className="truncate text-base font-semibold text-[#2B2B2B]">
                    {item.bookTitle ?? "Noma'lum kitob"}
                  </p>
                  <p className="truncate text-sm text-[#6B6B6B]">
                    {item.bookAuthors ?? "Muallif noma'lum"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SizUchunSection;
