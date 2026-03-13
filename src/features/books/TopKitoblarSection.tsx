import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Star } from "lucide-react";
import api from "../../services/api";

interface BookResponse {
  id?: number;
  title?: string;
  author?: { id?: number; name?: string } | null;
  coverImage?: string | null;
  averageRating?: number | null;
  ratingCount?: number | null;
  viewCount?: number | null;
}

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

type TopKitoblarSectionProps = {
  limit?: number;
  layout?: "carousel" | "grid";
  showHeader?: boolean;
  showAllLink?: boolean;
};

const TopKitoblarSection: React.FC<TopKitoblarSectionProps> = ({
  limit,
  layout = "carousel",
  showHeader = true,
  showAllLink = true,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<number, BookResponse>>({});
  const enrichedIdsRef = useRef<Set<number>>(new Set());
  const [coversById, setCoversById] = useState<
    Record<number, string | null | undefined>
  >({});
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<BookResponse[]>("/api/me/books/top-kitoblar")
      .then(({ data }) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Top kitoblarni yuklashda xatolik yuz berdi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const idsToFetch = items
      .map((item) => item.id)
      .filter((id): id is number => typeof id === "number")
      .filter((id) => !enrichedIdsRef.current.has(id))
      .filter((id) => {
        const item = items.find((entry) => entry.id === id);
        if (!item) return false;
        const missingTitle = !item.title;
        const missingAuthor = !item.author?.name;
        const missingCover = !item.coverImage;
        const missingRating = typeof item.averageRating !== "number";
        return missingTitle || missingAuthor || missingCover || missingRating;
      });

    if (idsToFetch.length === 0) return;

    const fetchDetails = async () => {
      const results = await Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const { data } = await api.get(`/api/books/${id}`);
            return { id, data };
          } catch {
            return null;
          }
        }),
      );

      setDetailsById((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          if (!result) return;
          const detail =
            (result.data?.data as BookResponse | undefined) ??
            (result.data?.book as BookResponse | undefined) ??
            (result.data as BookResponse);
          if (detail && typeof detail === "object") {
            next[result.id] = detail;
          }
          enrichedIdsRef.current.add(result.id);
        });
        return next;
      });
    };

    void fetchDetails();
  }, [items]);

  const visibleItems = useMemo(() => {
    return typeof limit === "number" ? items.slice(0, limit) : items;
  }, [items, limit]);

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
    const ids = items.map((item) => item.id).filter((id): id is number => !!id);
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

  const listClassName =
    layout === "grid"
      ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      : "flex gap-4 overflow-x-auto pb-2";

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#2B2B2B]">
            Eng ko'p o'qilganlar
          </h2>
          {showAllLink ? (
            <Link
              to="/books/top-kitoblar"
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
          Hozircha kitob yo'q.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleItems.map((item, index) => {
            const detail =
              typeof item.id === "number" ? detailsById[item.id] : undefined;
            const merged = detail ? { ...detail, ...item } : item;
            const coverFromApi =
              typeof merged.id === "number" ? coversById[merged.id] : undefined;
            const fallbackCover = resolveCoverUrl(merged.coverImage ?? null);
            const coverUrl = coverFromApi ?? fallbackCover;
            const isCoverLoading =
              typeof merged.id === "number" &&
              coversById[merged.id] === undefined &&
              !fallbackCover;
            const ratingValue =
              typeof merged.averageRating === "number"
                ? Math.max(0, Math.min(5, merged.averageRating))
                : null;
            return (
              <button
                key={`${merged.id ?? "book"}-${index}`}
                type="button"
                onClick={() =>
                  merged.id ? navigate(`/books/${merged.id}`) : undefined
                }
                className={`group relative overflow-hidden rounded-3xl border border-[#E3DBCF] bg-white text-left shadow-sm transition hover:border-[#6B4F3A]/40 hover:shadow-md ${
                  layout === "grid" ? "w-full" : "w-64 shrink-0"
                }`}
              >
                <div className="relative h-44 w-full overflow-hidden bg-[#F5F1E8]">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={merged.title ?? "Kitob"}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : isCoverLoading ? (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#9A9A9A]">
                      Yuklanmoqda...
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#9A9A9A]">
                      Muqova mavjud emas
                    </div>
                  )}

                  <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-2xl bg-white/90 text-[#6B4F3A] shadow">
                    <BookOpen size={16} />
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 pb-3 pt-2">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm text-[#6B6B6B]">
                      <span className="text-[#9A9A9A] font-semibold">Kitob:</span>{" "}
                      <span className="text-[#2B2B2B] font-semibold">
                        {merged.title ?? "Kitob nomi ko'rsatilmagan"}
                      </span>
                    </p>
                    <p className="truncate text-sm text-[#6B6B6B]">
                      <span className="text-[#9A9A9A] font-semibold">Muallif:</span>{" "}
                      <span>
                        {merged.author?.name ?? "Muallif ko'rsatilmagan"}
                      </span>
                    </p>
                  </div>
                  {ratingValue != null ? (
                    <div className="ml-3 flex items-center gap-1 rounded-2xl bg-white px-2 py-1 text-xs font-semibold text-[#2B2B2B] shadow">
                      <Star size={14} className="fill-[#C97B63] text-[#C97B63]" />
                      {ratingValue.toFixed(1)}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopKitoblarSection;
