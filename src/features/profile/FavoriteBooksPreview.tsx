import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import FavoriteBookCard, { type FavoriteBook } from "./FavoriteBookCard";

type PagedResponse<T> = {
  content?: T[];
};

type FavoriteBooksPreviewProps = {
  showHeader?: boolean;
};

const FavoriteBooksPreview: React.FC<FavoriteBooksPreviewProps> = ({
  showHeader = true,
}) => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteBook[]>([]);
  const [coversById, setCoversById] = useState<Record<number, string | null | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverObjectUrlsRef = useRef<Map<number, string>>(new Map());

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<PagedResponse<FavoriteBook>>(
        "/api/me/books/favorites",
        {
          params: { page: 0, size: 2 },
        },
      );
      const content = Array.isArray(data?.content) ? data.content : [];
      setFavorites(content);
    } catch {
      setError("Saralangan kitoblarni yuklashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  }, []);

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
    void fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    const ids = favorites
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
  }, [favorites, coversById, fetchCoverForBook]);

  useEffect(() => {
    return () => {
      coverObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      coverObjectUrlsRef.current.clear();
    };
  }, []);

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between border-b border-[#E3DBCF] pb-2">
          <h3 className="text-lg font-bold text-[#2B2B2B] uppercase tracking-wider">
            Saralangan
          </h3>
          <button
            type="button"
            onClick={() => navigate("/profile/favorites")}
            className="text-xs font-semibold text-[#6B4F3A] transition hover:text-[#5A4030]"
          >
            Barchasini ko'rish
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[#6B6B6B]">Yuklanmoqda...</div>
      ) : error ? (
        <div className="text-sm text-[#C97B63]">{error}</div>
      ) : favorites.length === 0 ? (
        <div className="text-sm text-[#9A9A9A] italic">
          Saralangan kitoblar topilmadi
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-4 sm:justify-items-start">
          {favorites.map((book, index) => (
            <FavoriteBookCard
              key={book.bookId ?? `${book.bookTitle ?? "book"}-${index}`}
              book={book}
              variant="compact"
              coverUrl={
                typeof book.bookId === "number" ? coversById[book.bookId] : undefined
              }
              onCardClick={() => navigate("/profile/favorites")}
              onOpen={
                book.bookId
                  ? () => navigate(`/books/${book.bookId}/read`)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoriteBooksPreview;
