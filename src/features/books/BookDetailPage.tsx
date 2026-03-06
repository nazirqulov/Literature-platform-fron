import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Headphones, Star } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";

interface BookCategoryResponse {
  id?: number;
  name?: string;
}

interface AuthorResponse {
  id?: number;
  name?: string;
}

interface BookDetail {
  id?: number;
  title?: string;
  description?: string | null;
  author?: AuthorResponse | null;
  categories?: BookCategoryResponse[] | null;
  subCategoryName?: string[] | null;
  isbn?: string | null;
  language?: string | null;
  publishedYear?: number | null;
  publisher?: string | null;
  coverImage?: string | null;
  rating?: number | null;
  averageRating?: number | null;
  avgRating?: number | null;
  ratingAvg?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
  reviewsCount?: number | null;
  reviewCount?: number | null;
}

type ProgressResponse = {
  userRating?: number | null;
  userReview?: string | null;
};

const resolveRatingValue = (book: BookDetail | null) => {
  if (!book) return null;
  const raw =
    book.averageRating ??
    book.avgRating ??
    book.rating ??
    book.ratingAvg ??
    book.ratingValue;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.min(5, raw));
};

const resolveRatingCount = (book: BookDetail | null) => {
  if (!book) return null;
  const raw = book.ratingCount ?? book.reviewsCount ?? book.reviewCount ?? null;
  if (typeof raw !== "number" || Number.isNaN(raw)) return null;
  return Math.max(0, Math.floor(raw));
};

const resolveCoverUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

const extractBookPayload = (data: unknown): BookDetail | null => {
  if (!data || typeof data !== "object") return null;
  const typed = data as Record<string, unknown>;
  const content = typed.content;
  const possible =
    (typed.book as BookDetail | undefined) ??
    (typed.data as BookDetail | undefined) ??
    (!Array.isArray(content) ? (content as BookDetail | undefined) : undefined) ??
    (data as BookDetail);
  return possible ?? null;
};

const BookDetailPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const parsedBookId = Number(bookId);
  const bookIdNumber =
    Number.isFinite(parsedBookId) && parsedBookId > 0 ? parsedBookId : null;
  const initialBook =
    (location.state as { book?: BookDetail } | null)?.book ?? null;
  const [book, setBook] = useState<BookDetail | null>(initialBook);
  const [loading, setLoading] = useState(!initialBook);
  const [error, setError] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverObjectUrlRef = useRef<string | null>(null);

  const [ratingValue, setRatingValue] = useState(0);
  const [ratingReview, setRatingReview] = useState("");
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    if (!bookIdNumber) return;
    let cancelled = false;

    api
      .get<ProgressResponse>(`/api/books/${bookIdNumber}/progress`)
      .then(({ data }) => {
        if (cancelled) return;
        if (typeof data?.userRating === "number" && ratingValue === 0) {
          const normalized = Math.max(1, Math.min(5, Math.round(data.userRating)));
          setRatingValue(normalized);
        }
        if (
          typeof data?.userReview === "string" &&
          ratingReview.trim().length === 0
        ) {
          setRatingReview(data.userReview);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber, ratingReview, ratingValue]);

  useEffect(() => {
    if (!bookIdNumber) {
      setError("Kitob identifikatori noto'g'ri.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchDetail = async () => {
      const endpoints = [
        `/api/books/${bookIdNumber}`,
        `/api/books/get/${bookIdNumber}`,
        `/api/books/get-by-id/${bookIdNumber}`,
      ];

      for (let i = 0; i < endpoints.length; i += 1) {
        const endpoint = endpoints[i];
        try {
          const { data } = await api.get(endpoint);
          if (cancelled) return;
          const resolved = extractBookPayload(data);
          if (resolved) {
            setBook(resolved);
            setLoading(false);
            return;
          }
        } catch (fetchError) {
          if (cancelled) return;
          if (i < endpoints.length - 1) continue;
          setError("Kitob ma'lumotlarini yuklashda xatolik yuz berdi.");
        }
      }

      if (!cancelled) setLoading(false);
    };

    void fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber]);

  useEffect(() => {
    if (!bookIdNumber) return;
    let cancelled = false;

    const fetchCover = async () => {
      try {
        const response = await api.get<Blob>(
          `/api/books/book-image/${bookIdNumber}`,
          { responseType: "blob" },
        );
        if (cancelled) return;
        if (!response.data || response.data.size === 0) {
          setCoverUrl(resolveCoverUrl(book?.coverImage));
          return;
        }

        const objectUrl = URL.createObjectURL(response.data);
        if (coverObjectUrlRef.current) {
          URL.revokeObjectURL(coverObjectUrlRef.current);
        }
        coverObjectUrlRef.current = objectUrl;
        setCoverUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setCoverUrl(resolveCoverUrl(book?.coverImage));
        }
      }
    };

    void fetchCover();

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber, book?.coverImage]);

  useEffect(() => {
    return () => {
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
        coverObjectUrlRef.current = null;
      }
    };
  }, []);

  const ratingAverage = resolveRatingValue(book);
  const ratingCount = resolveRatingCount(book);

  const tags = useMemo(() => {
    return book?.categories?.map((item) => item.name).filter(Boolean) ?? [];
  }, [book]);

  const submitRating = useCallback(async () => {
    if (!bookIdNumber || ratingLoading || ratingValue <= 0) return;
    setRatingLoading(true);
    try {
      await api.post(`/api/books/${bookIdNumber}/rating`, {
        rating: ratingValue,
        review: ratingReview.trim() || null,
      });
      toast.success("Reyting saqlandi.");
      setRatingReview("");
    } catch {
      toast.error("Reyting yuborishda xatolik yuz berdi.");
    } finally {
      setRatingLoading(false);
    }
  }, [bookIdNumber, ratingLoading, ratingReview, ratingValue]);

  if (loading) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      </section>
    );
  }

  if (error || !bookIdNumber) {
    return (
      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {error ?? "Kitob topilmadi."}
        </div>
      </section>
    );
  }

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

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="glass rounded-3xl border border-[#E3DBCF] p-4">
          <div className="h-80 w-full overflow-hidden rounded-2xl border border-[#E3DBCF] bg-white">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={book?.title ?? "Muqova"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#F5F1E8] via-white to-[#EFE7DB] text-[#9A9A9A]">
                <BookOpen size={36} />
                <span className="text-xs font-semibold uppercase tracking-widest">
                  Muqova mavjud emas
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2 text-sm text-[#6B6B6B]">
            <div className="flex items-center gap-2">
              <Star
                size={16}
                className={
                  ratingAverage != null
                    ? "fill-[#C97B63] text-[#C97B63]"
                    : "text-[#C97B63]"
                }
              />
              <span>
                {ratingAverage != null
                  ? `${ratingAverage.toFixed(1)}`
                  : "Reyting mavjud emas"}
                {ratingCount != null ? ` (${ratingCount})` : ""}
              </span>
            </div>
            <div>
              Til: <span className="text-[#2B2B2B]">{book?.language ?? "--"}</span>
            </div>
            <div>
              Nashr yili:{" "}
              <span className="text-[#2B2B2B]">{book?.publishedYear ?? "--"}</span>
            </div>
            <div>
              Nashriyot:{" "}
              <span className="text-[#2B2B2B]">{book?.publisher ?? "--"}</span>
            </div>
            <div>
              ISBN: <span className="text-[#2B2B2B]">{book?.isbn ?? "--"}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-[#2B2B2B]">
              {book?.title ?? "Kitob nomi ko'rsatilmagan"}
            </h1>
            <p className="text-sm text-[#6B6B6B]">
              Muallif:{" "}
              <span className="text-[#2B2B2B]">
                {book?.author?.name ?? "Muallif ko'rsatilmagan"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {tags.length > 0 ? (
              tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded-full border border-[#E3DBCF] bg-[#F5F1E8] px-3 py-1 text-xs font-semibold text-[#6B6B6B]"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#9A9A9A]">
                Kategoriya ko'rsatilmagan
              </span>
            )}
          </div>

          <div className="glass rounded-2xl border border-[#E3DBCF] p-4">
            <p className="text-sm font-bold uppercase tracking-widest text-[#2B2B2B]">
              Kitob haqida
            </p>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              {book?.description?.trim()
                ? book.description
                : "Kitob tavsifi mavjud emas."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate(`/books/${bookIdNumber}/read`)}
              className="inline-flex items-center gap-2 rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030]"
            >
              <BookOpen size={16} />
              Kitobni ochish
            </button>
            <button
              type="button"
              onClick={() => navigate(`/books/${bookIdNumber}/audio`)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E3DBCF] bg-white px-4 py-2 text-sm font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8]"
            >
              <Headphones size={16} />
              Audioni ochish
            </button>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl border border-[#E3DBCF] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#2B2B2B]">
              Fikr va reyting
            </p>
            <p className="text-xs text-[#6B6B6B]">
              Kitob haqida qisqacha fikringizni yozing.
            </p>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRatingValue(value)}
                className="rounded-full p-1 transition hover:bg-[#F5F1E8]"
                aria-label={`${value} yulduz`}
              >
                <Star
                  size={18}
                  className={
                    ratingValue >= value
                      ? "fill-[#C97B63] text-[#C97B63]"
                      : "text-[#C97B63]"
                  }
                />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <textarea
            value={ratingReview}
            onChange={(event) => setRatingReview(event.target.value)}
            placeholder="Fikr yozing (ixtiyoriy)..."
            className="min-h-[90px] w-full flex-1 rounded-xl border border-[#E3DBCF] bg-white px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A]"
          />
          <button
            type="button"
            onClick={submitRating}
            disabled={ratingLoading || ratingValue <= 0}
            className="inline-flex items-center justify-center rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-60"
          >
            {ratingLoading ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default BookDetailPage;
