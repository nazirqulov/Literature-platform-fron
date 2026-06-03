import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Star } from "lucide-react";
import { isAxiosError } from "axios";
import { toast } from "react-toastify";
import api from "../../services/api";
import { useAuth } from "../../context/useAuth";
import BookDetailHero from "../../shared/components/ui/BookDetailHero";
import { createImageDataUrl } from "../../shared/utils/imageBlob";

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
  audioFile?: string | null;
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

const preloadImage = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Image failed to load"));
    image.src = src;
  });

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
  const [coverLoading, setCoverLoading] = useState(false);
  const coverImageRef = useRef<string | null>(initialBook?.coverImage ?? null);

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
    const fallbackCover = () => setCoverUrl(resolveCoverUrl(coverImageRef.current));

    const fetchCover = async () => {
      setCoverUrl(null);
      setCoverLoading(true);
      try {
        const response = await api.get<Blob>(
          `/api/books/book-image/${bookIdNumber}`,
          { responseType: "blob" },
        );
        if (cancelled) return;
        if (!response.data || response.data.size === 0) {
          fallbackCover();
          return;
        }

        const dataUrl = await createImageDataUrl(response.data);
        await preloadImage(dataUrl);
        if (cancelled) return;
        setCoverUrl(dataUrl);
      } catch {
        if (!cancelled) {
          fallbackCover();
        }
      } finally {
        if (!cancelled) {
          setCoverLoading(false);
        }
      }
    };

    void fetchCover();

    return () => {
      cancelled = true;
    };
  }, [bookIdNumber]);

  useEffect(() => {
    coverImageRef.current = book?.coverImage ?? null;
  }, [book?.coverImage]);

  const ratingAverage = resolveRatingValue(book);
  const ratingCount = resolveRatingCount(book);
  const hasAudio = typeof book?.audioFile === "string" && book.audioFile.trim().length > 0;
  const categoryNames = useMemo(
    () =>
      (book?.categories ?? [])
        .map((category) => category?.name?.trim())
        .filter((name): name is string => Boolean(name)),
    [book?.categories],
  );
  const subCategoryNames = useMemo(
    () =>
      (book?.subCategoryName ?? [])
        .map((subCategory) => subCategory?.trim())
        .filter((name): name is string => Boolean(name)),
    [book?.subCategoryName],
  );
  const bookMetaItems = useMemo(
    () => [
      {
        label: "Til",
        value: book?.language ?? "--",
        hint: "Kitob yozilgan til",
      },
      {
        label: "Nashr yili",
        value: book?.publishedYear ?? "--",
        hint: "Kitob chop etilgan yil",
      },
      {
        label: "Nashriyot",
        value: book?.publisher ?? "--",
        hint: "Kitobni nashr qilgan tashkilot",
      },
      {
        label: "ISBN",
        value: book?.isbn ?? "--",
        hint: "Kitobning xalqaro identifikator kodi",
      },
    ],
    [book?.isbn, book?.language, book?.publishedYear, book?.publisher],
  );

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
    } catch (error) {
      const backendMessage =
        isAxiosError(error) && typeof error.response?.data === "object"
          ? (error.response?.data as { message?: string })?.message
          : undefined;
      const isBadRequest = isAxiosError(error) && error.response?.status === 400;
      const message = isBadRequest
        ? "Yozgan izohingizda haqoratli va nomaqbul so'zlar deb topildi."
        : backendMessage || "Review yuborishda xatolik yuz berdi.";

      setReviewStatus("error");
      setReviewMessage(message);
      toast.error(message);
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

  const reviewList = sortedReviews;

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
          Yuklanmoqda...
        </div>
      </section>
    );
  }

  if (error || !bookIdNumber) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="dashboard-card text-sm text-[color:var(--c-danger)]">
          {error ?? "Kitob topilmadi."}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:space-y-6 sm:py-10">
      <BookDetailHero
        title={book?.title ?? "Kitob nomi ko'rsatilmagan"}
        author={book?.author?.name ?? "Muallif ko'rsatilmagan"}
        coverUrl={coverUrl}
        loadingCover={coverLoading}
        description={book?.description}
        categories={categoryNames}
        subCategories={subCategoryNames}
        rating={ratingAverage}
        ratingCount={ratingCount}
        hasAudio={hasAudio}
        metaItems={bookMetaItems}
        onBack={() => navigate(-1)}
        onRead={() => navigate(`/books/${bookIdNumber}/read`)}
        onOpenAudio={hasAudio ? () => navigate(`/books/${bookIdNumber}/audio`) : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px),minmax(0,1fr)] lg:gap-5">
        <div
          className="rounded-2xl p-5"
          style={{
            border: "1px solid color-mix(in srgb, var(--c-border) 56%, transparent)",
            backgroundColor:
              "color-mix(in srgb, var(--c-surface-elevated) 95%, var(--c-surface))",
            boxShadow: "0 14px 30px color-mix(in srgb, #2b1f14 8%, transparent)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[color:var(--c-text-primary)]">
                Reyting berish
              </p>
              <p className="text-xs text-[color:var(--c-text-secondary)]">
                Kitobga yulduzli baho bering.
              </p>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRatingValue(value)}
                  className="rounded-full p-1 transition hover:bg-[color:color-mix(in_srgb,var(--c-accent-soft)_56%,transparent)]"
                  aria-label={`${value} yulduz`}
                >
                  <Star
                    size={18}
                    className={
                      ratingValue >= value
                        ? "fill-[var(--c-warning)] text-[var(--c-warning)]"
                        : "text-[var(--c-warning)]"
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
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-px disabled:opacity-60"
              style={{
                backgroundColor: "var(--c-accent)",
                boxShadow:
                  "0 12px 24px color-mix(in srgb, var(--c-accent) 30%, transparent)",
              }}
            >
              {ratingLoading ? "Saqlanmoqda..." : "Reytingni saqlash"}
            </button>
          </div>
        </div>

        <div
          className="space-y-6 rounded-2xl p-6"
          style={{
            border: "1px solid color-mix(in srgb, var(--c-border) 56%, transparent)",
            backgroundColor:
              "color-mix(in srgb, var(--c-surface-elevated) 96%, var(--c-surface))",
            boxShadow: "0 16px 36px color-mix(in srgb, #2b1f14 9%, transparent)",
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold tracking-wide text-[color:var(--c-text-primary)]">
              Fikr yozish
            </p>
            <p className="text-xs text-[color:var(--c-text-secondary)]">
              Haqoratli yoki nomaqbul mazmundagi izohlar ko'rsatilmaydi.
            </p>
          </div>

          <div className="space-y-3">
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Kitob haqida fikringizni yozing..."
              className="min-h-[120px] w-full rounded-xl border px-4 py-3 text-sm text-[color:var(--c-text-primary)] placeholder:text-[color:var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
              style={{
                borderColor: "color-mix(in srgb, var(--c-border) 88%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--c-surface) 84%, transparent)",
              }}
              disabled={reviewSubmitting}
            />

            {reviewMessage ? (
              <p
                className={`text-xs ${
                  reviewStatus === "error"
                    ? "text-[color:var(--c-danger)]"
                    : "text-[color:var(--c-text-secondary)]"
                }`}
              >
                {reviewMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-[color:var(--c-text-muted)]">
                {reviewSubmitting
                  ? "Tekshirilmoqda..."
                  : "Izohlar tekshirilib saqlanadi."}
              </span>
              <button
                type="button"
                onClick={submitReviewText}
                disabled={reviewSubmitting || reviewText.trim().length === 0}
                className="btn-primary disabled:opacity-60"
              >
                {reviewSubmitting ? "Tekshirilmoqda..." : "Fikrni yuborish"}
              </button>
            </div>
          </div>

          <div
            className="space-y-4 border-t pt-4"
            style={{ borderColor: "color-mix(in srgb, var(--c-border) 84%, transparent)" }}
          >
            {reviewsLoading ? (
              <div className="text-sm text-[color:var(--c-text-secondary)]">
                Yuklanmoqda...
              </div>
            ) : reviewsError ? (
              <div className="text-sm text-[color:var(--c-danger)]">
                {reviewsError}
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-sm text-[color:var(--c-text-secondary)]">
                Hozircha reviewlar mavjud emas.
              </div>
            ) : (
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-2">
                {reviewList.map((review) => {
                  const mine = isMyReview(review);
                  return (
                    <div
                      key={review.id ?? `${review.bookId}-${review.comment}`}
                      className={`rounded-xl border px-4 py-3 ${
                        mine
                          ? "border-[color:color-mix(in_srgb,var(--c-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--c-accent-soft)_45%,var(--c-surface))]"
                          : "border-[color:color-mix(in_srgb,var(--c-border)_84%,transparent)] bg-[color:color-mix(in_srgb,var(--c-surface)_78%,transparent)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                            mine
                              ? "bg-[color:var(--c-accent)] text-white"
                              : "bg-[color:color-mix(in_srgb,var(--c-accent-soft)_52%,var(--c-surface))] text-[color:var(--c-accent)]"
                          }`}
                        >
                          {getUserInitials(review.user)}
                        </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[color:var(--c-text-primary)]">
                                {resolveReviewUserName(review.user)}
                              </span>
                              {mine ? (
                                <span className="rounded-full border border-[color:color-mix(in_srgb,var(--c-accent)_42%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--c-accent)]">
                                  You
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-[color:var(--c-text-secondary)]">
                              {review.comment ?? "Fikr ko'rsatilmagan."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                })}
              </div>
            )}

            {reviewsHasMore ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => loadReviews(reviewsPage + 1, true)}
                  disabled={reviewsLoadingMore}
                  className="rounded-full border px-6 py-2 text-sm font-semibold transition disabled:opacity-60"
                  style={{
                    borderColor: "color-mix(in srgb, var(--c-border) 86%, transparent)",
                    color: "var(--c-accent)",
                    backgroundColor:
                      "color-mix(in srgb, var(--c-surface) 75%, transparent)",
                  }}
                >
                  {reviewsLoadingMore ? "Yuklanmoqda..." : "Ko'proq yuklash"}
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

