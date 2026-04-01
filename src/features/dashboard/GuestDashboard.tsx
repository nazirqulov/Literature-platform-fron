import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Book, ArrowRight, Star } from "lucide-react";
import axios from "axios";
import api from "../../services/api";

type TopBookResponse = {
  id?: number;
  title?: string;
  coverImage?: string | null;
  averageRating?: number | null;
  ratingCount?: number | null;
  author?: {
    id?: number;
    name?: string;
  } | null;
  bookAuthors?: string;
};

type AuthorResponse = {
  id?: number;
  name?: string;
  profileImage?: string | null;
  booksCount?: number | null;
};

const publicApi = axios.create({
  baseURL: api.defaults.baseURL ?? "http://localhost:8080",
  headers: {
    "Content-Type": "application/json",
  },
});

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const typed = payload as Record<string, unknown>;
  const candidates = [typed.content, typed.data, typed.result];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return [];
};

const resolveFileUrl = (value?: string | null) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  const baseUrl = api.defaults.baseURL ?? "http://localhost:8080";
  return new URL(value.replace(/^\/+/, ""), `${baseUrl}/`).toString();
};

const getInitials = (name?: string) => {
  if (!name) return "MU";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "MU";
};

const GuestDashboard: React.FC = () => {
  const [topBooks, setTopBooks] = useState<TopBookResponse[]>([]);
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  const [bookCoversById, setBookCoversById] = useState<Record<number, string | null | undefined>>({});
  const [authorProfilesById, setAuthorProfilesById] = useState<Record<number, string | null | undefined>>({});

  const bookCoverObjectUrlsRef = useRef<Map<number, string>>(new Map());
  const authorProfileObjectUrlsRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoadingBooks(true);

    publicApi
      .get("/api/me/books/top-kitoblar-old-dashboard")
      .then(({ data }) => {
        if (cancelled) return;
        setTopBooks(normalizeList<TopBookResponse>(data));
      })
      .catch(() => {
        if (!cancelled) {
          setTopBooks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBooks(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingAuthors(true);

    publicApi
      .get("/api/authors/get-all")
      .then(({ data }) => {
        if (cancelled) return;
        const list = normalizeList<AuthorResponse>(data);
        const sorted = [...list].sort((a, b) => {
          const left = typeof a.booksCount === "number" ? a.booksCount : 0;
          const right = typeof b.booksCount === "number" ? b.booksCount : 0;
          return right - left;
        });
        setAuthors(sorted);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthors([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAuthors(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchBookCover = useCallback(async (bookId: number) => {
    if (Number.isNaN(bookId)) return;

    setBookCoversById((prev) => {
      if (bookId in prev) return prev;
      return { ...prev, [bookId]: undefined };
    });

    try {
      const response = await publicApi.get<Blob>(`/api/books/book-image/${bookId}`, {
        responseType: "blob",
      });

      if (!response.data || response.data.size === 0) {
        setBookCoversById((prev) => ({ ...prev, [bookId]: null }));
        return;
      }

      const objectUrl = URL.createObjectURL(response.data);
      const oldUrl = bookCoverObjectUrlsRef.current.get(bookId);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      bookCoverObjectUrlsRef.current.set(bookId, objectUrl);
      setBookCoversById((prev) => ({ ...prev, [bookId]: objectUrl }));
    } catch {
      setBookCoversById((prev) => ({ ...prev, [bookId]: null }));
    }
  }, []);

  const fetchAuthorProfile = useCallback(async (authorId: number) => {
    if (Number.isNaN(authorId)) return;

    setAuthorProfilesById((prev) => {
      if (authorId in prev) return prev;
      return { ...prev, [authorId]: undefined };
    });

    try {
      const response = await publicApi.get<Blob>(`/api/authors/author-profileImage/${authorId}`, {
        responseType: "blob",
      });

      if (!response.data || response.data.size === 0) {
        setAuthorProfilesById((prev) => ({ ...prev, [authorId]: null }));
        return;
      }

      const objectUrl = URL.createObjectURL(response.data);
      const oldUrl = authorProfileObjectUrlsRef.current.get(authorId);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }
      authorProfileObjectUrlsRef.current.set(authorId, objectUrl);
      setAuthorProfilesById((prev) => ({ ...prev, [authorId]: objectUrl }));
    } catch {
      setAuthorProfilesById((prev) => ({ ...prev, [authorId]: null }));
    }
  }, []);

  useEffect(() => {
    const ids = topBooks
      .map((book) => book.id)
      .filter((id): id is number => typeof id === "number");
    const idSet = new Set(ids);

    bookCoverObjectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        bookCoverObjectUrlsRef.current.delete(id);
        setBookCoversById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    ids.forEach((id) => {
      if (!(id in bookCoversById)) {
        void fetchBookCover(id);
      }
    });
  }, [bookCoversById, fetchBookCover, topBooks]);

  useEffect(() => {
    const ids = authors
      .map((author) => author.id)
      .filter((id): id is number => typeof id === "number");
    const idSet = new Set(ids);

    authorProfileObjectUrlsRef.current.forEach((url, id) => {
      if (!idSet.has(id)) {
        URL.revokeObjectURL(url);
        authorProfileObjectUrlsRef.current.delete(id);
        setAuthorProfilesById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });

    ids.forEach((id) => {
      if (!(id in authorProfilesById)) {
        void fetchAuthorProfile(id);
      }
    });
  }, [authorProfilesById, authors, fetchAuthorProfile]);

  useEffect(() => {
    return () => {
      bookCoverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      bookCoverObjectUrlsRef.current.clear();

      authorProfileObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      authorProfileObjectUrlsRef.current.clear();
    };
  }, []);

  const visibleBooks = useMemo(() => topBooks.slice(0, 4), [topBooks]);
  const visibleAuthors = useMemo(() => authors.slice(0, 4), [authors]);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden pb-20 pt-16 text-center sm:pb-28 sm:pt-20">
        <div className="absolute left-1/2 top-1/2 h-[220px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6B4F3A]/5 blur-[90px] -z-10 sm:h-[320px] sm:w-[560px] sm:blur-[110px] lg:h-[400px] lg:w-[800px] lg:blur-[120px]"></div>

        <div className="max-w-4xl mx-auto px-4 space-y-8 animate-fade-in-up">
          <span className="px-4 py-1.5 rounded-full bg-[#6B4F3A]/10 text-[#6B4F3A] text-xs font-semibold uppercase tracking-wider border border-[#6B4F3A]/20">
            Diplom Ishi Loyihasi
          </span>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-[#2B2B2B] sm:text-5xl md:text-7xl">
            O'zbek adabiyotini <span className="bg-gradient-to-r from-[#8FA68E] to-[#6B4F3A] bg-clip-text text-transparent italic">raqamlashtirish</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[#6B6B6B] sm:text-lg lg:text-xl">
            Global auditoriya uchun interaktiv platforma. Adabiyotimiz xazinasini zamonaviy texnologiyalar bilan kashf eting.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <Link to="/register" className="btn-primary flex w-full items-center justify-center gap-2 px-8 py-3 text-base sm:w-auto sm:text-lg">
              Boshlash <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="glass w-full rounded-lg px-8 py-3 text-base font-medium text-[#2B2B2B] transition-all hover:bg-white sm:w-auto sm:text-lg">
              Kutubxonani ko'rish
            </Link>
          </div>
        </div>
      </section>

      {/* Project Info Section */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="glass-dark p-8 md:p-12 rounded-3xl border-[#6B4F3A]/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <Book size={120} />
          </div>
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-[#2B2B2B] sm:text-3xl">Loyiha haqida</h2>
              <div className="space-y-4 text-[#6B6B6B]">
                <div className="flex items-start gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6B4F3A] mt-2"></div>
                  <p>Mazkur platforma o'zbek klassik va zamonaviy adabiyotini saqlash va ommalashtirish maqsadida yaratilgan.</p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#6B4F3A] mt-2"></div>
                  <p>Foydalanuvchilar uchun qulay mutolaa, izlanish va interaktiv muloqot imkoniyatlari mavjud.</p>
                </div>
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-[#E3DBCF] bg-white p-6 sm:p-8">
              <div className="pb-4 border-b border-[#E3DBCF]">
                <p className="text-xs text-[#6B4F3A] font-bold uppercase mb-1">Muallif</p>
                <p className="text-lg font-semibold text-[#2B2B2B]">18. Nazirqulov Barkamol Bekzod o'g'li</p>
                <p className="text-sm text-[#6B6B6B]">211-22 KIo' guruhi talabasi</p>
              </div>
              <div>
                <p className="text-xs text-[#6B4F3A] font-bold uppercase mb-1">Ilmiy Rahbar</p>
                <p className="text-lg font-semibold text-[#2B2B2B]">Yaxshibayev D.S.</p>
                <p className="text-sm text-[#6B6B6B]">Kompyuter tizimlari kafedrasi v.b. professor</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Books Section */}
      <section id="books" className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#2B2B2B] sm:text-3xl">Saralangan asarlar</h2>
            <p className="text-[#6B6B6B]">Siz uchun tanlangan eng sara adabiyot durdonalari</p>
          </div>
          <Link to="/login" className="flex items-center gap-1 text-sm font-medium text-[#6B4F3A] hover:text-[#5A4030] sm:text-base">
            Barchasini ko'rish <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {loadingBooks
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={`book-skeleton-${index}`} className="space-y-4">
                  <div className="aspect-[3/4] rounded-2xl bg-white/75 border border-[#E3DBCF] animate-pulse" />
                  <div className="h-4 w-3/4 rounded bg-white/75 border border-[#E3DBCF] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-white/75 border border-[#E3DBCF] animate-pulse" />
                </div>
              ))
            : visibleBooks.map((book, index) => {
                const coverFromApi = typeof book.id === "number" ? bookCoversById[book.id] : undefined;
                const fallbackCover = resolveFileUrl(book.coverImage ?? null);
                const coverUrl = coverFromApi ?? fallbackCover;

                const rating =
                  typeof book.averageRating === "number"
                    ? Math.max(0, Math.min(5, book.averageRating))
                    : null;
                const ratingCount =
                  typeof book.ratingCount === "number"
                    ? Math.max(0, Math.floor(book.ratingCount))
                    : 0;

                return (
                  <Link key={`${book.id ?? "book"}-${index}`} to="/login" className="group block cursor-pointer">
                    <div className="aspect-[3/4] rounded-2xl bg-white border border-[#E3DBCF] overflow-hidden relative mb-4">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={book.title ?? "Kitob muqovasi"}
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-center text-[#9A9A9A] text-sm px-4">
                          Muqova mavjud emas
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-[#2B2B2B]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="absolute bottom-4 left-4 right-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                        <span className="block w-full rounded-xl bg-[#6B4F3A] py-2 text-center text-sm font-semibold text-white">
                          O'qish
                        </span>
                      </div>
                    </div>
                    <h3 className="line-clamp-2 font-semibold text-[#2B2B2B] group-hover:text-[#6B4F3A] transition-colors">
                      {book.title ?? "Kitob nomi ko'rsatilmagan"}
                    </h3>
                    <p className="text-sm text-[#6B6B6B] line-clamp-1">
                      {book.author?.name ?? book.bookAuthors ?? "Muallif ko'rsatilmagan"}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <Star size={12} className="text-[#6B4F3A] fill-[#6B4F3A]" />
                      {rating !== null && ratingCount > 0 ? (
                        <span className="text-xs text-[#6B6B6B]">{rating.toFixed(1)} ({ratingCount})</span>
                      ) : (
                        <span className="text-xs text-[#9A9A9A]">Baholanmagan</span>
                      )}
                    </div>
                  </Link>
                );
              })}

          {!loadingBooks && visibleBooks.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-[#E3DBCF] bg-white px-4 py-6 text-center text-sm text-[#6B6B6B]">
              Hozircha top kitoblar mavjud emas.
            </div>
          ) : null}
        </div>
      </section>

      {/* Authors Section */}
      <section id="authors" className="max-w-7xl mx-auto px-4 space-y-8">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[#2B2B2B] sm:text-3xl">Mualliflar</h2>
            <p className="text-[#6B6B6B]">Mashhur yozuvchilar va adabiyot namoyandalari</p>
          </div>
          <Link to="/login" className="flex items-center gap-1 text-sm font-medium text-[#6B4F3A] hover:text-[#5A4030] sm:text-base">
            Barchasini ko'rish <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {loadingAuthors
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`author-skeleton-${index}`}
                  className="rounded-2xl border border-[#E3DBCF] bg-white p-4 text-center space-y-3"
                >
                  <div className="mx-auto h-16 w-16 rounded-full bg-[#F0EAE2] animate-pulse" />
                  <div className="h-4 w-3/4 mx-auto rounded bg-[#F0EAE2] animate-pulse" />
                </div>
              ))
            : visibleAuthors.map((author, index) => {
                const profileFromApi =
                  typeof author.id === "number" ? authorProfilesById[author.id] : undefined;
                const fallbackProfile = resolveFileUrl(author.profileImage ?? null);
                const profileUrl = profileFromApi ?? fallbackProfile;

                return (
                  <Link
                    key={`${author.id ?? "author"}-${index}`}
                    to="/login"
                    className="rounded-2xl border border-[#E3DBCF] bg-white p-4 text-center space-y-3 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#6B4F3A]/10 text-[#6B4F3A]">
                      {profileUrl ? (
                        <img
                          src={profileUrl}
                          alt={author.name ?? "Muallif"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold">{getInitials(author.name)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[#2B2B2B] line-clamp-1">
                        {author.name ?? "Muallif nomi ko'rsatilmagan"}
                      </p>
                      <p className="text-xs text-[#9A9A9A]">
                        {typeof author.booksCount === "number"
                          ? `${author.booksCount} kitob`
                          : "Muallif"}
                      </p>
                    </div>
                  </Link>
                );
              })}

          {!loadingAuthors && visibleAuthors.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-[#E3DBCF] bg-white px-4 py-6 text-center text-sm text-[#6B6B6B]">
              Hozircha mualliflar mavjud emas.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};

export default GuestDashboard;
