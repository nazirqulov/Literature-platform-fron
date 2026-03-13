import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Headphones, Star } from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import { useAuth } from "../../context/useAuth";

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

type ReviewUser = {
  id?: number;
  username?: string;
  fullName?: string;
  profileImage?: string | null;
};

type ReviewResponse = {
  id?: number;
  user?: ReviewUser | null;
  bookId?: number;
  bookTitle?: string;
  rating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ReviewPage = {
  content?: ReviewResponse[];
  totalPages?: number;
  number?: number;
  last?: boolean;
  data?: unknown;
  result?: unknown;
};

const normalizeReviewPage = (data: unknown) => {
  if (Array.isArray(data)) {
    return { items: data as ReviewResponse[], page: 0, last: true };
  }
  if (!data || typeof data !== "object") {
    return { items: [] as ReviewResponse[], page: 0, last: true };
  }
  const typed = data as ReviewPage;
  const items =
    (Array.isArray(typed.content) ? typed.content : undefined) ??
    (Array.isArray(typed.data) ? (typed.data as ReviewResponse[]) : undefined) ??
    (Array.isArray(typed.result) ? (typed.result as ReviewResponse[]) : undefined) ??
    [];
  const page = typeof typed.number === "number" ? typed.number : 0;
  const last =
    typeof typed.last === "boolean"
      ? typed.last
      : typeof typed.totalPages === "number"
        ? page >= typed.totalPages - 1
        : items.length === 0;
  return { items, page, last };
};

const resolveReviewUserName = (user?: ReviewUser | null) =>
  user?.fullName?.trim() || user?.username?.trim() || "Foydalanuvchi";

const getUserInitials = (user?: ReviewUser | null) => {
  const name = resolveReviewUserName(user);
  const parts = name.split(" ").map((item) => item.trim()).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
  const { user } = useAuth();
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
  const [ratingLoading, setRatingLoading] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "checking" | "success" | "error">(
    "idle",
  );
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [reviewsPage, setReviewsPage] = useState(0);
  const [reviewsHasMore, setReviewsHasMore] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [myReviewIds, setMyReviewIds] = useState<Set<number>>(new Set());
  const reviewsRequestIdRef = useRef(0);
  const myReviewPrefilledRef = useRef(false);

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
          reviewText.trim().length === 0
        ) {
          setReviewText(data.userReview);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber, reviewText, ratingValue]);

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
        } catch {
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

  const submitRating = useCallback(async () => {
    if (!bookIdNumber || ratingLoading || ratingValue <= 0) return;
    setRatingLoading(true);
    try {
      await api.post(`/api/books/${bookIdNumber}/rating`, {
        rating: ratingValue,
        review: null,
      });
      toast.success("Reyting saqlandi.");
    } catch {
      toast.error("Reyting yuborishda xatolik yuz berdi.");
    } finally {
      setRatingLoading(false);
    }
  }, [bookIdNumber, ratingLoading, ratingValue]);

  const loadReviews = useCallback(
    async (pageIndex: number, append: boolean) => {
      if (!bookIdNumber) return;
      const requestId = reviewsRequestIdRef.current + 1;
      reviewsRequestIdRef.current = requestId;

      if (append) {
        setReviewsLoadingMore(true);
      } else {
        setReviewsLoading(true);
      }
      setReviewsError(null);

      try {
        const { data } = await api.get(`/api/reviews/book/${bookIdNumber}`, {
          params: { page: pageIndex, size: 10 },
        });
        if (reviewsRequestIdRef.current !== requestId) return;
        const parsed = normalizeReviewPage(data);
        setReviews((prev) =>
          append ? [...prev, ...parsed.items] : parsed.items,
        );
        setReviewsPage(parsed.page);
        setReviewsHasMore(!parsed.last);
      } catch {
        if (reviewsRequestIdRef.current !== requestId) return;
        setReviewsError("Reviewlarni yuklashda xatolik yuz berdi.");
      } finally {
        if (reviewsRequestIdRef.current === requestId) {
          setReviewsLoading(false);
          setReviewsLoadingMore(false);
        }
      }
    },
    [bookIdNumber],
  );

  const loadMyReview = useCallback(async () => {
    if (!bookIdNumber || myReviewPrefilledRef.current) return;
    try {
      const { data } = await api.get("/api/reviews/my-reviews", {
        params: { page: 0, size: 50 },
      });
      const parsed = normalizeReviewPage(data);
      const mine = parsed.items.filter((item) => item.bookId === bookIdNumber);
      const nextIds = new Set<number>();
      mine.forEach((item) => {
        if (typeof item.id === "number") nextIds.add(item.id);
      });
      setMyReviewIds(nextIds);

      const latestMine = mine[0];
      if (latestMine?.comment && reviewText.trim().length === 0) {
        setReviewText(latestMine.comment);
      }
      if (mine.length > 0) {
        myReviewPrefilledRef.current = true;
      }
    } catch {
      // Ignore: user may not have any review yet.
    }
  }, [bookIdNumber, reviewText]);

  const submitReviewText = useCallback(async () => {
    if (!bookIdNumber || reviewSubmitting) return;
    const trimmed = reviewText.trim();
    if (!trimmed) {
      toast.error("Fikr matnini kiriting.");
      return;
    }

    setReviewSubmitting(true);
    setReviewStatus("checking");
    setReviewMessage("Matn tekshirilmoqda, biroz kuting...");

    try {
      const { data } = await api.post(`/api/reviews/${bookIdNumber}/review-text`, {
        text: trimmed,
      });
      if (data?.success === false) {
        const message =
          data?.message ?? "Matnda haqoratli yoki toxic mazmun aniqlandi.";
        setReviewStatus("error");
        setReviewMessage(message);
        toast.error(message);
        return;
      }

      const successMessage =
        data?.message ?? "Review muvaffaqiyatli saqlandi.";
      setReviewStatus("success");
      setReviewMessage(successMessage);
      toast.success(successMessage);
      myReviewPrefilledRef.current = true;
      await loadReviews(0, false);
    } catch {
      setReviewStatus("error");
      setReviewMessage("Review yuborishda xatolik yuz berdi.");
      toast.error("Review yuborishda xatolik yuz berdi.");
    } finally {
      setReviewSubmitting(false);
    }
  }, [bookIdNumber, loadReviews, reviewSubmitting, reviewText]);

  useEffect(() => {
    if (!bookIdNumber) return;
    setReviews([]);
    setReviewsPage(0);
    setReviewsHasMore(false);
    void loadReviews(0, false);
  }, [bookIdNumber, loadReviews]);

  useEffect(() => {
    void loadMyReview();
  }, [loadMyReview]);

  const reviewCountLabel = useMemo(() => {
    if (reviews.length === 0) return "Hozircha review yo'q.";
    return `${reviews.length} ta review`;
  }, [reviews.length]);

  const sortedReviews = useMemo(() => {
    const copy = [...reviews];
    copy.sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });
    return copy;
  }, [reviews]);

  const isMyReview = useCallback(
    (review: ReviewResponse) => {
      if (user?.id && review.user?.id) {
        return user.id === review.user.id;
      }
      if (review.id && myReviewIds.size > 0) {
        return myReviewIds.has(review.id);
      }
      return false;
    },
    [myReviewIds, user?.id],
  );

  const myReviews = useMemo(
    () => sortedReviews.filter((review) => isMyReview(review)),
    [isMyReview, sortedReviews],
  );
  const otherReviews = useMemo(
    () => sortedReviews.filter((review) => !isMyReview(review)),
    [isMyReview, sortedReviews],
  );

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

      <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <div className="glass rounded-2xl border border-[#E3DBCF] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#2B2B2B]">
                Reyting berish
              </p>
              <p className="text-xs text-[#6B6B6B]">
                Kitobga yulduzli baho bering.
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

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              onClick={submitRating}
              disabled={ratingLoading || ratingValue <= 0}
              className="inline-flex items-center justify-center rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-60"
            >
              {ratingLoading ? "Saqlanmoqda..." : "Reytingni saqlash"}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl border border-[#E3DBCF] p-5 space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-[#2B2B2B]">
              Fikr yozish
            </p>
            <p className="text-xs text-[#6B6B6B]">
              Matn toxic yoki haqoratli bo'lsa, review ko'rsatilmaydi.
            </p>
          </div>

          <div className="space-y-3">
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Kitob haqida fikringizni yozing..."
              className="min-h-[110px] w-full rounded-xl border border-[#E3DBCF] bg-white px-3 py-2 text-sm text-[#2B2B2B] placeholder:text-[#9A9A9A]"
              disabled={reviewSubmitting}
            />

            {reviewMessage ? (
              <p
                className={`text-xs ${
                  reviewStatus === "error" ? "text-[#C97B63]" : "text-[#6B6B6B]"
                }`}
              >
                {reviewMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[#9A9A9A]">
                {reviewSubmitting ? "Tekshirilmoqda..." : "Reviewingiz tekshirilib saqlanadi."}
              </span>
              <button
                type="button"
                onClick={submitReviewText}
                disabled={reviewSubmitting || reviewText.trim().length === 0}
                className="inline-flex items-center justify-center rounded-lg bg-[#6B4F3A] px-4 py-2 text-sm font-semibold text-[#F5F1E8] transition hover:bg-[#5A4030] disabled:opacity-60"
              >
                {reviewSubmitting ? "Tekshirilmoqda..." : "Fikrni yuborish"}
              </button>
            </div>
          </div>
          <div className="space-y-4 border-t border-[#E3DBCF] pt-4">
            {reviewsLoading ? (
              <div className="text-sm text-[#6B6B6B]">Yuklanmoqda...</div>
            ) : reviewsError ? (
              <div className="text-sm text-[#C97B63]">{reviewsError}</div>
            ) : reviews.length === 0 ? (
              <div className="text-sm text-[#6B6B6B]">
                Hozircha reviewlar mavjud emas.
              </div>
            ) : (
              <div className="space-y-4">
                {myReviews.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#6B4F3A]">
                      Sizning reviewingiz
                    </p>
                    {myReviews.map((review) => {
                      const rating =
                        typeof review.rating === "number" ? review.rating : null;
                      return (
                        <div
                          key={review.id ?? `${review.bookId}-${review.comment}`}
                          className="rounded-xl border border-[#6B4F3A]/30 bg-[#F5F1E8] px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#6B4F3A]">
                              {getUserInitials(review.user)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[#2B2B2B]">
                                  {resolveReviewUserName(review.user)}
                                </span>
                                <span className="rounded-full border border-[#6B4F3A]/30 px-2 py-0.5 text-[10px] font-semibold text-[#6B4F3A]">
                                  Siz
                                </span>
                                {rating != null ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-[#C97B63]">
                                    <Star size={14} className="fill-[#C97B63]" />
                                    {rating.toFixed(1)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-[#6B6B6B]">
                                {review.comment ?? "Fikr ko'rsatilmagan."}
                              </p>
                              {review.createdAt ? (
                                <p className="text-xs text-[#9A9A9A]">
                                  {new Date(review.createdAt).toLocaleString("uz-UZ")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#9A9A9A]">
                        Boshqa foydalanuvchilar
                      </p>
                      <p className="text-xs text-[#6B6B6B]">{reviewCountLabel}</p>
                    </div>
                    <div className="text-xs text-[#9A9A9A]">
                      Yangi reviewlar tasdiqlangach ko'rinadi.
                    </div>
                  </div>

                  {otherReviews.length === 0 ? (
                    <div className="text-sm text-[#6B6B6B]">
                      Boshqa foydalanuvchilar reviewi yo'q.
                    </div>
                  ) : (
                    otherReviews.map((review) => {
                      const rating =
                        typeof review.rating === "number" ? review.rating : null;
                      return (
                        <div
                          key={review.id ?? `${review.bookId}-${review.comment}`}
                          className="rounded-xl border border-[#E3DBCF] bg-white px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F1E8] text-sm font-semibold text-[#6B4F3A]">
                              {getUserInitials(review.user)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[#2B2B2B]">
                                  {resolveReviewUserName(review.user)}
                                </span>
                                {rating != null ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-[#C97B63]">
                                    <Star size={14} className="fill-[#C97B63]" />
                                    {rating.toFixed(1)}
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-[#6B6B6B]">
                                {review.comment ?? "Fikr ko'rsatilmagan."}
                              </p>
                              {review.createdAt ? (
                                <p className="text-xs text-[#9A9A9A]">
                                  {new Date(review.createdAt).toLocaleString("uz-UZ")}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {reviewsHasMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => loadReviews(reviewsPage + 1, true)}
                  disabled={reviewsLoadingMore}
                  className="rounded-full border border-[#E3DBCF] px-6 py-2 text-sm font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-60"
                >
                  {reviewsLoadingMore ? "Yuklanmoqda..." : "Ko'proq ko'rish"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookDetailPage;
