import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Search, Star, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import {
  extractAuthorPayload,
  getAuthorInitials,
  resolveProfileUrl,
} from "./authorUtils";
import type { AuthorResponse } from "./authorUtils";
import useAuthorProfileImages from "./useAuthorProfileImages";

interface BookResponse {
  id?: number;
  title?: string;
  description?: string | null;
  author?: { id?: number; name?: string } | null;
  categories?: { id?: number; name?: string }[] | null;
  subCategoryName?: string[] | null;
  isbn?: string | null;
  publishedYear?: number | null;
  publisher?: string | null;
  language?: string | null;
  pageCount?: number | null;
  coverImage?: string | null;
  pdfFile?: string | null;
  audioFile?: string | null;
  viewCount?: number | null;
  downloadCount?: number | null;
  averageRating?: number | null;
  rating?: number | null;
  avgRating?: number | null;
  ratingAvg?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  reviewsCount?: number | null;
  reviewCount?: number | null;
  isFeatured?: boolean | null;
  isFavorite?: boolean | null;
  createdAt?: string | null;
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

const normalizeBooks = (data: unknown): BookResponse[] => {
  if (Array.isArray(data)) {
    if (data.every((item) => typeof item === "number")) {
      return (data as number[]).map((id) => ({ id }));
    }
    return data as BookResponse[];
  }
  if (!data || typeof data !== "object") return [];
  const typed = data as PagedResponse<BookResponse> & {
    data?: unknown;
    books?: unknown;
    authorsBooks?: unknown;
    result?: unknown;
  };
  const candidates = [
    typed.content,
    typed.data,
    typed.books,
    typed.authorsBooks,
    typed.result,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      if (candidate.every((item) => typeof item === "number")) {
        return (candidate as number[]).map((id) => ({ id }));
      }
      return candidate as BookResponse[];
    }
  }
  return [];
};

const extractBookPayload = (data: unknown): BookResponse | null => {
  if (!data || typeof data !== "object") return null;
  const typed = data as Record<string, unknown>;
  const content = typed.content;
  const possible =
    (typed.book as BookResponse | undefined) ??
    (typed.data as BookResponse | undefined) ??
    (!Array.isArray(content) ? (content as BookResponse | undefined) : undefined) ??
    (data as BookResponse);
  if (!possible || typeof possible !== "object") return null;
  return possible;
};

const hasBookDetails = (book: BookResponse) =>
  typeof book.title === "string" ||
  typeof book.description === "string" ||
  typeof book.author === "object";

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
  const raw = book.ratingCount ?? book.reviewsCount ?? book.reviewCount ?? null;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.floor(raw));
};

