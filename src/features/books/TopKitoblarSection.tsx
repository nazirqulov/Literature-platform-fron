import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import BookCard from "../../shared/components/ui/BookCard";
import SectionHeader from "../../shared/components/ui/SectionHeader";

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
      .filter((id) => !enrichedIdsRef.current.has(id));

    if (idsToFetch.length === 0) return;

    const fetchDetails = async () => {
      const results = await Promise.all(
        idsToFetch.map(async (id) => {
          try {
            const { data } = await api.get(`/api/books/${id}`);
            return { id, data };
          } catch {
            return { id, data: null };
          }
        }),
      );

      setDetailsById((prev) => {
        const next = { ...prev };
        results.forEach((result) => {
          const detail =
            (result.data?.data as BookResponse | undefined) ??
            (result.data?.book as BookResponse | undefined) ??
            (result.data as BookResponse | null);
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
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : "no-scrollbar flex gap-4 overflow-x-auto pb-2";

  return (
    <div className="space-y-4">
      {showHeader ? (
        <SectionHeader
          title="Eng ko'p o'qilganlar"
          subtitle="Platformadagi eng faol o'qilayotgan kitoblar"
          actionLabel={showAllLink ? "Barchasi" : undefined}
          actionTo={showAllLink ? "/books/top-kitoblar" : undefined}
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
          Hozircha kitob yo'q.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleItems.map((item, index) => {
            const detail =
              typeof item.id === "number" ? detailsById[item.id] : undefined;
            // detail ma'lumotlari ustuvor: rating va count hamma joyda bir xil bo'lishi uchun
            const merged = detail ? { ...item, ...detail } : item;
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

            const ratingCount =
              typeof merged.ratingCount === "number"
                ? Math.max(0, Math.floor(merged.ratingCount))
                : undefined;

            return (
              <BookCard
                key={`${merged.id ?? "book"}-${index}`}
                onClick={() => (merged.id ? navigate(`/books/${merged.id}`) : undefined)}
                title={merged.title ?? "Kitob nomi ko'rsatilmagan"}
                author={merged.author?.name ?? "Muallif ko'rsatilmagan"}
                coverUrl={coverUrl}
                loadingCover={isCoverLoading}
                rating={ratingValue}
                ratingCount={ratingCount}
                className={layout === "grid" ? "w-full" : "w-[216px] shrink-0"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TopKitoblarSection;
