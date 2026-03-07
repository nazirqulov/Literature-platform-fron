import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  getAuthorInitials,
  normalizeAuthors,
  resolveProfileUrl,
} from "./authorUtils";
import type { AuthorResponse } from "./authorUtils";

const AuthorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [authors, setAuthors] = useState<AuthorResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  const filteredAuthors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return authors;
    return authors.filter((author) => {
      const name = author.name?.toLowerCase() ?? "";
      const nationality = author.nationality?.toLowerCase() ?? "";
      return name.includes(term) || nationality.includes(term);
    });
  }, [authors, searchTerm]);

  return (
    <section className="max-w-7xl mx-auto px-4 py-10 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[#2B2B2B] sm:text-3xl">
            Mualliflar
          </h1>
          <p className="text-sm text-[#6B6B6B]">
            Mashhur yozuvchilar va adabiyot namoyandalari
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
            placeholder="Muallif nomi bo'yicha qidirish..."
            className="w-full rounded-lg border border-[#E3DBCF] bg-[#F5F1E8] py-2.5 pl-10 pr-3 text-sm font-semibold text-[#2B2B2B] placeholder:text-[#9A9A9A] focus:outline-none focus:ring-2 focus:ring-[#6B4F3A]/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Yuklanmoqda...
        </div>
      ) : error ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#C97B63]">
          {error}
        </div>
      ) : filteredAuthors.length === 0 ? (
        <div className="glass rounded-2xl p-6 text-sm text-[#6B6B6B]">
          Mualliflar topilmadi.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredAuthors.map((author, index) => {
            const profileUrl = resolveProfileUrl(author.profileImage ?? null);
            const booksCount =
              typeof author.booksCount === "number" ? author.booksCount : null;
            return (
              <button
                key={`${author.id ?? "author"}-${index}`}
                type="button"
                onClick={() =>
                  author.id ? navigate(`/authors/${author.id}`) : undefined
                }
                className="group glass rounded-2xl border border-[#E3DBCF] p-4 text-center transition hover:border-[#6B4F3A]/40 hover:shadow-md"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[#E3DBCF] bg-[#F5F1E8] text-[#6B4F3A]">
                  {profileUrl ? (
                    <img
                      src={profileUrl}
                      alt={author.name ?? "Muallif"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-semibold">
                      {getAuthorInitials(author.name)}
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-1">
                  <p className="truncate text-sm font-semibold text-[#2B2B2B]">
                    {author.name ?? "Muallif nomi ko'rsatilmagan"}
                  </p>
                  <p className="text-xs text-[#9A9A9A]">
                    {booksCount != null ? `${booksCount} kitob` : "Kitoblar soni noma'lum"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AuthorsPage;
