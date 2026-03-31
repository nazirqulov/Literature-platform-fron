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
  createdAt?: string | null;
}

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

type NewBooksSectionProps = {
  limit?: number;
  layout?: "carousel" | "grid";
  showHeader?: boolean;
  showAllLink?: boolean;
};

const NewBooksSection: React.FC<NewBooksSectionProps> = ({
  limit,
  layout = "carousel",
  showHeader = true,
  showAllLink = false,
}) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BookResponse[]>([]);
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
      .get<BookResponse[]>("/api/books/new-books")
      .then(({ data }) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Yangi kitoblarni yuklashda xatolik yuz berdi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          title="Yangi kitoblar"
          subtitle="So'nggi qo'shilgan kitoblarni birinchi bo'lib ko'ring"
          actionLabel={showAllLink ? "Barchasi" : undefined}
          actionTo={showAllLink ? "/books" : undefined}
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
          Hozircha yangi kitob yo'q.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleItems.map((item, index) => {
            const coverFromApi =
              typeof item.id === "number" ? coversById[item.id] : undefined;
            const fallbackCover = resolveCoverUrl(item.coverImage ?? null);
            const coverUrl = coverFromApi ?? fallbackCover;
            const isCoverLoading =
              typeof item.id === "number" &&
              coversById[item.id] === undefined &&
              !fallbackCover;
            const parsedRating =
              typeof item.averageRating === "number"
                ? item.averageRating
                : typeof item.averageRating === "string"
                  ? Number(item.averageRating)
                  : NaN;
            const ratingValue = Number.isFinite(parsedRating)
              ? Math.max(0, Math.min(5, parsedRating))
              : null;
            return (
              <BookCard
                key={`${item.id ?? "book"}-${index}`}
                onClick={() => (item.id ? navigate(`/books/${item.id}`) : undefined)}
                title={item.title ?? "Kitob nomi ko'rsatilmagan"}
                author={item.author?.name ?? "Muallif ko'rsatilmagan"}
                coverUrl={coverUrl}
                loadingCover={isCoverLoading}
                rating={ratingValue}
                ratingCount={
                  typeof item.ratingCount === "number" ? item.ratingCount : undefined
                }
                className={layout === "grid" ? "w-full" : "w-[216px] shrink-0"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NewBooksSection;
