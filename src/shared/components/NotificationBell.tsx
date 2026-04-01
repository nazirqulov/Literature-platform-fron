import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../services/api";
import { subscribeNewBookEvent } from "../../services/bookRealtimeBus";

type NotificationItem = {
  notificationId?: number;
  id?: number;
  bookId?: number;
  type?: string;
  title?: string;
  name?: string;
  author?: string;
  message?: string;
};

type NotificationPage = {
  content: NotificationItem[];
  number: number;
  totalPages: number;
  totalElements: number;
  last: boolean;
};

const DEFAULT_PAGE: NotificationPage = {
  content: [],
  number: 0,
  totalPages: 0,
  totalElements: 0,
  last: true,
};

const PAGE_SIZE = 10;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const extractArrayFromPayload = (raw: unknown): unknown[] => {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const typed = raw as Record<string, unknown>;
  const candidates = [
    typed.content,
    typed.data,
    typed.result,
    (typed.data as Record<string, unknown> | undefined)?.content,
    (typed.result as Record<string, unknown> | undefined)?.content,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const normalizeNotification = (raw: unknown): NotificationItem => {
  const typed = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const notificationId =
    toNumber(typed.notificationId) ?? toNumber(typed.notification_id) ?? null;

  // backend response: id => bookId
  const id = toNumber(typed.id);
  const bookId =
    toNumber(typed.bookId) ??
    toNumber(typed.bookID) ??
    toNumber(typed.book_id) ??
    toNumber((typed.book as Record<string, unknown> | undefined)?.id) ??
    id;

  return {
    notificationId: notificationId ?? undefined,
    id: id ?? undefined,
    bookId: bookId ?? undefined,
    type: typeof typed.type === "string" ? typed.type : undefined,
    title: typeof typed.title === "string" ? typed.title : undefined,
    name: typeof typed.name === "string" ? typed.name : undefined,
    author: typeof typed.author === "string" ? typed.author : undefined,
    message: typeof typed.message === "string" ? typed.message : undefined,
  };
};

const normalizePage = (raw: unknown): NotificationPage => {
  if (Array.isArray(raw)) {
    return {
      content: raw.map(normalizeNotification),
      number: 0,
      totalPages: 1,
      totalElements: raw.length,
      last: true,
    };
  }

  const obj = (raw && typeof raw === "object"
    ? (raw as Partial<NotificationPage>)
    : undefined);

  const content = Array.isArray(obj?.content)
    ? obj.content.map(normalizeNotification)
    : extractArrayFromPayload(raw).map(normalizeNotification);

  const number = typeof obj?.number === "number" ? obj.number : 0;
  const totalPages = typeof obj?.totalPages === "number" ? obj.totalPages : 1;
  const totalElements =
    typeof obj?.totalElements === "number" ? obj.totalElements : content.length;
  const last = typeof obj?.last === "boolean" ? obj.last : number + 1 >= totalPages;

  return { content, number, totalPages, totalElements, last };
};

const extractBookPayload = (data: unknown) => {
  if (!data || typeof data !== "object") return null;
  const typed = data as Record<string, unknown>;
  const possible =
    (typed.book as Record<string, unknown> | undefined) ??
    (typed.data as Record<string, unknown> | undefined) ??
    (!Array.isArray(typed.content)
      ? (typed.content as Record<string, unknown> | undefined)
      : undefined) ??
    (data as Record<string, unknown>);

  return possible ?? null;
};

const extractBookIdFromSearchPayload = (data: unknown, title: string): number | null => {
  const rows = extractArrayFromPayload(data);
  if (rows.length === 0) return null;

  const normalizedTitle = title.trim().toLowerCase();

  const normalizedRows = rows
    .map((row) => (row && typeof row === "object" ? (row as Record<string, unknown>) : null))
    .filter((row): row is Record<string, unknown> => Boolean(row));

  const exact = normalizedRows.find((row) => {
    const rowTitle = typeof row.title === "string" ? row.title.trim().toLowerCase() : "";
    return rowTitle.length > 0 && rowTitle === normalizedTitle;
  });

  const startsWith = normalizedRows.find((row) => {
    const rowTitle = typeof row.title === "string" ? row.title.trim().toLowerCase() : "";
    return rowTitle.length > 0 && rowTitle.startsWith(normalizedTitle);
  });

  const fallback = exact ?? startsWith ?? normalizedRows[0];

  return (
    toNumber(fallback.bookId) ??
    toNumber(fallback.bookID) ??
    toNumber(fallback.book_id) ??
    toNumber(fallback.id)
  );
};

const resolveTitle = (item: NotificationItem) =>
  item.title || "Noma'lum kitob";

const resolveAuthor = (item: NotificationItem) =>
  item.author || item.name || "Noma'lum muallif";

const resolveMessage = (item: NotificationItem) => item.message || "";

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");
  const [unreadPage, setUnreadPage] = useState<NotificationPage>(DEFAULT_PAGE);
  const [readPage, setReadPage] = useState<NotificationPage>(DEFAULT_PAGE);
  const [loadingUnread, setLoadingUnread] = useState(false);
  const [loadingRead, setLoadingRead] = useState(false);
  const [latestBookId, setLatestBookId] = useState<number | null>(null);
  const [showRealtimeDot, setShowRealtimeDot] = useState(false);

  const fetchPage = useCallback(
    async (kind: "unread" | "read", page = 0) => {
      const endpoint =
        kind === "unread" ? "/api/notifications/unread" : "/api/notifications/read";

      if (kind === "unread") setLoadingUnread(true);
      else setLoadingRead(true);

      try {
        const { data } = await api.get(endpoint, { params: { page, size: PAGE_SIZE } });
        const normalized = normalizePage(data);
        if (kind === "unread") setUnreadPage(normalized);
        else setReadPage(normalized);
      } catch {
        toast.error("Bildirishnomalarni yuklashda xatolik yuz berdi.");
      } finally {
        if (kind === "unread") setLoadingUnread(false);
        else setLoadingRead(false);
      }
    },
    [],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchPage("unread", 0), fetchPage("read", 0)]);
  }, [fetchPage]);

  const markAsRead = useCallback(async (item: NotificationItem) => {
    if (!item.notificationId) return;

    await api.put(`/api/notifications/mark-as-read/${item.notificationId}`);

    setUnreadPage((prev) => {
      const nextContent = prev.content.filter(
        (entry) => entry.notificationId !== item.notificationId,
      );
      return {
        ...prev,
        content: nextContent,
        totalElements: Math.max(0, prev.totalElements - 1),
      };
    });

    setReadPage((prev) => {
      const exists = prev.content.some(
        (entry) => entry.notificationId === item.notificationId,
      );
      if (exists) return prev;
      return {
        ...prev,
        content: [item, ...prev.content].slice(0, PAGE_SIZE),
        totalElements: prev.totalElements + 1,
      };
    });
  }, []);

  useEffect(() => {
    void fetchPage("unread", 0);
  }, [fetchPage]);

  useEffect(() => {
    if (!open) return;
    void refreshAll();
    setShowRealtimeDot(false);
  }, [open, refreshAll]);

  useEffect(() => {
    const unsubscribe = subscribeNewBookEvent((payload) => {
      if (payload.type !== "NEW_BOOK") return;

      const incomingBookId = toNumber(payload.id) ?? toNumber(payload.bookId);
      if (incomingBookId != null) {
        setLatestBookId(incomingBookId);
      }

      setShowRealtimeDot(true);
      void fetchPage("unread", 0);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchPage]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
    };
  }, [open]);

  const totalUnread = unreadPage.totalElements;
  const hasBadge = totalUnread > 0 || showRealtimeDot;
  const activePage = activeTab === "unread" ? unreadPage : readPage;
  const activeLoading = activeTab === "unread" ? loadingUnread : loadingRead;

  const paginationText = useMemo(() => {
    if (activePage.totalElements === 0) return "0 / 0";
    const from = activePage.number * PAGE_SIZE + 1;
    const to = Math.min((activePage.number + 1) * PAGE_SIZE, activePage.totalElements);
    return `${from}-${to} / ${activePage.totalElements}`;
  }, [activePage.number, activePage.totalElements]);

  const openBookDetail = useCallback(
    async (bookId: number, silent = false) => {
      try {
        const { data } = await api.get(`/api/books/${bookId}`);
        const book = extractBookPayload(data);
        setOpen(false);
        setShowRealtimeDot(false);
        navigate(`/books/${bookId}`, { state: book ? { book } : undefined });
        return true;
      } catch {
        if (!silent) {
          toast.error("Kitob ma'lumotini yuklashda xatolik yuz berdi.");
        }
        return false;
      }
    },
    [navigate],
  );

  const resolveBookIdFromTitle = useCallback(async (title?: string): Promise<number | null> => {
    const keyword = title?.trim();
    if (!keyword) return null;

    try {
      const { data } = await api.get("/api/books/search", {
        params: { keyword, page: 0, size: 20 },
      });
      const found = extractBookIdFromSearchPayload(data, keyword);
      if (found != null) return found;
    } catch {
      // search endpoint ishlamasa pastdagi fallback ishlaydi
    }

    try {
      const { data } = await api.get("/api/books/get-all", {
        params: { page: 0, size: 50 },
      });
      return extractBookIdFromSearchPayload(data, keyword);
    } catch {
      return null;
    }
  }, []);

  const handleOpenLatestBook = async () => {
    if (!latestBookId) return;
    await openBookDetail(latestBookId);
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    if (activeTab === "unread") {
      try {
        await markAsRead(item);
      } catch {
        toast.error("Bildirishnomani o'qilgan holatga o'tkazib bo'lmadi.");
      }
    }

    const targetBookId =
      toNumber(item.bookId) ?? toNumber(item.id) ?? latestBookId;

    if (typeof targetBookId === "number" && Number.isFinite(targetBookId)) {
      const opened = await openBookDetail(targetBookId, true);
      if (opened) return;
    }

    const fallbackBookId = await resolveBookIdFromTitle(item.title ?? item.name);
    if (typeof fallbackBookId === "number" && Number.isFinite(fallbackBookId)) {
      const opened = await openBookDetail(fallbackBookId, true);
      if (opened) return;
    }

    toast.info("Bu bildirishnoma uchun kitob topilmadi.");
  };

  const changePage = (direction: "prev" | "next") => {
    const current = activeTab === "unread" ? unreadPage : readPage;
    const nextPage =
      direction === "prev" ? Math.max(0, current.number - 1) : current.number + 1;
    if (direction === "next" && current.last) return;
    void fetchPage(activeTab, nextPage);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3DBCF] bg-white text-[#6B6B6B] transition hover:text-[#2B2B2B]"
        title="Bildirishnomalar"
        aria-label="Bildirishnomalar"
      >
        <Bell size={16} />
        {hasBadge ? (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] rounded-2xl border border-[#E3DBCF] bg-white p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-[#2B2B2B]">Bildirishnomalar</p>
            {latestBookId ? (
              <button
                type="button"
                onClick={() => void handleOpenLatestBook()}
                className="rounded-lg border border-[#6B4F3A]/30 px-2 py-1 text-xs font-medium text-[#6B4F3A] hover:bg-[#6B4F3A]/10"
              >
                So'nggi kitobni ochish
              </button>
            ) : null}
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "unread"
                  ? "bg-[#6B4F3A] text-[#F5F1E8]"
                  : "border border-[#E3DBCF] text-[#6B6B6B]"
              }`}
            >
              O'qilmagan ({unreadPage.totalElements})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("read")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                activeTab === "read"
                  ? "bg-[#6B4F3A] text-[#F5F1E8]"
                  : "border border-[#E3DBCF] text-[#6B6B6B]"
              }`}
            >
              O'qilgan ({readPage.totalElements})
            </button>
          </div>

          <div className="no-scrollbar max-h-80 space-y-2 overflow-auto pr-1">
            {activeLoading ? (
              <p className="rounded-xl border border-[#E3DBCF] p-3 text-xs text-[#6B6B6B]">
                Yuklanmoqda...
              </p>
            ) : activePage.content.length === 0 ? (
              <p className="rounded-xl border border-[#E3DBCF] p-3 text-xs text-[#6B6B6B]">
                Bildirishnoma topilmadi.
              </p>
            ) : (
              activePage.content.map((item, index) => {
                const key = item.notificationId ?? item.id ?? `notification-${index}`;
                const title = resolveTitle(item);
                const author = resolveAuthor(item);
                const message = resolveMessage(item);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void handleOpenNotification(item)}
                    className="w-full rounded-xl border border-[#E3DBCF] bg-[#F5F1E8]/40 p-3 text-left transition hover:border-[#6B4F3A]/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-xs font-normal text-[#6B6B6B]">
                          Kitob nomi: {title}
                        </p>
                        <p className="text-xs font-normal text-[#6B6B6B]">
                          Kitob muallifi: {author}
                        </p>
                        {message ? (
                          <p className="line-clamp-2 text-xs font-normal text-[#6B6B6B]">
                            {message}
                          </p>
                        ) : null}
                      </div>
                      {activeTab === "unread" ? (
                        <span className="mt-1 h-2 w-2 rounded-full bg-[#6B4F3A]" />
                      ) : null}
                    </div>



                    <div className="mt-2 flex items-center justify-end">
                      <p className="text-[11px] font-semibold text-[#6B4F3A]">Ochish</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-[#E3DBCF] pt-2 text-xs">
            <span className="text-[#6B6B6B]">{paginationText}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changePage("prev")}
                disabled={activePage.number === 0}
                className="rounded border border-[#E3DBCF] px-2 py-1 text-[#6B6B6B] disabled:opacity-50"
              >
                Oldingi
              </button>
              <button
                type="button"
                onClick={() => changePage("next")}
                disabled={activePage.last}
                className="rounded border border-[#E3DBCF] px-2 py-1 text-[#6B6B6B] disabled:opacity-50"
              >
                Keyingi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;


