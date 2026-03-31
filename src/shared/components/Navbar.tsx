import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Library, LogOut, Menu, User, X } from "lucide-react";
import { useAuth } from "../../context/useAuth";
import api from "../../services/api";
import ThemeToggle from "./ui/ThemeToggle";
import NotificationBell from "./NotificationBell";

interface CategoryChild {
  id?: number | null;
  name: string;
}

interface CategoryItem {
  id: number;
  name: string;
  children?: CategoryChild[];
}

interface CategoryListResponse {
  content?: CategoryItem[];
}

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAuthPage = ["/login", "/register", "/verify-email", "/forgot-password"].includes(
    location.pathname,
  );

  useEffect(() => {
    if (!isAuthenticated || isAdminRoute) return;
    let isCancelled = false;

    const loadCategories = async () => {
      try {
        const { data } = await api.get<CategoryListResponse>("/api/categories/read", {
          params: { page: 0, size: 200 },
        });
        if (!isCancelled) {
          setCategories(Array.isArray(data?.content) ? data.content : []);
        }
      } catch {
        if (!isCancelled) {
          setCategories([]);
        }
      }
    };

    void loadCategories();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, isAdminRoute]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const categoryGroups = useMemo(
    () =>
      categories.map((category) => ({
        name: category.name,
        children: (category.children ?? [])
          .map((child) => child.name)
          .filter(Boolean),
      })),
    [categories],
  );

  const navLinkClass =
    "text-sm font-medium text-[color:var(--c-text-secondary)] transition hover:text-[color:var(--c-text-primary)]";

  return (
    <nav
      className="sticky top-0 z-50 border-b border-[color:var(--c-border)] backdrop-blur-md"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--c-surface-elevated) 88%, transparent)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
        <Link
          to={isAdminRoute ? "/admin" : "/"}
          className="flex items-center gap-2.5 rounded-xl px-1 py-1 transition hover:bg-[color:color-mix(in_srgb,var(--c-accent-soft)_45%,transparent)]"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--c-accent)] text-white">
            <Library size={19} />
          </span>
          <span className="hidden text-xl font-semibold tracking-tight text-[color:var(--c-text-primary)] sm:inline">
            O'zbek Adabiyoti
          </span>
        </Link>

        {!isAdminRoute && !isAuthPage ? (
          <div className="hidden items-center gap-6 md:flex">
            {!isAuthenticated ? (
              <>
                <a href="/#home" className={navLinkClass}>
                  Bosh sahifa
                </a>
                <a href="/#books" className={navLinkClass}>
                  Kitoblar
                </a>
                <a href="/#authors" className={navLinkClass}>
                  Mualliflar
                </a>
              </>
            ) : (
              <>
                <Link to="/dashboard" className={navLinkClass}>
                  Bosh sahifa
                </Link>
                <div className="group relative">
                  <Link to="/books" className={navLinkClass}>
                    Kitoblar
                  </Link>
                  {categoryGroups.length > 0 ? (
                    <div className="absolute left-0 top-full z-50 hidden w-[360px] pt-3 group-hover:block">
                      <div className="surface-elevated rounded-2xl p-4">
                        <div className="no-scrollbar max-h-80 space-y-4 overflow-auto pr-1">
                          {categoryGroups.map((group) => (
                            <div key={group.name} className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--c-text-muted)]">
                                {group.name}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {group.children.length === 0 ? (
                                  <span className="text-xs text-[color:var(--c-text-muted)]">
                                    Subcategory yo'q
                                  </span>
                                ) : (
                                  group.children.map((child) => (
                                    <Link
                                      key={`${group.name}-${child}`}
                                      to={`/books?sub=${encodeURIComponent(child)}`}
                                      className="rounded-full border px-3 py-1 text-xs font-medium transition hover:text-[color:var(--c-accent)]"
                                      style={{
                                        borderColor:
                                          "color-mix(in srgb, var(--c-border) 86%, transparent)",
                                        backgroundColor:
                                          "color-mix(in srgb, var(--c-accent-soft) 38%, transparent)",
                                        color: "var(--c-text-secondary)",
                                      }}
                                    >
                                      {child}
                                    </Link>
                                  ))
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <Link to="/authors" className={navLinkClass}>
                  Mualliflar
                </Link>
                <Link to="/profile" className={navLinkClass}>
                  Profil
                </Link>
              </>
            )}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {isAuthenticated ? (
            <div className="hidden items-center gap-2 sm:flex">
              {!isAdminRoute ? <NotificationBell /> : null}
              <Link
                to={isAdminRoute ? "/admin/profile" : "/profile"}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold text-[color:var(--c-text-primary)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--c-surface-elevated) 90%, transparent)",
                }}
              >
                <User size={15} className="text-[color:var(--c-accent)]" />
                <span>{user?.username}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-[color:var(--c-text-secondary)] transition hover:text-[color:var(--c-danger)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
                  backgroundColor:
                    "color-mix(in srgb, var(--c-surface-elevated) 90%, transparent)",
                }}
                title="Tizimdan chiqish"
                aria-label="Tizimdan chiqish"
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                to="/login"
                className="rounded-full border px-4 py-2 text-sm font-semibold text-[color:var(--c-text-secondary)] transition hover:text-[color:var(--c-text-primary)]"
                style={{
                  borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
                }}
              >
                Kirish
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Ro'yxatdan o'tish
              </Link>
            </div>
          )}

          {!isAdminRoute ? (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-[color:var(--c-text-secondary)] md:hidden"
              style={{
                borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)",
                backgroundColor:
                  "color-mix(in srgb, var(--c-surface-elevated) 90%, transparent)",
              }}
              aria-label="Menyuni ochish"
            >
              <Menu size={18} />
            </button>
          ) : null}
        </div>
      </div>

      {mobileOpen && !isAdminRoute ? (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/45"
            aria-label="Menyuni yopish"
          />
          <aside className="absolute right-0 top-0 h-full w-[85%] max-w-sm border-l border-[color:var(--c-border)] bg-[color:var(--c-surface-elevated)] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-[color:var(--c-text-primary)]">Menyu</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--c-border)] text-[color:var(--c-text-secondary)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              <ThemeToggle className="w-full justify-center" />
            </div>

            <div className="mt-6 space-y-3">
              {!isAuthenticated ? (
                <>
                  <a href="/#home" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Bosh sahifa
                  </a>
                  <a href="/#books" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Kitoblar
                  </a>
                  <a href="/#authors" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Mualliflar
                  </a>
                  <div className="flex items-center gap-2 pt-3">
                    <Link
                      to="/login"
                      className="rounded-full border px-4 py-2 text-sm font-semibold text-[color:var(--c-text-secondary)]"
                      style={{ borderColor: "color-mix(in srgb, var(--c-border) 90%, transparent)" }}
                    >
                      Kirish
                    </Link>
                    <Link to="/register" className="btn-primary text-sm">
                      Ro'yxatdan o'tish
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/dashboard" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Bosh sahifa
                  </Link>
                  <Link to="/books" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Kitoblar
                  </Link>
                  <Link to="/authors" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Mualliflar
                  </Link>
                  <Link to="/profile" className="block text-sm font-medium text-[color:var(--c-text-primary)]">
                    Profil
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--c-text-secondary)]"
                  >
                    <LogOut size={16} />
                    Chiqish
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </nav>
  );
};

export default Navbar;
