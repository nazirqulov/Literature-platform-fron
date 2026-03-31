import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import BookCard from "../../shared/components/ui/BookCard";
import SectionHeader from "../../shared/components/ui/SectionHeader";

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
  const [detailsById, setDetailsById] = useState<Record<number, {
    title?: string;
    authorName?: string;
    coverImage?: string | null;
    averageRating?: number | null;
  }>>({});
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

  useEffect(() => {
    const idsToFetch = items
      .map((item) => item.bookId)
      .filter((id): id is number => typeof id === "number")
      .filter((id) => !enrichedIdsRef.current.has(id))
      .filter((id) => {
        const item = items.find((entry) => entry.bookId === id);
        if (!item) return false;
        const missingTitle = !item.bookTitle;
        const missingAuthor = !item.bookAuthors;
        const missingCover = !item.bookCover;
        return missingTitle || missingAuthor || missingCover;
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
            (result.data?.data as { title?: string; author?: { name?: string }; coverImage?: string | null; averageRating?: number | null } | undefined) ??
            (result.data?.book as { title?: string; author?: { name?: string }; coverImage?: string | null; averageRating?: number | null } | undefined) ??
            (result.data as { title?: string; author?: { name?: string }; coverImage?: string | null; averageRating?: number | null });
          if (detail && typeof detail === "object") {
            next[result.id] = {
              title: detail.title,
              authorName: detail.author?.name,
              coverImage: detail.coverImage ?? null,
              averageRating: detail.averageRating ?? null,
            };
          }
          enrichedIdsRef.current.add(result.id);
        });
        return next;
      });
    };

    void fetchDetails();
  }, [items]);

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
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : "no-scrollbar flex gap-4 overflow-x-auto pb-2";

  return (
    <div className="space-y-4">
      {showHeader ? (
        <SectionHeader
          title="Siz uchun"
          subtitle="Mutolaa odatlaringiz asosida tavsiyalar"
          actionLabel={showAllLink ? "Barchasi" : undefined}
          actionTo={showAllLink ? "/books/siz-uchun" : undefined}
        />
      ) : null}

      {loading ? (
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
          Yuklanmoqda...
        </div>
      ) : error ? (
        <div className="dashboard-card text-sm text-[color:var(--c-danger)]">
          {error}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
          Hozircha tavsiya yo'q.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleItems.map((item, index) => {
            const detail =
              typeof item.bookId === "number" ? detailsById[item.bookId] : undefined;
            const coverFromApi =
              typeof item.bookId === "number" ? coversById[item.bookId] : undefined;
            const fallbackCover = resolveCoverUrl(
              item.bookCover ?? detail?.coverImage ?? null,
            );
            const coverUrl = coverFromApi ?? fallbackCover;
            const isCoverLoading =
              typeof item.bookId === "number" &&
              coversById[item.bookId] === undefined &&
              !fallbackCover;
            const parsedRating =
              typeof item.userRating === "number"
                ? item.userRating
                : typeof detail?.averageRating === "number"
                  ? detail.averageRating
                  : NaN;
            const ratingValue = Number.isFinite(parsedRating)
              ? Math.max(0, Math.min(5, parsedRating))
              : null;
            return (
              <BookCard
                key={`${item.bookId ?? "book"}-${index}`}
                onClick={() => (item.bookId ? navigate(`/books/${item.bookId}`) : undefined)}
                title={item.bookTitle ?? detail?.title ?? "Kitob nomi ko'rsatilmagan"}
                author={item.bookAuthors ?? detail?.authorName ?? "Muallif ko'rsatilmagan"}
                coverUrl={coverUrl}
                loadingCover={isCoverLoading}
                rating={ratingValue}
                className={layout === "grid" ? "w-full" : "w-[216px] shrink-0"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SizUchunSection;
