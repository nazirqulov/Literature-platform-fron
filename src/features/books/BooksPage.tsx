import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscribeNewBookEvent } from "../../services/bookRealtimeBus";
import BookCard from "../../shared/components/ui/BookCard";

interface BookCategoryResponse {
  id?: number;
  name?: string;
}

interface AuthorResponse {
  id?: number;
  name?: string;
}

interface BookResponse {
  id?: number;
  title?: string;
  author?: AuthorResponse | null;
  categories?: BookCategoryResponse[] | null;
  subCategoryName?: string[] | null;
  language?: string | null;
  publishedYear?: number | null;
  coverImage?: string | null;
  isFavorite?: boolean | null;
  favorite?: boolean | null;
  rating?: number | null;
  averageRating?: number | null;
  avgRating?: number | null;
  ratingAvg?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  reviewsCount?: number | null;
  reviewCount?: number | null;
}

type PagedResponse<T> = {
  content?: T[];
};

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

const BooksPage: React.FC = () => {
  const [books, setBooks] = useState<BookResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedSubcategory = searchParams.get("sub");
  const [searchTerm, setSearchTerm] = useState("");
  const [bookCovers, setBookCovers] = useState<
    Record<number, string | null | undefined>
  >({});
  const [favoriteById, setFavoriteById] = useState<Record<number, boolean>>({});
  const [favoriteLoading, setFavoriteLoading] = useState<Record<number, boolean>>(
    {},
  );
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  const normalizeBooks = (data: unknown) => {
    if (Array.isArray(data)) return data as BookResponse[];
    const pageData = data as PagedResponse<BookResponse>;
    return Array.isArray(pageData?.content) ? pageData.content : [];
  };

  const fetchBooks = useCallback(async (keyword?: string) => {
    setLoading(true);
    try {
      const trimmedKeyword = keyword?.trim();
      const endpoint = trimmedKeyword ? "/api/books/search" : "/api/books/get-all";
      const params = trimmedKeyword
        ? { keyword: trimmedKeyword, page: 0, size: 200 }
        : { page: 0, size: 200 };
      const { data } = await api.get(endpoint, { params });
      setBooks(normalizeBooks(data));
    } catch {
      toast.error("Kitoblar ro'yxatini yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCoverForBook = useCallback(async (bookId: number) => {
    if (Number.isNaN(bookId)) return;
    setBookCovers((prev) => {
      if (bookId in prev) return prev;
      return { ...prev, [bookId]: undefined };
    });

    try {
      const response = await api.get<Blob>(`/api/books/book-image/${bookId}`, {
        responseType: "blob",
      });
      if (!response.data || response.data.size === 0) {
        setBookCovers((prev) => ({ ...prev, [bookId]: null }));
        return;
      }

      const objectUrl = URL.createObjectURL(response.data);
      coverObjectUrlsRef.current.set(bookId, objectUrl);
      setBookCovers((prev) => ({ ...prev, [bookId]: objectUrl }));
    } catch {
      setBookCovers((prev) => ({ ...prev, [bookId]: null }));
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchBooks(searchTerm);
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchBooks, searchTerm]);

  useEffect(() => {
    const unsubscribe = subscribeNewBookEvent((payload) => {
      if (payload.type !== "NEW_BOOK") return;
      void fetchBooks(searchTerm);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchBooks, searchTerm]);

  useEffect(() => {
    const ids = books.map((book) => book.id).filter((id): id is number => !!id);
    const idSet = new Set(ids);
    coverObjectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        coverObjectUrlsRef.current.delete(id);
        setBookCovers((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
    ids.forEach((id) => {
      if (!(id in bookCovers)) {
        void fetchCoverForBook(id);
      }
    });
  }, [books, bookCovers, fetchCoverForBook]);

  useEffect(() => {
    setFavoriteById((prev) => {
      const next = { ...prev };
      books.forEach((book) => {
        if (!book.id) return;
        if (typeof book.isFavorite === "boolean") {
          next[book.id] = book.isFavorite;
        } else if (typeof book.favorite === "boolean") {
          next[book.id] = book.favorite;
        }
      });
      return next;
    });
  }, [books]);

  useEffect(() => {
    return () => {
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  const openDetails = (book: BookResponse) => {
    if (!book.id || Number.isNaN(book.id)) return;
    navigate(`/books/${book.id}`, { state: { book } });
  };

  const toggleFavorite = async (bookId: number) => {
    if (Number.isNaN(bookId) || favoriteLoading[bookId]) return;
    const previous = favoriteById[bookId] ?? false;
    setFavoriteLoading((prev) => ({ ...prev, [bookId]: true }));
    setFavoriteById((prev) => ({ ...prev, [bookId]: !previous }));

    try {
      const { data } = await api.post(`/api/books/${bookId}/favorite`);
      const nextValue =
        typeof data?.isFavorite === "boolean"
          ? data.isFavorite
          : typeof data?.favorite === "boolean"
            ? data.favorite
            : !previous;
      setFavoriteById((prev) => ({ ...prev, [bookId]: nextValue }));
      toast.success(
        nextValue ? "Sevimlilarga qo'shildi." : "Sevimlilardan olib tashlandi.",
      );
    } catch {
      setFavoriteById((prev) => ({ ...prev, [bookId]: previous }));
      toast.error("Sevimlilarni yangilashda xatolik yuz berdi.");
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [bookId]: false }));
    }
  };

  const filteredBooks = useMemo(() => {
    if (!selectedSubcategory) return books;
    return books.filter((book) =>
      (book.subCategoryName ?? []).includes(selectedSubcategory),
    );
  }, [books, selectedSubcategory]);

  const resolveRatingValue = (book: BookResponse) => {
    const raw =
      book.averageRating ??
      book.avgRating ??
      book.rating ??
      book.ratingAvg ??
      book.ratingValue;
    if (typeof raw !== "number" || Number.isNaN(raw)) return null;
    return Math.max(0, Math.min(5, raw));
  };

  const resolveRatingCount = (book: BookResponse) => {
    const raw =
      book.ratingCount ?? book.reviewsCount ?? book.reviewCount ?? null;
    if (typeof raw !== "number" || Number.isNaN(raw)) return null;
    return Math.max(0, Math.floor(raw));
  };

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:py-10">
      <header
        className="rounded-3xl border p-5 sm:p-6"
        style={{
          borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
          backgroundColor:
            "color-mix(in srgb, var(--c-surface-elevated) 96%, transparent)",
          boxShadow: "var(--shadow-soft)",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--c-text-muted)]">
              Raqamli kutubxona
            </p>
            <h1 className="text-2xl font-bold text-[color:var(--c-text-primary)] sm:text-3xl">
              Kitoblar katalogi
            </h1>
            <p className="text-sm text-[color:var(--c-text-secondary)]">
              Sifatli muqova ko'rinishi, aniq reyting va qulay qidiruv bilan.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
            <label className="relative flex-1">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--c-text-muted)]"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Kitob nomi yoki kalit so'z bo'yicha qidirish..."
                className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm text-[color:var(--c-text-primary)] placeholder:text-[color:var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--c-surface) 84%, transparent)",
                }}
              />
            </label>

            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
                  color: "var(--c-text-secondary)",
                  backgroundColor:
                    "color-mix(in srgb, var(--c-surface-elevated) 90%, transparent)",
                }}
              >
                Tozalash
              </button>
            ) : null}
          </div>
        </div>

        {selectedSubcategory ? (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: "color-mix(in srgb, var(--c-accent) 32%, transparent)",
              color: "var(--c-accent)",
              backgroundColor: "color-mix(in srgb, var(--c-accent-soft) 58%, transparent)",
            }}
          >
            <SlidersHorizontal size={13} />
            Subkategoriya: {selectedSubcategory}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
          Kitoblar yuklanmoqda...
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
          Kitoblar topilmadi.
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))] md:gap-5">
          {filteredBooks.map((book) => {
            const id = book.id;
            const isFav =
              (id != null ? favoriteById[id] : undefined) ??
              book.isFavorite ??
              book.favorite ??
              false;
            const coverFromApi = id != null ? bookCovers[id] : undefined;
            const fallbackCover = resolveCoverUrl(book.coverImage);
            const coverUrl = coverFromApi ?? fallbackCover;
            const isCoverLoading = id != null && coverFromApi === undefined && !fallbackCover;
            const rating = resolveRatingValue(book);
            const ratingCount = resolveRatingCount(book);

            return (
              <BookCard
                key={id ?? `${book.title}-${book.author?.name}`}
                onClick={() => openDetails(book)}
                title={book.title ?? "Kitob nomi ko'rsatilmagan"}
                author={book.author?.name ?? "Muallif ko'rsatilmagan"}
                coverUrl={coverUrl}
                loadingCover={isCoverLoading}
                rating={rating}
                ratingCount={ratingCount ?? undefined}
                isFavorite={Boolean(isFav)}
                favoriteLoading={id ? favoriteLoading[id] : false}
                onToggleFavorite={id ? () => toggleFavorite(id) : undefined}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};

export default BooksPage;