const AuthorDetailPage: React.FC = () => {
  const { authorId } = useParams<{ authorId: string }>();
  const navigate = useNavigate();
  const parsedId = Number(authorId);
  const authorIdNumber = Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;

  const [author, setAuthor] = useState<AuthorResponse | null>(null);
  const [loadingAuthor, setLoadingAuthor] = useState(true);
  const [authorError, setAuthorError] = useState<string | null>(null);

  const [authorBooks, setAuthorBooks] = useState<BookResponse[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksError, setBooksError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const booksRequestIdRef = useRef(0);

  const [coversById, setCoversById] = useState<
    Record<number, string | null | undefined>
  >({});
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (!authorIdNumber) {
      setAuthorError("Muallif identifikatori noto'g'ri.");
      setLoadingAuthor(false);
      return;
    }

    let cancelled = false;
    setLoadingAuthor(true);
    setAuthorError(null);

    api
      .get(`/api/authors/${authorIdNumber}`)
      .then(({ data }) => {
        if (cancelled) return;
        const resolved = extractAuthorPayload(data);
        if (resolved) {
          setAuthor(resolved);
        } else {
          setAuthorError("Muallif ma'lumotlari topilmadi.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthorError("Muallif ma'lumotlarini yuklashda xatolik yuz berdi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAuthor(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authorIdNumber]);

  const loadBooks = useCallback(async () => {
    if (!authorIdNumber) return;
    const requestId = booksRequestIdRef.current + 1;
    booksRequestIdRef.current = requestId;
    setBooksLoading(true);
    setBooksError(null);

    try {
      const { data } = await api.get<BookResponse[]>(
        `/api/authors/authors/${authorIdNumber}`,
      );
      if (booksRequestIdRef.current !== requestId) return;
      let books = normalizeBooks(data);

      if (books.length === 0) {
        const fallback = await api.get(`/api/books/get-all`, {
          params: { page: 0, size: 500 },
        });
        const allBooks = normalizeBooks(fallback.data);
        books = allBooks.filter(
          (book) => book.author?.id === authorIdNumber,
        );
      }

      const detailIds = books
        .filter((book) => book.id && !hasBookDetails(book))
        .map((book) => book.id as number);

      if (detailIds.length > 0) {
        const detailResults = await Promise.all(
          detailIds.map(async (id) => {
            try {
              const detail = await api.get(`/api/books/${id}`);
              return extractBookPayload(detail.data);
            } catch {
              return null;
            }
          }),
        );
        if (booksRequestIdRef.current !== requestId) return;
        const detailById = new Map<number, BookResponse>();
        detailResults.forEach((book) => {
          if (book?.id) detailById.set(book.id, book);
        });
        books = books.map((book) => {
          const detail = book.id ? detailById.get(book.id) : null;
          return detail ? { ...detail, ...book } : book;
        });
      }

      setAuthorBooks(books);
    } catch {
      setBooksError("Muallif kitoblarini yuklashda xatolik yuz berdi.");
    } finally {
      if (booksRequestIdRef.current === requestId) {
        setBooksLoading(false);
      }
    }
  }, [authorIdNumber]);

  useEffect(() => {
    setAuthorBooks([]);
    if (!authorIdNumber) return;
    void loadBooks();
  }, [authorIdNumber, loadBooks]);

  const filteredBooks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return authorBooks;
    return authorBooks.filter((book) =>
      (book.title ?? "").toLowerCase().includes(term),
    );
  }, [authorBooks, searchTerm]);

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
    const ids = authorBooks
      .map((book) => book.id)
      .filter((id): id is number => !!id);
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
  }, [authorBooks, coversById, fetchCoverForBook]);

  const fallbackAuthor = useMemo(() => {
    const bookWithAuthor = authorBooks.find((book) => book.author);
    if (!bookWithAuthor?.author) return null;
    const raw = bookWithAuthor.author;
    return {
      id: raw.id,
      name: raw.name,
      biography: undefined,
      birthDate: undefined,
      deathDate: undefined,
      nationality: undefined,
      profileImage: undefined,
    } as AuthorResponse;
  }, [authorBooks]);

  const resolvedAuthor = author ?? fallbackAuthor;

  useEffect(() => {
    return () => {
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  if (!authorIdNumber) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          Muallif identifikatori noto'g'ri.
        </div>
      </section>
    );
  }

  if (loadingAuthor && !resolvedAuthor) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      </section>
    );
  }

  if (!resolvedAuthor && (authorError || !booksLoading)) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {authorError ?? "Muallif topilmadi."}
        </div>
      </section>
    );
  }

  const profilesById = useAuthorProfileImages(
    authorIdNumber ? [authorIdNumber] : [],
  );
  const profileUrl = resolveProfileUrl(resolvedAuthor?.profileImage ?? null);
  const profileFromApi = authorIdNumber ? profilesById[authorIdNumber] : undefined;
  const resolvedProfile = profileFromApi ?? profileUrl;
  const booksCount =
    typeof resolvedAuthor?.booksCount === "number"
      ? resolvedAuthor.booksCount
      : authorBooks.length;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B4F3A] hover:text-[#5A4030]"
      >
        <ArrowLeft size={16} />
        Orqaga
      </button>

      <div className="glass rounded-3xl border border-[#E3DBCF] p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-[#E3DBCF] bg-[#F5F1E8] text-[#6B4F3A]">
            {resolvedProfile ? (
              <img
                src={resolvedProfile}
                alt={resolvedAuthor?.name ?? "Muallif"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold">
                {getAuthorInitials(resolvedAuthor?.name)}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[#2B2B2B]">
                {resolvedAuthor?.name ?? "Muallif nomi ko'rsatilmagan"}
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#6B6B6B]">
                <User size={12} />
                {booksCount} kitob
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[#6B6B6B]">
              <span>
                Millati:{" "}
                <span className="text-[#2B2B2B]">
                  {resolvedAuthor?.nationality ?? "--"}
                </span>
              </span>
              <span>
                Tug'ilgan sana:{" "}
                <span className="text-[#2B2B2B]">
                  {resolvedAuthor?.birthDate ?? "--"}
                </span>
              </span>
              <span>
                Vafot sanasi:{" "}
                <span className="text-[#2B2B2B]">
                  {resolvedAuthor?.deathDate ?? "--"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-[#E3DBCF] p-5">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2B2B2B]">
          Muallif haqida
        </p>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          {resolvedAuthor?.biography?.trim()
            ? resolvedAuthor.biography
            : "Muallif haqida ma'lumot mavjud emas."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#2B2B2B]">Muallif kitoblari</h2>
            <p className="text-sm text-[#6B6B6B]">
              Ushbu muallifning barcha asarlari ro'yxati
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B4F3A]"
            />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Kitob nomi bo'yicha qidirish..."
              className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] py-2.5 pl-10 pr-3 text-sm font-semibold text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/30"
            />
          </div>
        </div>

        {booksLoading ? (
          <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
            Yuklanmoqda...
          </div>
        ) : booksError ? (
          <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
            {booksError}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
            Bu muallif bo'yicha kitoblar topilmadi.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredBooks.map((book, index) => {
              const coverFromApi =
                typeof book.id === "number" ? coversById[book.id] : undefined;
              const fallbackCover = resolveCoverUrl(book.coverImage ?? null);
              const coverUrl = coverFromApi ?? fallbackCover;
              const isCoverLoading =
                typeof book.id === "number" &&
                coversById[book.id] === undefined &&
                !fallbackCover;
              const ratingValue = resolveRatingValue(book);
              const ratingCount = resolveRatingCount(book);

              return (
                <button
                  key={`${book.id ?? "book"}-${index}`}
                  type="button"
                  onClick={() =>
                    book.id ? navigate(`/books/${book.id}`) : undefined
                  }
                  className="group glass rounded-2xl border border-[#E3DBCF] p-4 text-left transition hover:border-[#6B4F3A]/40 hover:shadow-md"
                >
                  <div className="flex gap-4">
                    <div className="relative h-24 w-16 overflow-hidden rounded-xl border border-[#E3DBCF] bg-[#F5F1E8]">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={book.title ?? "Kitob"}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : isCoverLoading ? (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#9A9A9A]">
                          Yuklanmoqda...
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#9A9A9A]">
                          Muqova mavjud emas
                        </div>
                      )}
                      <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#6B4F3A] shadow">
                        <BookOpen size={12} />
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9A9A9A]">
                          Kitob
                        </p>
                        <p className="text-base font-semibold text-[#2B2B2B]">
                          {book.title ?? "Kitob nomi ko'rsatilmagan"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
                        <Star
                          size={14}
                          className={
                            ratingValue != null
                              ? "fill-[#C97B63] text-[#C97B63]"
                              : "text-[#C97B63]"
                          }
                        />
                        <span>
                          {ratingValue != null
                            ? ratingValue.toFixed(1)
                            : "Reyting mavjud emas"}
                        </span>
                        {ratingCount != null ? (
                          <span className="text-[#9A9A9A]">
                            ({ratingCount})
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </section>
  );
};

export default AuthorDetailPage;
