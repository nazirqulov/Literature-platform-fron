import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  getAuthorInitials,
  normalizeAuthors,
  resolveProfileUrl,
} from "./authorUtils";
import type { AuthorResponse } from "./authorUtils";
import useAuthorProfileImages from "./useAuthorProfileImages";

type AuthorsSectionProps = {
  limit?: number;
  layout?: "carousel" | "grid";
  showHeader?: boolean;
  showAllLink?: boolean;
};

const AuthorsSection: React.FC<AuthorsSectionProps> = ({
  limit,
  layout = "carousel",
  showHeader = true,
  showAllLink = true,
}) => {
  const navigate = useNavigate();
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get("/api/authors/get-all")
      .then(({ data }) => {
        if (cancelled) return;
        setAuthors(normalizeAuthors(data));
      })
      .catch(() => {
        if (!cancelled) {
          setError("Mualliflar ro'yxatini yuklashda xatolik yuz berdi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedAuthors = useMemo(() => {
    const copy = [...authors];
    copy.sort((a, b) => {
      const left = typeof a.booksCount === "number" ? a.booksCount : 0;
      const right = typeof b.booksCount === "number" ? b.booksCount : 0;
      return right - left;
    });
    return copy;
  }, [authors]);

  const authorIds = useMemo(
    () =>
      sortedAuthors
        .map((author) => author.id)
        .filter((id): id is number => typeof id === "number"),
    [sortedAuthors],
  );
  const profilesById = useAuthorProfileImages(authorIds);

  const visibleAuthors = useMemo(() => {
    const base = sortedAuthors;
    return typeof limit === "number" ? base.slice(0, limit) : base;
  }, [limit, sortedAuthors]);

  const listClassName =
    layout === "grid"
      ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      : "flex gap-4 overflow-x-auto pb-2";

  return (
    <section className="space-y-4">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#2B2B2B]">Mualliflar</h2>
            <p className="text-sm text-[#6B6B6B]">
              Mashhur yozuvchilar va adabiyot namoyandalari
            </p>
          </div>
          {showAllLink ? (
            <Link
              to="/authors"
              className="text-sm font-semibold text-[#6B4F3A] hover:text-[#5A4030]"
            >
              Barchasi
            </Link>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {error}
        </div>
      ) : visibleAuthors.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Mualliflar topilmadi.
        </div>
      ) : (
        <div className={listClassName}>
          {visibleAuthors.map((author, index) => {
            const profileUrl = resolveProfileUrl(author.profileImage ?? null);
            const profileFromApi =
              typeof author.id === "number" ? profilesById[author.id] : undefined;
            const resolvedProfile = profileFromApi ?? profileUrl;
            const booksCount =
              typeof author.booksCount === "number" ? author.booksCount : null;
            const bookLabel =
              booksCount != null ? `${booksCount} kitob` : "Kitoblar soni noma'lum";

            return (
              <button
                key={`${author.id ?? "author"}-${index}`}
                type="button"
                onClick={() =>
                  author.id ? navigate(`/authors/${author.id}`) : undefined
                }
                className={`group glass rounded-2xl border border-[#E3DBCF] p-4 text-center transition hover:border-[#6B4F3A]/40 hover:shadow-md ${
                  layout === "grid" ? "w-full" : "w-44 shrink-0"
                }`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#E3DBCF] bg-[#F5F1E8] text-[#6B4F3A]">
                  {resolvedProfile ? (
                    <img
                      src={resolvedProfile}
                      alt={author.name ?? "Muallif"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold">
                      {getAuthorInitials(author.name)}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  <p className="truncate text-sm font-semibold text-[#2B2B2B]">
                    {author.name ?? "Muallif nomi ko'rsatilmagan"}
                  </p>
                  <p className="text-xs text-[#9A9A9A]">{bookLabel}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AuthorsSection;
