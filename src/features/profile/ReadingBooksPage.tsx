import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import FavoriteBookCard, { type FavoriteBook } from "./FavoriteBookCard";

type PagedResponse<T> = {
  content?: T[];
  totalPages?: number;
};

const PAGE_SIZE = 10;

const ReadingBooksPage: React.FC = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<FavoriteBook[]>([]);
  const [coversById, setCoversById] = useState<
    Record<number, string | null | undefined>
  >({});
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  const fetchReading = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PagedResponse<FavoriteBook>>(
        "/api/me/books/reading",
        {
          params: { page, size: PAGE_SIZE },
        },
      );
      setBooks(Array.isArray(data?.content) ? data.content : []);
      setTotalPages(typeof data?.totalPages === "number" ? data.totalPages : 0);
    } catch {
      setError("O'qiyotgan kitoblarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, [page]);

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
      coverObjectUrlsRef.current.set(bookId, objectUrl);
      setCoversById((prev) => ({ ...prev, [bookId]: objectUrl }));
    } catch {
      setCoversById((prev) => ({ ...prev, [bookId]: null }));
    }
  }, []);

  useEffect(() => {
    void fetchReading();
  }, [fetchReading]);

  useEffect(() => {
    const ids = books
      .map((book) => book.bookId)
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
  }, [books, coversById, fetchCoverForBook]);

  useEffect(() => {
    return () => {
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  const canGoPrev = page > 0;
  const canGoNext = totalPages > 0 && page + 1 < totalPages;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2B2B2B] sm:text-3xl">
            O'qiyotgan kitoblar
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            Hozir mutolaa qilinayotgan kitoblar ro'yxati.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-xs font-semibold text-[#6B6B6B] transition hover:bg-[#F5F1E8]"
        >
          Profilga qaytish
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {error}
        </div>
      ) : books.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          O'qiyotgan kitoblar topilmadi.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book, index) => (
            <FavoriteBookCard
              key={book.bookId ?? `${book.bookTitle ?? "book"}-${index}`}
              book={book}
              coverUrl={
                typeof book.bookId === "number" ? coversById[book.bookId] : undefined
              }
              onOpen={
                book.bookId
                  ? () => navigate(`/books/${book.bookId}/read`)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(0, prev - 1))}
          disabled={!canGoPrev}
          className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-50"
        >
          Oldingi
        </button>
        <span className="text-xs text-[#6B6B6B]">
          Sahifa {page + 1}
          {totalPages > 0 ? ` / ${totalPages}` : ""}
        </span>
        <button
          type="button"
          onClick={() =>
            setPage((prev) =>
              totalPages > 0 ? Math.min(totalPages - 1, prev + 1) : prev + 1,
            )
          }
          disabled={!canGoNext}
          className="rounded-lg border border-[#E3DBCF] px-4 py-2 text-xs font-semibold text-[#6B4F3A] transition hover:bg-[#F5F1E8] disabled:opacity-50"
        >
          Keyingi
        </button>
      </div>
    </section>
  );
};

export default ReadingBooksPage;
