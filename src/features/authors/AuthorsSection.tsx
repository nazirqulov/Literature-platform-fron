import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  getAuthorInitials,
  normalizeAuthors,
  resolveProfileUrl,
} from "./authorUtils";
import type { AuthorResponse } from "./authorUtils";
import useAuthorProfileImages from "./useAuthorProfileImages";
import SectionHeader from "../../shared/components/ui/SectionHeader";

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
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : "no-scrollbar flex gap-4 overflow-x-auto pb-2";

  return (
    <section className="space-y-4">
      {showHeader ? (
        <SectionHeader
          title="Mualliflar"
          subtitle="Mashhur yozuvchilar va adabiyot namoyandalari"
          actionLabel={showAllLink ? "Barchasi" : undefined}
          actionTo={showAllLink ? "/authors" : undefined}
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
      ) : visibleAuthors.length === 0 ? (
        <div className="dashboard-card text-sm text-[color:var(--c-text-secondary)]">
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
                className={`dashboard-card group p-4 text-center transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] ${
                  layout === "grid" ? "w-full" : "w-[170px] shrink-0"
                }`}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border text-[color:var(--c-accent)]"
                  style={{
                    borderColor: "color-mix(in srgb, var(--c-border) 86%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--c-accent-soft) 45%, transparent)",
                  }}
                >
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
                  <p className="truncate text-sm font-semibold text-[color:var(--c-text-primary)]">
                    {author.name ?? "Muallif nomi ko'rsatilmagan"}
                  </p>
                  <p className="text-xs text-[color:var(--c-text-muted)]">{bookLabel}</p>
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
